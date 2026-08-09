/**
 * Lane router — H → K → C preference (rule-based triage for M2a).
 */

const HARNESS_SIGNALS = new Set([
  "tool_fail",
  "tool_schema",
  "golden_miss",
  "prompt_drift",
]);

const KNOWLEDGE_SIGNALS = new Set([
  "missing_capability",
  "operator_report",
  "kb_gap",
]);

/**
 * @param {{ signal_type?: string, tool_id?: string, payload?: object }} gap
 */
export function routeLane(gap) {
  const signal = gap.signal_type || "";
  if (KNOWLEDGE_SIGNALS.has(signal)) return { primary: "K", secondary: [] };
  if (HARNESS_SIGNALS.has(signal)) return { primary: "H", secondary: [] };
  if (signal === "calc_error" || signal === "calc_validation") {
    return { primary: "C", secondary: ["H"] };
  }
  if (signal === "provider_fail") return { primary: "H", secondary: ["C"] };
  return { primary: "H", secondary: ["K"] };
}
