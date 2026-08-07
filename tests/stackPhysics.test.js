/**
 * Run: node tests/stackPhysics.test.js
 */
import assert from "node:assert/strict";
import {
  isBuried,
  findPackagesAbove,
  canStartDrag,
  checkLengthOnShorter,
  toggleMultiSelect,
  findSupportUnder,
  BURIED_TOAST_ES,
} from "../src/utils/logistica/stackPhysics.js";

let passed = 0;
function ok(n) {
  passed += 1;
  console.log(`  ✓ ${n}`);
}

console.log("stackPhysics");

const placed = [
  { stableKey: "a", id: "a", xStart: 0, len: 6, zBase: 0, h: 0.5, row: 0, stackId: "R1-S1" },
  { stableKey: "b", id: "b", xStart: 0, len: 6, zBase: 0.5, h: 0.4, row: 0, stackId: "R1-S1" },
  { stableKey: "c", id: "c", xStart: 7, len: 4, zBase: 0, h: 0.3, row: 1, stackId: "R2-S1" },
];

assert.equal(isBuried(placed, placed[0]), true);
assert.equal(isBuried(placed, placed[1]), false);
assert.equal(findPackagesAbove(placed, placed[0]).length, 1);
ok("buried detection");

{
  const no = canStartDrag(placed, placed[0], []);
  assert.equal(no.ok, false);
  assert.ok(no.message.includes("arriba") || no.message === BURIED_TOAST_ES);
  const yes = canStartDrag(placed, placed[0], ["a", "b"]);
  assert.equal(yes.ok, true);
  ok("canStartDrag multi-select");
}

{
  const soft = checkLengthOnShorter({ len: 7 }, 6);
  assert.equal(soft.ok, false);
  assert.equal(soft.soft, true);
  assert.ok(soft.message.includes("limitante física"));
  assert.equal(checkLengthOnShorter({ len: 5 }, 6).ok, true);
  ok("length on shorter");
}

assert.deepEqual(toggleMultiSelect(["a"], "b", true), ["a", "b"]);
assert.deepEqual(toggleMultiSelect(["a", "b"], "a", true), ["b"]);
assert.deepEqual(toggleMultiSelect(["a", "b"], "c", false), ["c"]);
ok("toggleMultiSelect");

{
  const sup = findSupportUnder(placed, { xStart: 0, len: 7, row: 0, zBase: 0.9, stableKey: "new" });
  assert.ok(sup.supportPkg);
  assert.equal(sup.supportLen, 6);
  ok("findSupportUnder");
}

console.log(`\nstackPhysics: ${passed} passed`);
