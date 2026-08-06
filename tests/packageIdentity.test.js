/**
 * Envíos F8 — package identity labels
 * Run: node tests/packageIdentity.test.js
 */
import assert from "node:assert/strict";
import {
  packageGroupKey,
  packageBultoCounts,
  packageLabelCompact,
  packageLabelTiny,
  highlightKeysForPackage,
} from "../src/utils/logistica/packageIdentity.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("packageIdentity");

const placed = [
  { id: "1", stableKey: "a1", sId: "s1", sCli: "Acme", sPed: "BMC-1", zBase: 0, xStart: 0, len: 6 },
  { id: "2", stableKey: "a2", sId: "s1", sCli: "Acme", sPed: "BMC-1", zBase: 0.96, xStart: 0, len: 6 },
  { id: "3", stableKey: "b1", sId: "s2", sCli: "Beta", sPed: "BMC-2", zBase: 0, xStart: 2, len: 5 },
];

{
  assert.equal(packageGroupKey(placed[0]), "stop:s1");
  assert.equal(packageGroupKey(placed[2]), "stop:s2");
  ok("packageGroupKey prefers stop id");
}

{
  const counts = packageBultoCounts(placed);
  assert.equal(counts.get("a1").index, 1);
  assert.equal(counts.get("a1").total, 2);
  assert.equal(counts.get("a2").index, 2);
  assert.equal(counts.get("a2").total, 2);
  assert.equal(counts.get("b1").total, 1);
  ok("packageBultoCounts per stop");
}

{
  const counts = packageBultoCounts(placed);
  const label = packageLabelCompact(placed[1], counts);
  assert.ok(label.startsWith("2/2"));
  assert.ok(label.includes("#BMC-1"));
  assert.ok(label.includes("Acme"));
  ok("packageLabelCompact");
}

{
  const tiny = packageLabelTiny(placed[0], packageBultoCounts(placed), 20);
  assert.ok(tiny.length <= 20);
  ok("packageLabelTiny maxLen");
}

{
  const keys = highlightKeysForPackage(placed, placed[0]);
  assert.equal(keys.has("a1"), true);
  assert.equal(keys.has("a2"), true);
  assert.equal(keys.has("b1"), false);
  ok("highlightKeysForPackage client group");
}

{
  const fallback = packageLabelCompact({ sOrd: 3, n: 4, kind: "panel" });
  assert.ok(fallback.includes("P3"));
  ok("fallback without cli/ped");
}

console.log(`packageIdentity: ${passed} passed`);
