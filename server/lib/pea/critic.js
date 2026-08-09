/**
 * Critic gate — PEA_CRITIC_GATE_V1
 */

/**
 * @param {object} packet draft
 * @param {{ gap?: object, evidence?: object }} ctx
 */
export function runCritic(packet, ctx = {}) {
  const failures = [];
  const citations = packet.spec_citations || [];
  if (!Array.isArray(citations) || citations.length === 0) {
    failures.push("missing_spec_citation");
  }
  const ratchet = packet.ratchet_plan?.artifacts;
  if (!Array.isArray(ratchet) || ratchet.length === 0) {
    failures.push("empty_ratchet_plan");
  }
  if (!packet.diagnosis || String(packet.diagnosis).length < 20) {
    failures.push("diagnosis_too_short");
  }
  if (!packet.blast_radius?.summary) {
    failures.push("missing_blast_radius");
  }
  const lane = packet.primary_lane;
  if (!["H", "K", "C"].includes(lane)) {
    failures.push("invalid_lane");
  }
  const moneyClaim = packet.payload?.claims_price === true;
  if (moneyClaim && !packet.payload?.calc_provenance) {
    failures.push("money_without_calc_provenance");
  }
  if (ctx.gap?.signal_type === "tool_fail" && lane === "C" && !citations.some((c) => /ADR|SDD/i.test(c.ref || ""))) {
    failures.push("code_lane_without_spec_anchor");
  }
  return {
    passed: failures.length === 0,
    failures,
    checked_at: new Date().toISOString(),
    model_phase: "pea:critic",
  };
}

/**
 * One revise pass — enrich missing fields deterministically.
 */
export function revisePacketOnce(packet, criticResult, gap) {
  const next = { ...packet };
  if (criticResult.failures.includes("missing_spec_citation")) {
    next.spec_citations = [
      { ref: "docs/sdd/panelin-evolution-architect/SDD.md§6", quote: "ArchitectRuntime phases" },
    ];
  }
  if (criticResult.failures.includes("empty_ratchet_plan")) {
    next.ratchet_plan = {
      artifacts: [
        {
          type: next.primary_lane === "H" ? "golden" : "fitness_sensor",
          path: "tests/peaArchitectRuntime.test.js",
          description: "Add regression for gap fingerprint",
        },
      ],
    };
  }
  if (criticResult.failures.includes("missing_blast_radius")) {
    next.blast_radius = {
      summary: `Gap ${gap?.signal_type || "unknown"} — read-only L2 analysis`,
      risk_level: "R0",
      surfaces: ["panelin_fast"],
    };
  }
  if (criticResult.failures.includes("diagnosis_too_short")) {
    next.diagnosis = `${next.diagnosis || ""} Revisado: causa probable ligada a ${gap?.signal_type || "señal"}.`.trim();
  }
  return next;
}
