// omniWaCanonical flag + ingest-mode selector — offline (no DB, no env set)
import { config } from "../server/config.js";
import { chooseWaIngestMode } from "../server/lib/wa/ingestMode.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

assert("flag defaults OFF (ships dormant)", config.omniWaCanonical === false);
assert("wa_crm_sync debounce default 60000ms", config.omniWaCrmSyncDelayMs === 60000);
assert("mode legacy when OFF", chooseWaIngestMode({ omniWaCanonical: false }) === "legacy");
assert("mode canonical when ON", chooseWaIngestMode({ omniWaCanonical: true }) === "canonical");
assert("undefined config → legacy", chooseWaIngestMode(undefined) === "legacy");

console.log(`\nomniWaCanonicalFlag: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
