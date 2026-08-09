/**
 * PEA outbox / worker pure helpers (offline).
 * Run: node tests/peaOutboxWorker.test.js
 */
import {
  PEA_VERDICTS,
  estimatePreflightUsage,
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

assert(Array.isArray(PEA_VERDICTS) && PEA_VERDICTS.length === 4, "four verdicts");

const usage = estimatePreflightUsage({
  systemPrompt: "PEA worker test",
  gapEvent: { signal_type: "calc_error", error_code: "X" },
  evidence: { files: ["SDD.md"] },
  toolSchemas: { read_file: {} },
  maxOutputTokens: 6000,
  toolRounds: 2,
  retries: 1,
  modelCallsPlanned: 3,
});
assert(usage.totalTokens > 1000, "large iteration estimate");
assert(usage.breakdown.retries === 1, "retries counted");

console.log(`\npeaOutboxWorker: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
