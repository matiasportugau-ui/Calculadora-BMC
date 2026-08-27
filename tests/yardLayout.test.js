/**
 * Run: node tests/yardLayout.test.js
 */
import assert from "node:assert/strict";
import {
  buildYardDump,
  buildYardPlaques,
  countYardPackages,
  clearYardPositions,
  clearYardStop,
  settleYardPlaced,
} from "../src/utils/logistica/yardLayout.js";

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
assert.equal(dump.p1.zBase, 0);
assert.equal(dump.a1.zBase, 0);
assert.ok(dump.a1.xStart > dump.p1.xStart);
assert.equal(dump.p1.lane, 0);
assert.equal(dump.p2.lane, 1);
assert.equal(dump.p1.yardLabel, "A");
assert.equal(countYardPackages(dump), 3);
ok("buildYardDump lanes: floor rows per order");

const stacks = buildYardDump(stops, placed, 8, { layout: "stacks" });
assert.ok(stacks.a1.zBase > stacks.p1.zBase);
ok("stacks layout still piles");

const one = buildYardDump(stops, placed, 8, { stopIds: ["s2"] });
assert.equal(Object.keys(one).length, 1);
assert.equal(one.p2.yardStopId, "s2");
ok("stopIds ejects one order");

const plant = buildYardDump(
  [
    { id: "s1", orden: 1, cliente: "A" },
    { id: "pl", orden: 2, cliente: "Planta", entregaModo: "planta" },
  ],
  [
    ...placed,
    { stableKey: "pp", sId: "pl", kind: "panel", len: 4, h: 0.3, xStart: 0, zBase: 0, row: 0 },
  ],
  8,
);
assert.equal(plant.pp, undefined);
ok("plant pickup skipped");

const cleared = clearYardPositions({ ...dump, truck: { xStart: 1, zBase: 0, row: 0, freeDrag: true, zone: "truck" } });
assert.equal(cleared.p1, undefined);
assert.ok(cleared.truck);
ok("clearYardPositions");

const oneStop = clearYardStop(dump, "s1");
assert.equal(oneStop.p1, undefined);
assert.equal(oneStop.a1, undefined);
assert.ok(oneStop.p2);
ok("clearYardStop keeps other lanes");

const plaques = buildYardPlaques(
  Object.entries(dump).map(([stableKey, pos]) => ({ stableKey, len: 6, ...pos })),
);
assert.equal(plaques.length, 2);
assert.equal(plaques[0].label, "A");
assert.equal(plaques[1].label, "B");
assert.ok(plaques[0].lane < plaques[1].lane);
ok("buildYardPlaques one per order");

{
  const hovering = [
    { stableKey: "low", zone: "yard", lane: 0, xStart: 0, len: 4, h: 0.4, zBase: 1.2 },
    { stableKey: "high", zone: "yard", lane: 0, xStart: 0.2, len: 4, h: 0.3, zBase: 2.5 },
    { stableKey: "truck", zone: "truck", xStart: 0, len: 3, h: 0.5, zBase: 0.8 },
  ];
  const s = settleYardPlaced(hovering);
  const low = s.find((p) => p.stableKey === "low");
  const high = s.find((p) => p.stableKey === "high");
  const truck = s.find((p) => p.stableKey === "truck");
  assert.equal(low.zBase, 0);
  assert.ok(Math.abs(high.zBase - 0.4) < 1e-9);
  assert.equal(truck.zBase, 0.8);
  ok("settleYardPlaced drops hovering stacks onto floor/support");
}

console.log(`\nyardLayout: ${passed} passed`);
