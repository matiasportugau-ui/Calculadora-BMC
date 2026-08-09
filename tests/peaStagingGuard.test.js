/**
 * Staging guard + environment (offline).
 */
import {
  assertImplementEnvironment,
  getEnvironmentInfo,
  validateStagingConfigIsolation,
} from "../server/lib/pea/stagingGuard.js";
import { buildImplementGoalPrompt } from "../server/lib/pea/implementer/manualAdapter.js";

let passed = 0;
let failed = 0;
function assert(c, l) { if (c) passed++; else { failed++; console.error(`  ✗ ${l}`); } }

const devCfg = { appEnv: "development", peaImplementEnabled: true, databaseUrl: "postgres://x" };
const prodCfg = { appEnv: "production", peaImplementEnabled: true, publicBaseUrl: "https://x.run.app" };

assert(getEnvironmentInfo(devCfg).implement_allowed, "dev implement allowed when enabled");
assert(!assertImplementEnvironment(prodCfg).ok, "prod implement blocked");
assert(validateStagingConfigIsolation({ appEnv: "development" }).skipped, "dev isolation skipped");

const prompt = buildImplementGoalPrompt(
  { id: "p1", primary_lane: "H", diagnosis: "test", recommended_changes: [], ratchet_plan: {} },
  { id: "g1", signal_type: "tool_fail", fingerprint: "abc" },
);
assert(prompt.includes("tool_fail"), "manual prompt includes signal");

console.log(`\npeaStagingGuard: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
