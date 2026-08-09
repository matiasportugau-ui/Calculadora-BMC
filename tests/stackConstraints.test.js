/**
 * Stack physical constraints — panels never on profiles
 * Run: node tests/stackConstraints.test.js
 */
import assert from "node:assert/strict";
import {
  isPanelPkg,
  isAccessoryPkg,
  isProfileSupportPkg,
  canPlaceOnTop,
  canPlaceOnStack,
  validatePlacedStacks,
  accessoryPlacementBias,
  PANEL_ON_PROFILE_REJECT_ES,
} from "../src/utils/logistica/stackConstraints.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("stackConstraints");

assert.equal(isPanelPkg({ kind: "panel" }), true);
assert.equal(isPanelPkg({ kind: "accessory" }), false);
assert.equal(isAccessoryPkg({ kind: "accessory" }), true);
assert.equal(isAccessoryPkg({ tipo: "ACCESORIOS" }), true);
assert.equal(isProfileSupportPkg({ kind: "accessory" }), true);
ok("kind classifiers");

assert.equal(canPlaceOnTop({ kind: "panel" }, { kind: "panel" }), true);
assert.equal(canPlaceOnTop({ kind: "accessory" }, { kind: "panel" }), true);
assert.equal(canPlaceOnTop({ kind: "accessory" }, { kind: "accessory" }), true);
assert.equal(canPlaceOnTop({ kind: "panel" }, { kind: "accessory" }), false);
assert.equal(canPlaceOnTop({ kind: "panel" }, null), true);
ok("canPlaceOnTop panel-on-profile forbidden");

assert.equal(
  canPlaceOnStack({ kind: "panel" }, { items: [{ kind: "accessory" }] }),
  false,
);
assert.equal(
  canPlaceOnStack({ kind: "panel" }, { items: [{ kind: "panel" }] }),
  true,
);
assert.equal(canPlaceOnStack({ kind: "panel" }, { items: [] }), true);
ok("canPlaceOnStack");

{
  const okLayout = validatePlacedStacks([
    { stableKey: "p1", kind: "panel", stackId: "R1-S1", layerIndex: 0, zBase: 0, row: 0 },
    { stableKey: "a1", kind: "accessory", stackId: "R1-S1", layerIndex: 1, zBase: 1, row: 0 },
  ]);
  assert.equal(okLayout.ok, true);
  assert.equal(okLayout.violations.length, 0);
  ok("validate: accessory on panel OK");
}

{
  const bad = validatePlacedStacks([
    { stableKey: "a1", kind: "accessory", stackId: "R1-S1", layerIndex: 0, zBase: 0, row: 0 },
    { stableKey: "p1", kind: "panel", stackId: "R1-S1", layerIndex: 1, zBase: 0.2, row: 0 },
  ]);
  assert.equal(bad.ok, false);
  assert.equal(bad.violations[0].code, "panel_on_profile");
  assert.ok(bad.violations[0].message.includes("perfiles") || bad.violations[0].message === PANEL_ON_PROFILE_REJECT_ES);
  ok("validate: panel on profile violates");
}

{
  const sideBySide = validatePlacedStacks([
    { stableKey: "p1", kind: "panel", stackId: "R1-S1", layerIndex: 0, zBase: 0, row: 0 },
    { stableKey: "a1", kind: "accessory", stackId: "R1-S2", layerIndex: 0, zBase: 0, row: 0 },
    { stableKey: "p2", kind: "panel", stackId: "R1-S3", layerIndex: 0, zBase: 0, row: 0 },
  ]);
  assert.equal(sideBySide.ok, true);
  ok("validate: profile between longitudinal stacks OK");
}

{
  const otherRow = validatePlacedStacks([
    { stableKey: "p1", kind: "panel", stackId: "R1-S1", layerIndex: 0, zBase: 0, row: 0 },
    { stableKey: "a1", kind: "accessory", stackId: "R2-S1", layerIndex: 0, zBase: 0, row: 1 },
  ]);
  assert.equal(otherRow.ok, true);
  ok("validate: profile other row OK");
}

{
  const biasExisting = accessoryPlacementBias({ type: "existing", stackHeightAfter: 1.5 }, { kind: "accessory" });
  const biasNew = accessoryPlacementBias({ type: "new" }, { kind: "accessory" });
  assert.ok(biasExisting[0] < biasNew[0], "existing tall preferred over new for ACC");
  assert.deepEqual(accessoryPlacementBias({ type: "existing" }, { kind: "panel" }), [0]);
  ok("accessoryPlacementBias");
}

console.log(`\nstackConstraints: ${passed} passed`);
