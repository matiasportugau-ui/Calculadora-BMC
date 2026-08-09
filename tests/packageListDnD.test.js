/**
 * Envíos F10b — package list reorder
 * Run: node tests/packageListDnD.test.js
 */
import assert from "node:assert/strict";
import {
  reorderManualKeys,
  moveManualKeyBy,
  buildPackageListRows,
} from "../src/utils/logistica/packageListDnD.js";
import { packageBultoCounts } from "../src/utils/logistica/packageIdentity.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("packageListDnD");

{
  assert.deepEqual(reorderManualKeys(["a", "b", "c"], "c", "a"), ["c", "a", "b"]);
  assert.deepEqual(reorderManualKeys(["a", "b"], "a", "b"), ["b", "a"]);
  ok("reorderManualKeys");
}

{
  assert.deepEqual(moveManualKeyBy(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveManualKeyBy(["a", "b", "c"], "a", 1), ["b", "a", "c"]);
  ok("moveManualKeyBy");
}

{
  const placed = [
    { stableKey: "k1", sId: "s1", sCli: "Acme", sPed: "1", row: 0 },
    { stableKey: "k2", sId: "s1", sCli: "Acme", sPed: "1", row: 1 },
  ];
  const counts = packageBultoCounts(placed);
  const rows = buildPackageListRows(placed, counts, ["k2", "k1"]);
  assert.equal(rows[0].stableKey, "k2");
  assert.equal(rows[1].stableKey, "k1");
  assert.equal(rows[0].bultoTotal, 2);
  ok("buildPackageListRows respects manual order");
}

console.log(`packageListDnD: ${passed} passed`);
