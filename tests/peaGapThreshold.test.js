/**
 * PEA gap analysis threshold (offline).
 * Run: node tests/peaGapThreshold.test.js
 */
import { passesAnalysisThreshold } from "../server/lib/pea/gapEvents.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const cfg = { peaAutoMinOccurrences: 3 };

assert(!passesAnalysisThreshold(cfg, { occurrence_count: 1, severity: "medium" }), "below min occurrences");
assert(!passesAnalysisThreshold(cfg, { occurrence_count: 2, severity: "low" }), "2 < 3");
assert(passesAnalysisThreshold(cfg, { occurrence_count: 3, severity: "medium" }), "at threshold");
assert(passesAnalysisThreshold(cfg, { occurrence_count: 1, severity: "high" }), "high severity bypass");
assert(passesAnalysisThreshold(cfg, { occurrence_count: 1, severity: "critical" }), "critical bypass");
assert(passesAnalysisThreshold(cfg, { occurrence_count: 1, severity: "low" }, { force: true }), "force bypass");

console.log(`\npeaGapThreshold: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
