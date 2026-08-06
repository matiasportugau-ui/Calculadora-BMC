/**
 * Ops UX F5 — package layout overrides
 * Run: node tests/packageDrop.test.js
 */
import assert from "node:assert/strict";
import {
  applyPackageRowOverride,
  moveStableKeyBefore,
  ensureManualOrderKeys,
  applyPackageLayoutChange,
  moveRelativeToNeighbor,
  findStackNeighbors,
} from "../src/utils/logistica/packageDrop.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("packageDrop");

assert.deepEqual(applyPackageRowOverride({}, "k1", 1), { k1: 1 });
assert.deepEqual(applyPackageRowOverride({ k1: 1 }, "k1", 0), { k1: 0 });
ok("applyPackageRowOverride");

assert.deepEqual(moveStableKeyBefore(["a", "b", "c"], "c", "a"), ["c", "a", "b"]);
assert.deepEqual(moveStableKeyBefore(["a", "b"], "x", null), ["x", "a", "b"]);
ok("moveStableKeyBefore");

assert.deepEqual(
  ensureManualOrderKeys(["a"], [{ stableKey: "a" }, { stableKey: "b" }]),
  ["a", "b"],
);
ok("ensureManualOrderKeys");

{
  const r = applyPackageLayoutChange({
    rowOverrides: {},
    manualPkgOrderKeys: [],
    stableKey: "pkg1",
    targetRow: 1,
    placed: [{ stableKey: "pkg1" }, { stableKey: "pkg2" }],
  });
  assert.equal(r.cargoLayoutMode, "manual");
  assert.equal(r.rowOverrides.pkg1, 1);
  assert.ok(r.manualPkgOrderKeys.includes("pkg1"));
  ok("applyPackageLayoutChange");
}

{
  const r = moveRelativeToNeighbor({
    keys: ["a", "b", "c"],
    activeKey: "c",
    neighborKey: "a",
    position: "above",
    rowOverrides: { a: 1 },
  });
  assert.deepEqual(r.manualPkgOrderKeys, ["c", "a", "b"]);
  assert.equal(r.rowOverrides.c, 1);
  ok("moveRelativeToNeighbor above + match row");
}

{
  const r = applyPackageLayoutChange({
    stableKey: "x",
    neighborKey: "y",
    stackPosition: "below",
    manualPkgOrderKeys: ["y", "z"],
    rowOverrides: { y: 0 },
    placed: [{ stableKey: "x" }, { stableKey: "y", row: 0 }],
  });
  assert.equal(r.cargoLayoutMode, "manual");
  assert.ok(r.manualPkgOrderKeys.indexOf("x") > r.manualPkgOrderKeys.indexOf("y"));
  assert.equal(r.rowOverrides.x, 0);
  ok("applyPackageLayoutChange stackPosition below");
}

{
  const placed = [
    { stableKey: "low", row: 0, xStart: 0, len: 6, zBase: 0 },
    { stableKey: "mid", row: 0, xStart: 0, len: 6, zBase: 0.9 },
    { stableKey: "hi", row: 0, xStart: 0, len: 6, zBase: 1.8 },
  ];
  const n = findStackNeighbors(placed, placed[1]);
  assert.equal(n.below?.stableKey, "low");
  assert.equal(n.above?.stableKey, "hi");
  ok("findStackNeighbors");
}

console.log(`\n${passed} assertions ok`);
