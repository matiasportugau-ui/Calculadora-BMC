/**
 * PEA AnalysisPreflight unit tests (offline).
 * Run: node tests/peaAnalysisPreflight.test.js
 */
import {
  PEA_VERDICTS,
  estimatePreflightUsage,
  estimateUsdForChain,
  resolvePreflightVerdict,
  runAnalysisPreflight,
} from "../server/lib/pea/analysisPreflight.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  fn();
}

const peaCaps = {
  peaAutoMaxTotalTokens: 32000,
  peaApprovalMaxTotalTokens: 96000,
  peaAutoMaxCostUsd: 0.5,
  peaApprovedMaxCostUsd: 2.5,
  peaAutoDailyBudgetUsd: 10,
  peaRequireModelPricing: true,
  peaEstimateSafetyFactor: 1.2,
  peaFallbackReservationMode: "sum",
};

const pricedModel = {
  model_id: "claude-haiku-4-5-20251001",
  cost_per_1k_input_usd: 0.001,
  cost_per_1k_output_usd: 0.005,
  max_tokens: 6000,
};

group("estimatePreflightUsage sums components", () => {
  const u = estimatePreflightUsage({
    systemPrompt: "x".repeat(350),
    gapEvent: { signal_type: "tool_fail" },
    maxOutputTokens: 1000,
    toolRounds: 1,
    modelCallsPlanned: 2,
  });
  assert(u.totalTokens > u.inputTokens, "total includes output");
  assert(u.breakdown.modelCallsPlanned === 2, "model calls planned");
});

group("AUTO_RUN under caps", () => {
  const u = estimatePreflightUsage({
    systemPrompt: "short",
    gapEvent: { a: 1 },
    maxOutputTokens: 500,
    modelCallsPlanned: 1,
  });
  const priced = estimateUsdForChain([pricedModel], u);
  assert(!priced.unpriced, "priced");
  const v = resolvePreflightVerdict({
    totalTokens: u.totalTokens,
    totalUsd: priced.totalUsd,
    unpriced: false,
    config: peaCaps,
  });
  assert(v.verdict === "AUTO_RUN", `verdict AUTO_RUN got ${v.verdict}`);
});

group("DENY_UNPRICED when pricing missing", () => {
  const u = estimatePreflightUsage({ systemPrompt: "x", maxOutputTokens: 100 });
  const priced = estimateUsdForChain([{ model_id: "unknown" }], u);
  const v = resolvePreflightVerdict({
    totalTokens: u.totalTokens,
    totalUsd: priced.totalUsd,
    unpriced: priced.unpriced,
    config: peaCaps,
  });
  assert(v.verdict === "DENY_UNPRICED", "deny unpriced");
});

group("DECOMPOSE when over token cap", () => {
  const v = resolvePreflightVerdict({
    totalTokens: 200_000,
    totalUsd: 0.01,
    unpriced: false,
    config: peaCaps,
  });
  assert(v.verdict === "DECOMPOSE", "decompose");
});

group("ASK_INTERNAL in middle band", () => {
  const v = resolvePreflightVerdict({
    totalTokens: 40000,
    totalUsd: 0.35,
    unpriced: false,
    config: peaCaps,
  });
  assert(v.verdict === "ASK_INTERNAL", `got ${v.verdict}`);
});

group("fallback sum mode increases USD", () => {
  const u = estimatePreflightUsage({ systemPrompt: "test", maxOutputTokens: 2000, modelCallsPlanned: 1 });
  const one = estimateUsdForChain([pricedModel], u);
  const two = estimateUsdForChain([pricedModel, pricedModel], u);
  assert(two.totalUsd > one.totalUsd, "sum fallbacks");
});

group("runAnalysisPreflight without pool", async () => {
  const r = await runAnalysisPreflight(null, peaCaps, {
    systemPrompt: "hi",
    fallbackChain: [pricedModel],
    maxOutputTokens: 400,
  });
  assert(PEA_VERDICTS.includes(r.verdict), "valid verdict");
  assert(r.usage.totalTokens > 0, "usage");
});

console.log(`\n${"═".repeat(50)}`);
console.log(`peaAnalysisPreflight: ${passed} passed, ${failed} failed`);
console.log("═".repeat(50));
process.exit(failed > 0 ? 1 : 0);
