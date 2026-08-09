/**
 * PEA ratchet gate (offline).
 * Run: node tests/peaRatchetGate.test.js
 */
import {
  CLOSEOUT_RATCHET_TYPES,
  normalizeRatchetLinks,
  validateRatchetLinks,
} from "../server/lib/pea/ratchetGate.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

assert(CLOSEOUT_RATCHET_TYPES.has("golden"), "golden is closeout type");
assert(!CLOSEOUT_RATCHET_TYPES.has("kb_entry"), "kb_entry not closeout in M2c");

const empty = validateRatchetLinks([]);
assert(!empty.ok, "empty links rejected");
assert(empty.failures.includes("ratchet_links_empty"), "empty failure code");

const badType = validateRatchetLinks([{ type: "kb_entry", path: "docs/x.md" }]);
assert(!badType.ok, "kb_entry alone rejected");

const good = validateRatchetLinks([
  { type: "golden", path: "tests/peaGapFingerprint.test.js", description: "dedupe stable" },
]);
assert(good.ok, "valid golden link accepted");
assert(good.links.length === 1, "one normalized link");

const descOnly = validateRatchetLinks([
  { type: "fitness_sensor", description: "sensor en gate:local para PEA" },
]);
assert(descOnly.ok, "description-only ok if long enough");

const shortDesc = validateRatchetLinks([{ type: "rule_provenance", description: "short" }]);
assert(!shortDesc.ok, "short desc without path rejected");

const normalized = normalizeRatchetLinks([{ artifact_type: "golden", path: " tests/x.js " }]);
assert(normalized[0].type === "golden" && normalized[0].path === "tests/x.js", "normalize artifact_type");

console.log(`\npeaRatchetGate: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
