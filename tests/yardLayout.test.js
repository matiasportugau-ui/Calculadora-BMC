/**
 * Run: node tests/yardLayout.test.js
 */
import assert from "node:assert/strict";
import { buildYardDump, countYardPackages, clearYardPositions } from "../src/utils/logistica/yardLayout.js";

let passed = 0;
function ok(n) {
  passed += 1;
  console.log(`  ✓ ${n}`);
}

console.log("yardLayout");

const stops = [
  { id: "s1", orden: 1, cliente: "A" },
  { id: "s2", orden: 2, cliente: "B" },
];
const placed = [
  { stableKey: "p1", sId: "s1", kind: "panel", len: 6, h: 0.5, xStart: 0, zBase: 0, row: 0 },
  { stableKey: "a1", sId: "s1", kind: "accessory", len: 6, h: 0.2, xStart: 0, zBase: 0.5, row: 0 },
  { stableKey: "p2", sId: "s2", kind: "panel", len: 5, h: 0.4, xStart: 2, zBase: 0, row: 1 },
];

const dump = buildYardDump(stops, placed, 8);
assert.equal(Object.keys(dump).length, 3);
assert.equal(dump.p1.zone, "yard");
assert.equal(dump.a1.yardStopId, "s1");
assert.equal(dump.p2.yardStopId, "s2");
// same stop stacked: accessory above panel
assert.ok(dump.a1.zBase > dump.p1.zBase);
// different stops separated (different x or row)
assert.ok(dump.p1.xStart !== dump.p2.xStart || dump.p1.row !== dump.p2.row);
assert.equal(countYardPackages(dump), 3);
ok("buildYardDump separates orders");

const cleared = clearYardPositions({ ...dump, truck: { xStart: 1, zBase: 0, row: 0, freeDrag: true, zone: "truck" } });
assert.equal(cleared.p1, undefined);
assert.ok(cleared.truck);
ok("clearYardPositions");

console.log(`\nyardLayout: ${passed} passed`);
