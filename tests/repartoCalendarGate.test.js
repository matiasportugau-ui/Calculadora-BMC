/**
 * Nº de Reparto calendar-day + sequence clamp.
 * Complementary to orphan tests/repartoNumber.test.js (still not in test:core).
 * Run: node tests/repartoCalendarGate.test.js
 */
import assert from "node:assert/strict";
import {
  calendarDateKeyFromDb,
  formatRepartoNo,
  parseRepartoNo,
  nextRepartoSeq,
  allocateRepartoNo,
  repartoDateKey,
} from "../src/utils/logistica/repartoNumber.js";

console.log("repartoCalendarGate");

{
  // node-pg DATE arrives as UTC midnight for that calendar day.
  assert.equal(calendarDateKeyFromDb(new Date("2026-08-01T00:00:00.000Z")), "2026-08-01");
  assert.equal(calendarDateKeyFromDb(new Date("2026-01-01T00:00:00.000Z")), "2026-01-01");
  assert.equal(calendarDateKeyFromDb("2026-09-04"), "2026-09-04");
  assert.equal(calendarDateKeyFromDb("2026-09-04T12:30:00.000Z"), "2026-09-04");
  assert.equal(calendarDateKeyFromDb(""), null);
  assert.equal(calendarDateKeyFromDb(null), null);
  assert.equal(calendarDateKeyFromDb(undefined), null);
  assert.equal(calendarDateKeyFromDb(new Date("not-a-date")), null);
  assert.equal(calendarDateKeyFromDb({}), null);
  // Wall-clock helper shifts UTC-midnight DATE in America/Montevideo (UY −3).
  assert.equal(repartoDateKey(new Date("2026-08-01T00:00:00.000Z")), "2026-07-31");
  console.log("  ✓ calendar DATE keeps the day; wall-clock must not be used for pg DATE");
}

{
  assert.equal(formatRepartoNo("2026-09-04", 1), "REP-2026-09-04-001");
  assert.equal(formatRepartoNo("2026-09-04", 0), "REP-2026-09-04-001");
  assert.equal(formatRepartoNo("2026-09-04", Number.NaN), "REP-2026-09-04-001");
  assert.equal(formatRepartoNo("2026-09-04", 1000), "REP-2026-09-04-999");
  assert.deepEqual(parseRepartoNo("rep-2026-09-04-007"), { ymd: "2026-09-04", seq: 7 });
  assert.equal(parseRepartoNo(""), null);
  assert.equal(parseRepartoNo("REP-2026-09-04-007-extra"), null);
  assert.equal(parseRepartoNo("REP-2026-9-4-007"), null);
  console.log("  ✓ format clamp + parse fail-closed");
}

{
  const day = "2026-09-04";
  const mixed = ["REP-2026-09-03-099", "REP-2026-09-04-002", "not-a-rep", "REP-2026-09-04-011"];
  assert.equal(nextRepartoSeq(mixed, day), 12);
  assert.equal(allocateRepartoNo(mixed, day), "REP-2026-09-04-012");
  assert.equal(nextRepartoSeq(["REP-2026-09-03-099"], day), 1);
  // Current clamp: seq 1000 formats as 999 — pin, do not "fix" to wrap/year-rollover.
  assert.equal(nextRepartoSeq(["REP-2026-09-04-999"], day), 1000);
  assert.equal(allocateRepartoNo(["REP-2026-09-04-999"], day), "REP-2026-09-04-999");
  console.log("  ✓ allocate ignores other days; 999 clamp stays 999 (current)");
}

console.log("repartoCalendarGate OK");
