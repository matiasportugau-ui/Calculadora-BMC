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

console.log(`\n${passed} assertions ok`);
