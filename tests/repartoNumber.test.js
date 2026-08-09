import assert from "node:assert/strict";
import {
  formatRepartoNo,
  parseRepartoNo,
  nextRepartoSeq,
  allocateRepartoNo,
  repartoDateKey,
  calendarDateKeyFromDb,
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

// node-pg DATE → UTC midnight must keep calendar day (not Montevideo -1 day)
assert.equal(calendarDateKeyFromDb(new Date("2026-08-01T00:00:00.000Z")), "2026-08-01");
assert.equal(calendarDateKeyFromDb(new Date("2026-01-01T00:00:00.000Z")), "2026-01-01");
assert.equal(calendarDateKeyFromDb("2026-08-07"), "2026-08-07");
assert.equal(calendarDateKeyFromDb("2026-08-07T00:00:00.000Z"), "2026-08-07");
assert.equal(calendarDateKeyFromDb(null), null);
// Contrast: wall-clock helper shifts UTC-midnight DATE in UY
assert.equal(repartoDateKey(new Date("2026-08-01T00:00:00.000Z")), "2026-07-31");
ok("calendarDateKeyFromDb vs wall-clock");

console.log(`\nrepartoNumber: ${n} passed`);
