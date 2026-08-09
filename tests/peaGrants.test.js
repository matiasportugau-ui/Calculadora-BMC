/**
 * PEA grants cap logic (offline).
 * Run: node tests/peaGrants.test.js
 */
import { capGrantLevel } from "../server/lib/pea/grants.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const cfg = { peaMaxGrantLevel: 3 };

assert(capGrantLevel(cfg, 5) === 3, "caps at 3");
assert(capGrantLevel(cfg, 3) === 3, "allows 3");
assert(capGrantLevel(cfg, 2) === 2, "allows below cap");
assert(capGrantLevel({ peaMaxGrantLevel: 5 }, 4) === 4, "respects higher config cap");
assert(capGrantLevel(cfg, -1) === 0, "floors at 0");

console.log(`\npeaGrants: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
