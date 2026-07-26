// tests/providerProbes.test.js — reason mapping (no network)
import {
  mapProbeErrorToReasonCode,
  reasonMessage,
  PROBE_PROMPT,
  PROBE_MAX_TOKENS,
} from "../server/lib/providerProbes.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

assert(PROBE_MAX_TOKENS <= 8, "max tokens ≤ 8");
assert(typeof PROBE_PROMPT === "string" && PROBE_PROMPT.length > 0, "probe prompt set");

assert(mapProbeErrorToReasonCode({ status: 401, message: "Unauthorized" }) === "auth_failed", "401 → auth_failed");
assert(
  mapProbeErrorToReasonCode({
    status: 401,
    message: "ACCESS_TOKEN_TYPE_UNSUPPORTED",
  }) === "auth_failed",
  "ACCESS_TOKEN_TYPE → auth_failed",
);
assert(
  mapProbeErrorToReasonCode({
    status: 400,
    message: "Your credit balance is too low to access the Anthropic API",
  }) === "billing",
  "credit balance → billing",
);
assert(
  mapProbeErrorToReasonCode({
    status: 429,
    message: "You exceeded your current quota, please check your plan and billing details. insufficient_quota",
  }) === "billing",
  "OpenAI insufficient_quota 429 → billing",
);
assert(
  mapProbeErrorToReasonCode({ status: 429, message: "Rate limit exceeded" }) === "rate_limited",
  "rate limit → rate_limited",
);
assert(
  mapProbeErrorToReasonCode({
    status: 429,
    message:
      "You exceeded your current quota... free_tier_requests, limit: 20. Please retry in 3s. RESOURCE_EXHAUSTED",
  }) === "rate_limited",
  "Gemini free_tier 429 → rate_limited (amber)",
);
assert(
  mapProbeErrorToReasonCode({ status: 400, message: "Incorrect API key provided" }) === "invalid_key",
  "incorrect key → invalid_key",
);
assert(mapProbeErrorToReasonCode({ status: 408, message: "aborted" }) === "timeout", "abort → timeout");
assert(mapProbeErrorToReasonCode({ status: 503, message: "unavailable" }) === "timeout", "5xx → timeout");

assert(reasonMessage("ok") === "Listo", "ok message");
assert(reasonMessage("missing_key").includes("API key"), "missing_key message");
assert(reasonMessage("billing").includes("créditos") || reasonMessage("billing").includes("cuota"), "billing ES");

console.log(`\n${failed === 0 ? "✅" : "❌"} providerProbes: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
