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

/** Gap statuses that must not be reopened by a silent re-analyze save. */
export const TERMINAL_GAP_STATUSES = new Set(["resolved", "ignored"]);

/**
 * @param {import('pg').Pool} pool
 * @param {object} packet
 */
export async function saveEvolutionPacket(pool, packet) {
  // Bug BV: always writing version=1 with ON CONFLICT DO UPDATE clobbered
  // accepted packets and flipped resolved gaps back to ready_for_review.
  // Schema supports versioned packets + superseded — allocate next version.
  const { rows: gapRows } = await pool.query(`SELECT id, status FROM pea.gaps WHERE id = $1`, [
    packet.gap_id,
  ]);
  const gap = gapRows[0];
  if (!gap) {
    const err = new Error("gap_not_found");
    err.code = "gap_not_found";
    throw err;
  }
  if (TERMINAL_GAP_STATUSES.has(gap.status)) {
    const err = new Error("terminal_gap_status");
    err.code = "terminal_gap_status";
    err.gapStatus = gap.status;
    throw err;
  }

  const { rows: verRows } = await pool.query(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM pea.evolution_packets
      WHERE gap_id = $1`,
    [packet.gap_id],
  );
  const version = Number(verRows[0]?.next_version) || 1;

  await pool.query(
    `UPDATE pea.evolution_packets
        SET status = 'superseded', updated_at = now()
      WHERE gap_id = $1
        AND status IN ('draft', 'critic_pending', 'critic_failed', 'ready_for_review')`,
    [packet.gap_id],
  );

  const { rows } = await pool.query(
    `INSERT INTO pea.evolution_packets
       (gap_id, version, status, primary_lane, secondary_lanes, diagnosis,
        recommended_changes, ratchet_plan, spec_citations, critic_result, blast_radius)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)
     RETURNING *`,
    [
      packet.gap_id,
      version,
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
    `UPDATE pea.gaps
        SET latest_packet_id = $2,
            status = CASE
              WHEN status IN ('resolved', 'ignored') THEN status
              ELSE 'ready_for_review'
            END,
            updated_at = now()
      WHERE id = $1`,
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
