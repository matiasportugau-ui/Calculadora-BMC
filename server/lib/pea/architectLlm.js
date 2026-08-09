/**
 * ArchitectRuntime LLM phases (IMP-PEA-07 live path) — read-only L1–L2.
 */
import { callAgentOnce } from "../agentCore.js";

const SYSTEM = `You are Panelin Evolution Architect (PEA). Analyze a gap signal and output ONLY valid JSON (no markdown).
Rules: L2 read-only; no prices unless provenance exists; primary_lane must be H, K, or C; Spanish operator_summary.
Schema:
{
  "diagnosis": "string (ES)",
  "operator_summary": "string (ES, 1-3 sentences)",
  "primary_lane": "H"|"K"|"C",
  "secondary_lanes": ["H"|"K"|"C"],
  "recommended_changes": [{"kind":"string","lane":"H"|"K"|"C","description":"string","path":"string"}],
  "ratchet_plan": {"artifacts":[{"type":"golden"|"fitness_sensor"|"rule_provenance","path":"string","description":"string"}]},
  "spec_citations": [{"ref":"string","quote":"string"}],
  "blast_radius": {"summary":"string","risk_level":"R0"|"R1","surfaces":["string"]},
  "payload": {"claims_price": false}
}`;

/**
 * @param {object} gap
 * @param {{ primary: string, secondary?: string[] }} laneInfo
 * @param {string} exploreNotes
 * @param {import('../../config.js').config} config
 */
export async function buildLlmArchitectPacket(gap, laneInfo, exploreNotes, config) {
  const userContent = JSON.stringify(
    {
      gap: {
        id: gap.id,
        signal_type: gap.signal_type,
        fingerprint: gap.fingerprint,
        occurrence_count: gap.occurrence_count,
        title: gap.title,
        summary: gap.summary,
        severity: gap.severity,
        metadata: gap.metadata || {},
      },
      lane_hint: laneInfo,
      explore_notes: exploreNotes,
      sdd_ref: "docs/sdd/panelin-evolution-architect/SDD.md",
    },
    null,
    2,
  );

  const { text } = await callAgentOnce(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: userContent },
    ],
    {
      channel: "chat",
      bareSystemPrompt: SYSTEM,
      taskKey: "peaArchitect",
      override: {
        maxTokens: Math.min(config.peaMaxOutputTokensPerCall || 6000, 8000),
        temperature: 0.2,
      },
    },
  );

  let parsed;
  try {
    const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("architect_llm_invalid_json");
  }

  return {
    gap_id: gap.id,
    version: 1,
    status: "critic_pending",
    primary_lane: parsed.primary_lane || laneInfo.primary,
    secondary_lanes: parsed.secondary_lanes || laneInfo.secondary || [],
    diagnosis: parsed.diagnosis || gap.summary,
    operator_summary: parsed.operator_summary || gap.title,
    recommended_changes: parsed.recommended_changes || [],
    ratchet_plan: parsed.ratchet_plan || { artifacts: [] },
    spec_citations: parsed.spec_citations || [],
    blast_radius: parsed.blast_radius || {
      summary: "LLM L2 analysis",
      risk_level: "R0",
      surfaces: ["pea_worker"],
    },
    critic_result: {},
    payload: { claims_price: Boolean(parsed.payload?.claims_price), source: "llm" },
  };
}
