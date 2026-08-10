/**
 * Gap ingest + mass dedupe — persists to pea.gaps / gap_events.
 */
import {
  buildFingerprintInputsFromSignal,
  computeFingerprint,
  FINGERPRINT_VERSION,
} from "./gapFingerprint.js";
import { insertOutboxEvent, enqueuePeaJob } from "./outbox.js";

const SEVERITY_WEIGHT = { low: 1, medium: 2, high: 5, critical: 10 };

/** Gap statuses that must not be reopened by analyze / auto-diagnose (Bug CA). */
export const TERMINAL_GAP_STATUSES = new Set(["resolved", "ignored"]);

/**
 * @param {import('../../config.js').config} config
 * @param {{ occurrence_count: number, severity: string, force?: boolean }} gap
 */
export function passesAnalysisThreshold(config, gap, opts = {}) {
  if (opts.force) return true;
  if (gap.severity === "high" || gap.severity === "critical") return true;
  const min = config.peaAutoMinOccurrences ?? 3;
  return (gap.occurrence_count || 0) >= min;
}

function priorityScore(occurrenceCount, severity) {
  const w = SEVERITY_WEIGHT[severity] || 2;
  return Number((occurrenceCount * w).toFixed(4));
}

/**
 * Record a gap signal (dedupe + occurrence).
 * @param {import('pg').Pool} pool
 * @param {import('../../config.js').config} config
 * @param {object} signal
 */
export async function recordGapSignal(pool, config, signal) {
  if (!pool || !config?.peaEnabled) {
    return { skipped: true, reason: "pea_disabled" };
  }

  const fingerprintInputs = buildFingerprintInputsFromSignal(signal);
  const fingerprint = computeFingerprint(fingerprintInputs, FINGERPRINT_VERSION);
  const severity = signal.severity || "medium";
  const title = (signal.title || signal.signal_type || "gap").slice(0, 256);
  const summary = (signal.summary || signal.message_template || title).slice(0, 4000);
  const gapMetadata = {
    ...(signal.tool_id ? { tool_id: signal.tool_id } : {}),
    ...(signal.payload?.tool ? { tool_id: signal.payload.tool } : {}),
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const upsert = await client.query(
      `INSERT INTO pea.gaps
         (fingerprint, fingerprint_version, signal_type, severity, title, summary, metadata,
          occurrence_count, priority_score, first_seen, last_seen)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 1, $8, now(), now())
       ON CONFLICT (fingerprint, fingerprint_version) DO UPDATE SET
         occurrence_count = pea.gaps.occurrence_count + 1,
         last_seen = now(),
         updated_at = now(),
         metadata = pea.gaps.metadata || EXCLUDED.metadata,
         severity = CASE
           WHEN EXCLUDED.severity = 'critical' THEN 'critical'
           WHEN EXCLUDED.severity = 'high' AND pea.gaps.severity NOT IN ('critical') THEN 'high'
           ELSE pea.gaps.severity
         END
       RETURNING *`,
      [
        fingerprint,
        FINGERPRINT_VERSION,
        signal.signal_type || "unknown",
        severity,
        title,
        summary,
        JSON.stringify(gapMetadata),
        priorityScore(1, severity),
      ],
    );
    let gap = upsert.rows[0];
    gap.priority_score = priorityScore(gap.occurrence_count, gap.severity);

    await client.query(
      `UPDATE pea.gaps SET priority_score = $2 WHERE id = $1`,
      [gap.id, gap.priority_score],
    );

    const ev = await client.query(
      `INSERT INTO pea.gap_events
         (gap_id, source, signal_type, tool_id, session_id, conversation_id, severity, fingerprint_inputs, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
       RETURNING id`,
      [
        gap.id,
        signal.source || "panelin_fast",
        signal.signal_type || "unknown",
        signal.tool_id || null,
        signal.session_id || null,
        signal.conversation_id || null,
        severity,
        JSON.stringify(fingerprintInputs),
        JSON.stringify(signal.payload || {}),
      ],
    );

    await client.query(
      `INSERT INTO pea.gap_occurrences (gap_id, gap_event_id, occurred_at)
       VALUES ($1, $2, now())`,
      [gap.id, ev.rows[0].id],
    );

    await insertOutboxEvent(client, {
      aggregateType: "gap",
      aggregateId: gap.id,
      eventType: "gap.updated",
      payload: { gap_id: gap.id, occurrence_count: gap.occurrence_count },
    });

    let jobId = null;
    // Bug CA: do not auto-enqueue analyze on terminal gaps (resolved/ignored).
    const shouldAnalyze =
      config.peaAutoDiagnose &&
      !TERMINAL_GAP_STATUSES.has(gap.status) &&
      passesAnalysisThreshold(config, gap, { force: signal.force_analyze });

    if (shouldAnalyze) {
      jobId = await enqueuePeaJob(client, {
        jobType: "analyze_gap",
        gapId: gap.id,
        input: { trigger: "threshold", gap_id: gap.id },
      });
    }

    await client.query("COMMIT");
    return {
      gapId: gap.id,
      fingerprint,
      occurrenceCount: gap.occurrence_count,
      jobId,
      shouldAnalyze,
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
