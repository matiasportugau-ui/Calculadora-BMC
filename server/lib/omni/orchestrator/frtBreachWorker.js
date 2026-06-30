// server/lib/omni/orchestrator/frtBreachWorker.js — in-process worker that
// persists a historical/audit trail of first-response-time SLA breaches into
// omni_frt_breaches (migration 012).
//
// GET /omni/actions/urgent already computes SLA breach LIVE, per request, via
// scoreConversationUrgency() — this worker adds no new "is it urgent" signal.
// It exists purely so breach history survives past the live moment (for later
// reporting: breach count/week, average breach duration). Reuses the exact
// same scoring policy as the live queue so the two never disagree.
//
// Mirrors the existing in-process worker pattern (snoozeWorker.js): pool-gated
// no-op, best-effort tick (a failure is logged and retried next interval), and
// degrades to a no-op — not a crash — if migration 012 hasn't been applied yet.

import { scoreConversationUrgency } from "../urgency.js";

const DEFAULT_INTERVAL_MS = 300_000; // 5 min — breach tracking doesn't need second-level granularity

const TABLE_MISSING = "omni_frt_breaches table missing — apply migration 012 (npm run omni:migrate)";

export function startOmniFrtBreachWorker({ logger, pool, intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  if (!pool) return () => {};
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      await closeResolvedBreaches(pool, logger);
      await recordNewBreaches(pool, logger);
    } catch (e) {
      logger?.warn?.({ err: e?.message }, "omni frt breach worker tick failed");
    }
  }

  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick(); // run once on boot so a long-overdue breach isn't missed for a full interval

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/** Close out breaches for conversations that have since received their first agent reply. */
async function closeResolvedBreaches(pool, logger) {
  try {
    const { rowCount } = await pool.query(
      `UPDATE omni_frt_breaches b
          SET resolved_at = c.first_agent_reply_at
         FROM omni_conversations c
        WHERE b.conversation_id = c.id
          AND b.resolved_at IS NULL
          AND c.first_agent_reply_at IS NOT NULL`,
    );
    if (rowCount) logger?.info?.({ resolved: rowCount }, "omni frt breach worker closed breaches");
  } catch (e) {
    if (e.code === "42P01") {
      logger?.warn?.(TABLE_MISSING);
      return;
    }
    throw e;
  }
}

/** Record new breaches for open, never-replied conversations past their channel SLA. */
async function recordNewBreaches(pool, logger) {
  let rows;
  try {
    ({ rows } = await pool.query(
      `SELECT c.id, c.channel, c.created_at, c.first_agent_reply_at,
              (SELECT MAX(m.created_at) FROM omni_messages m WHERE m.conversation_id = c.id) AS last_message_at
         FROM omni_conversations c
        WHERE c.status = 'open'
          AND c.first_agent_reply_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM omni_frt_breaches b
             WHERE b.conversation_id = c.id AND b.resolved_at IS NULL
          )`,
    ));
  } catch (e) {
    if (e.code === "42P01") {
      logger?.warn?.(TABLE_MISSING);
      return;
    }
    throw e;
  }

  let inserted = 0;
  for (const row of rows) {
    const urgency = scoreConversationUrgency(row);
    if (!urgency.sla_breached) continue;
    try {
      // ON CONFLICT targets the partial unique index (one open breach per
      // conversation) — a safety net against the multi-instance race; the
      // NOT EXISTS above already does the common-case filtering.
      const { rowCount } = await pool.query(
        `INSERT INTO omni_frt_breaches (conversation_id, channel, sla_target_hours)
         VALUES ($1, $2, $3)
         ON CONFLICT (conversation_id) WHERE resolved_at IS NULL DO NOTHING`,
        [row.id, row.channel, urgency.sla_hours],
      );
      inserted += rowCount;
    } catch (e) {
      logger?.warn?.({ err: e.message, conversation_id: row.id }, "omni frt breach insert failed");
    }
  }
  if (inserted) logger?.info?.({ inserted }, "omni frt breach worker recorded breaches");
}
