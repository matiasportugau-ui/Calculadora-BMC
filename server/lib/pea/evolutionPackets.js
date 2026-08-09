/**
 * EvolutionPacket persistence.
 */
import { runCritic, revisePacketOnce } from "./critic.js";
import { routeLane } from "./laneRouter.js";

/**
 * Build draft packet from architect phases (mock/stub path for M2a).
 */
export function buildMockArchitectPacket(gap, laneInfo, exploreNotes) {
  const lane = laneInfo.primary;
  const diagnosis =
    `Diagnóstico (ES): gap \`${gap.signal_type}\` con ${gap.occurrence_count} ocurrencia(s). ` +
    `${exploreNotes}`;
  return {
    gap_id: gap.id,
    version: 1,
    status: "critic_pending",
    primary_lane: lane,
    secondary_lanes: laneInfo.secondary || [],
    diagnosis,
    operator_summary:
      `Panelin detectó ${gap.occurrence_count} fallo(s) tipo ${gap.signal_type}. ` +
      `Lane ${lane}: revisar contrato y agregar sensor/golden antes de código.`,
    recommended_changes: [
      {
        kind: lane === "H" ? "harness_golden" : lane === "K" ? "knowledge_candidate" : "code_patch",
        lane,
        description: gap.summary || gap.title,
        path: lane === "C" ? "src/" : "tests/",
      },
    ],
    ratchet_plan: {
      artifacts: [
        {
          type: "golden",
          path: "tests/peaGapFingerprint.test.js",
          description: "Fingerprint estable para dedupe",
        },
      ],
    },
    spec_citations: [
      { ref: "docs/sdd/panelin-evolution-architect/SDD.md§6.4d", quote: "Critic gate" },
    ],
    blast_radius: {
      summary: "Análisis read-only L2; sin writes comerciales",
      risk_level: "R0",
      surfaces: ["panelin_fast", "pea_worker"],
    },
    critic_result: {},
    payload: { claims_price: false },
  };
}

/** Packet statuses that must not be overwritten by version=1 UPSERT (Bug BV). */
export const IMMUTABLE_PACKET_STATUSES = new Set(["accepted", "rejected", "superseded"]);

/**
 * @param {import('pg').Pool} pool
 * @param {object} packet
 */
export async function saveEvolutionPacket(pool, packet) {
  // Bug BV defense-in-depth: never clobber an accepted/rejected v1 packet via ON CONFLICT.
  const existing = await pool.query(
    `SELECT id, status FROM pea.evolution_packets WHERE gap_id = $1 AND version = 1`,
    [packet.gap_id],
  );
  const prior = existing.rows[0];
  if (prior && IMMUTABLE_PACKET_STATUSES.has(prior.status)) {
    const err = new Error("packet_immutable");
    err.code = "packet_immutable";
    err.status = prior.status;
    err.packetId = prior.id;
    throw err;
  }

  const { rows } = await pool.query(
    `INSERT INTO pea.evolution_packets
       (gap_id, version, status, primary_lane, secondary_lanes, diagnosis,
        recommended_changes, ratchet_plan, spec_citations, critic_result, blast_radius)
     VALUES ($1, 1, $2, $3, $4::jsonb, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
     ON CONFLICT (gap_id, version) DO UPDATE SET
       status = EXCLUDED.status,
       primary_lane = EXCLUDED.primary_lane,
       diagnosis = EXCLUDED.diagnosis,
       recommended_changes = EXCLUDED.recommended_changes,
       ratchet_plan = EXCLUDED.ratchet_plan,
       spec_citations = EXCLUDED.spec_citations,
       critic_result = EXCLUDED.critic_result,
       blast_radius = EXCLUDED.blast_radius,
       updated_at = now()
     RETURNING *`,
    [
      packet.gap_id,
      packet.status,
      packet.primary_lane,
      JSON.stringify(packet.secondary_lanes || []),
      packet.diagnosis,
      JSON.stringify(packet.recommended_changes || []),
      JSON.stringify(packet.ratchet_plan || {}),
      JSON.stringify(packet.spec_citations || []),
      JSON.stringify(packet.critic_result || {}),
      JSON.stringify({
        ...(packet.blast_radius || {}),
        operator_summary: packet.operator_summary || null,
      }),
    ],
  );
  const saved = rows[0];
  await pool.query(
    `UPDATE pea.gaps SET latest_packet_id = $2, status = 'ready_for_review', updated_at = now() WHERE id = $1`,
    [packet.gap_id, saved.id],
  );
  return saved;
}

/**
 * Critic gate + optional one revise.
 */
export function finalizePacketWithCritic(packet, gap) {
  let draft = { ...packet };
  let critic = runCritic(draft, { gap });
  if (!critic.passed) {
    draft = revisePacketOnce(draft, critic, gap);
    critic = runCritic(draft, { gap });
  }
  draft.critic_result = critic;
  draft.status = critic.passed ? "ready_for_review" : "critic_failed";
  return draft;
}

export { routeLane };
