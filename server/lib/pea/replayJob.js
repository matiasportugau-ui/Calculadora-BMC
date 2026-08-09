/**
 * PEA replay job — IMP-PEA-11 (read-only staging re-pack).
 */
import { runAnalysisPreflight } from "./analysisPreflight.js";

/**
 * @param {import('pg').Pool} pool
 * @param {import('../../config.js').config} config
 * @param {{ gapId: string, packetId?: string, actorId?: string }} input
 */
export async function runPeaReplay(pool, config, input) {
  const { rows: gapRows } = await pool.query(`SELECT * FROM pea.gaps WHERE id = $1`, [input.gapId]);
  const gap = gapRows[0];
  if (!gap) return { error: "gap_not_found" };

  let packet = null;
  if (input.packetId) {
    const { rows } = await pool.query(`SELECT * FROM pea.evolution_packets WHERE id = $1`, [input.packetId]);
    packet = rows[0] || null;
  }

  const preflight = await runAnalysisPreflight(pool, config, {
    systemPrompt: "PEA replay read-only",
    gapEvent: { signal_type: gap.signal_type, summary: gap.summary },
    evidence: { replay: true, fingerprint: gap.fingerprint },
    toolSchemas: { read_file: {} },
    maxOutputTokens: 2000,
    toolRounds: 0,
    retries: 0,
    modelCallsPlanned: 0,
    fallbackChain: [],
  });

  const { rows: runRows } = await pool.query(
    `INSERT INTO pea.replay_runs (gap_id, packet_id, mode, result, completed_at)
     VALUES ($1, $2, 'read_only', $3::jsonb, now())
     RETURNING id`,
    [
      input.gapId,
      packet?.id || null,
      JSON.stringify({
        preflight_verdict: preflight.verdict,
        estimated_tokens: preflight.estimatedTokens || 0,
        actor: input.actorId || null,
      }),
    ],
  );

  return {
    ok: true,
    replay_run_id: runRows[0].id,
    preflight_verdict: preflight.verdict,
    mode: "read_only",
  };
}
