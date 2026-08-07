import assert from "node:assert/strict";
import {
  formatRepartoNo,
  parseRepartoNo,
  nextRepartoSeq,
  allocateRepartoNo,
  repartoDateKey,
} from "../src/utils/logistica/repartoNumber.js";

let n = 0;
function ok(m) {
  n += 1;
  console.log(`  ✓ ${m}`);
}

console.log("repartoNumber");

assert.equal(formatRepartoNo("2026-08-07", 1), "REP-2026-08-07-001");
assert.equal(formatRepartoNo("2026-08-07", 12), "REP-2026-08-07-012");
assert.deepEqual(parseRepartoNo("REP-2026-08-07-003"), { ymd: "2026-08-07", seq: 3 });
assert.equal(parseRepartoNo("nope"), null);
ok("format/parse");

assert.equal(nextRepartoSeq(["REP-2026-08-07-001", "REP-2026-08-07-003"], "2026-08-07"), 4);
assert.equal(nextRepartoSeq(["REP-2026-08-06-009"], "2026-08-07"), 1);
assert.equal(allocateRepartoNo(["REP-2026-08-07-002"], "2026-08-07"), "REP-2026-08-07-003");
ok("allocate sequence");

assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(repartoDateKey()));
ok("date key");

console.log(`\nrepartoNumber: ${n} passed`);
