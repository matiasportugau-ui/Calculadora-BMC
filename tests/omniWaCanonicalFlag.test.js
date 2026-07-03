// omniWaCanonical flag + ingest-mode selector — offline (no DB, no env set)
import { config } from "../server/config.js";
import { chooseWaIngestMode, shouldRunLegacyWaTimer } from "../server/lib/wa/ingestMode.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

assert("flag defaults OFF (ships dormant)", config.omniWaCanonical === false);
assert("wa_crm_sync debounce default 60000ms", config.omniWaCrmSyncDelayMs === 60000);
// Canonical requires the full Omni job pipeline (event bus + orchestrator) so a lead
// is never dropped: canonical alone, with the pipeline off, would silence the legacy
// path while nothing enqueues/drains wa_crm_sync.
const prereqs = { omniEventBusEnabled: true, omniAiOrchestratorEnabled: true };
assert("mode legacy when OFF", chooseWaIngestMode({ omniWaCanonical: false, ...prereqs }) === "legacy");
assert("mode canonical when ON + prereqs", chooseWaIngestMode({ omniWaCanonical: true, ...prereqs }) === "canonical");
assert("canonical WITHOUT event bus → legacy fallback", chooseWaIngestMode({ omniWaCanonical: true, omniEventBusEnabled: false, omniAiOrchestratorEnabled: true }) === "legacy");
assert("canonical WITHOUT orchestrator → legacy fallback", chooseWaIngestMode({ omniWaCanonical: true, omniEventBusEnabled: true, omniAiOrchestratorEnabled: false }) === "legacy");
assert("undefined config → legacy", chooseWaIngestMode(undefined) === "legacy");
assert("legacy timer runs when partial canonical flip falls back", shouldRunLegacyWaTimer({ omniWaCanonical: true, omniEventBusEnabled: false, omniAiOrchestratorEnabled: true }) === true);
assert("legacy timer stops only when canonical pipeline is complete", shouldRunLegacyWaTimer({ omniWaCanonical: true, ...prereqs }) === false);

console.log(`\nomniWaCanonicalFlag: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
