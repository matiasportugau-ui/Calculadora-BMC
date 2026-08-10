/**
 * analyze_gap job — threshold → preflight → ArchitectRuntime.
 */
import { getEnabledModel } from "../omni/orchestrator/aiRegistry.js";
import {
  runAnalysisPreflight,
  preflightReserve,
  settleBudget,
  refundBudget,
} from "./analysisPreflight.js";
import { passesAnalysisThreshold, TERMINAL_GAP_STATUSES } from "./gapEvents.js";
import { runArchitectRuntime } from "./architectRuntime.js";

const MOCK_MODEL = {
  model_id: "pea-mock-haiku",
  cost_per_1k_input_usd: 0.001,
  cost_per_1k_output_usd: 0.005,
};

/**
 * @param {import('pg').Pool} pool
 * @param {import('../../config.js').config} config
 * @param {object} job
 * @param {import('pino').Logger|object} [logger]
 */
export async function runAnalyzeGapJob(pool, config, job, logger) {
  const log = logger || { warn() {}, info() {} };
  const gapId = job.gap_id;
  const force = Boolean(job.input_json?.force);

  const { rows: gapRows } = await pool.query(`SELECT * FROM pea.gaps WHERE id = $1`, [gapId]);
  const gap = gapRows[0];
  if (!gap) {
    throw new Error("gap_not_found");
  }

  // Bug CA: never re-analyze terminal gaps (even force diagnose) — saveEvolutionPacket
  // UPSERTs version=1 and would destroy accepted packets + flip gap off resolved.
  if (TERMINAL_GAP_STATUSES.has(gap.status)) {
    await pool.query(
      `UPDATE pea.jobs SET status = 'completed', output_json = $2::jsonb, completed_at = now() WHERE id = $1`,
      [
        job.id,
        JSON.stringify({
          ok: true,
          skipped: "terminal_gap_status",
          status: gap.status,
        }),
      ],
    );
    return { skipped: true, reason: "terminal_gap_status", status: gap.status };
  }

  if (!passesAnalysisThreshold(config, gap, { force })) {
    await pool.query(
      `UPDATE pea.jobs SET status = 'completed', output_json = $2::jsonb, completed_at = now() WHERE id = $1`,
      [
        job.id,
        JSON.stringify({ ok: true, skipped: "below_threshold", occurrence_count: gap.occurrence_count }),
      ],
    );
    return { skipped: true };
  }

  let fallbackChain = [MOCK_MODEL];
  if (!config.peaArchitectMock) {
    try {
      const primary = await getEnabledModel(pool, "pea:plan");
      const critic = await getEnabledModel(pool, "pea:critic");
      fallbackChain = [primary, critic].filter(Boolean);
      if (fallbackChain.length === 0) fallbackChain = [MOCK_MODEL];
    } catch {
      fallbackChain = [MOCK_MODEL];
    }
  }

  const preflight = await runAnalysisPreflight(pool, config, {
    systemPrompt: "PEA ArchitectRuntime M2a",
    gapEvent: { signal_type: gap.signal_type, summary: gap.summary },
    evidence: { sdd: "docs/sdd/panelin-evolution-architect/SDD.md" },
    toolSchemas: { read_file: {}, grep_repo: {} },
    maxOutputTokens: config.peaMaxOutputTokensPerCall,
    toolRounds: 2,
    retries: 0,
    modelCallsPlanned: config.peaArchitectMock ? 2 : 3,
    fallbackChain,
  });

  const { rows: runRows } = await pool.query(
    `INSERT INTO pea.analysis_runs
       (gap_id, phase, preflight_verdict, estimated_tokens, reserved_usd, model_calls_planned, blocked_reason)
     VALUES ($1, 'full_iteration', $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      gapId,
      preflight.verdict,
      preflight.estimatedTokens || preflight.usage?.totalTokens || 0,
      preflight.reservedUsd || 0,
      3,
      preflight.verdict !== "AUTO_RUN" ? preflight.reason || preflight.verdict : null,
    ],
  );
  const analysisRunId = runRows[0].id;

  if (preflight.verdict !== "AUTO_RUN") {
    await pool.query(
      `UPDATE pea.jobs SET status = 'completed', output_json = $2::jsonb, completed_at = now() WHERE id = $1`,
      [job.id, JSON.stringify({ ok: true, preflight: preflight.verdict, analysis_run_id: analysisRunId })],
    );
    return { preflight: preflight.verdict };
  }

  const reserve = await preflightReserve(pool, config, preflight, { gapId, analysisRunId });
  let architectResult;
  try {
    // Bug CQ: TOCTOU vs accept/reject — unconditional investigating UPDATE would
    // reopen a gap that became terminal after the initial SELECT (CA check).
    const terminalList = [...TERMINAL_GAP_STATUSES];
    const flipped = await pool.query(
      `UPDATE pea.gaps SET status = 'investigating', updated_at = now()
        WHERE id = $1
          AND NOT (status = ANY($2::text[]))
        RETURNING id`,
      [gapId, terminalList],
    );
    if ((flipped.rowCount ?? flipped.rows?.length ?? 0) === 0) {
      if (reserve.ledgerId) {
        await refundBudget(pool, reserve.ledgerId, { error: "terminal_gap_status" });
      }
      await pool.query(
        `UPDATE pea.jobs SET status = 'completed', output_json = $2::jsonb, completed_at = now() WHERE id = $1`,
        [
          job.id,
          JSON.stringify({
            ok: true,
            skipped: "terminal_gap_status",
            race: "investigating_guard",
          }),
        ],
      );
      return { skipped: true, reason: "terminal_gap_status", race: "investigating_guard" };
    }

    architectResult = await runArchitectRuntime(pool, config, {
      gap,
      analysisRunId,
      forceMock: config.peaArchitectMock,
    });
    if (reserve.ledgerId) {
      // Bug CR: settle at 50% of reserve under-counted daily spend (~2× budget).
      // Until real token metering exists, settle at the reserved amount (delta 0).
      await settleBudget(pool, reserve.ledgerId, {
        actualUsd: preflight.reservedUsd || 0,
        actualTokens: preflight.estimatedTokens || 0,
        metadata: { packet_id: architectResult.packetId },
      });
    }
  } catch (e) {
    if (reserve.ledgerId) await refundBudget(pool, reserve.ledgerId, { error: e.message });
    throw e;
  }

  await pool.query(
    `UPDATE pea.analysis_runs SET completed_at = now(), packet_id = $2 WHERE id = $1`,
    [analysisRunId, architectResult.packetId || null],
  );

  await pool.query(
    `UPDATE pea.jobs SET status = 'completed', output_json = $2::jsonb, completed_at = now() WHERE id = $1`,
    [
      job.id,
      JSON.stringify({
        ok: architectResult.ok,
        packet_id: architectResult.packetId,
        status: architectResult.status,
        critic: architectResult.critic,
        analysis_run_id: analysisRunId,
      }),
    ],
  );

  log.info?.({ gap_id: gapId, packet_id: architectResult.packetId }, "pea analyze_gap completed");
  return architectResult;
}
