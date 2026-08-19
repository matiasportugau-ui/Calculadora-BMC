/**
 * Combinada fastener grid — perimeter rows are 2 dots/panel, interior 1.
 * Wrong counts bill the wrong varilla/tuerca SKUs.
 * Run: node tests/combinadaApoyoPts.test.js
 */
import assert from "node:assert/strict";
import {
  countPtsFromApoyoMateriales,
  apoyoMaterialsToDotsByKey,
  buildDefaultApoyoMateriales,
} from "../src/utils/combinadaFijacionShared.js";

console.log("\n— combinadaApoyoPts\n");

// 3 apoyos × 4 paneles: peri 8 + interior 4 + peri 8
assert.deepEqual(
  countPtsFromApoyoMateriales(["hormigon", "metal", "madera"], 4),
  { ptsHorm: 8, ptsMetal: 4, ptsMadera: 8 },
);

// cantPaneles <= 0 falls back to 1 panel
assert.deepEqual(
  countPtsFromApoyoMateriales(["metal", "metal"], 0),
  { ptsHorm: 0, ptsMetal: 4, ptsMadera: 0 },
);

// 2 rows: BOTH are perimeter (first and last). Unknown mat → metal.
assert.deepEqual(
  countPtsFromApoyoMateriales(["steel", "hormigon"], 2),
  { ptsHorm: 4, ptsMetal: 4, ptsMadera: 0 },
);

assert.deepEqual(buildDefaultApoyoMateriales(3), ["metal", "metal", "metal"]);
assert.deepEqual(buildDefaultApoyoMateriales(1, "hormigon"), ["hormigon", "hormigon"]);
assert.deepEqual(buildDefaultApoyoMateriales(0), ["metal", "metal"]);

const dots = [
  { key: "a", rowIndex: 0 },
  { key: "b", rowIndex: 1 },
  { key: "c", rowIndex: 9 },
];
assert.deepEqual(
  apoyoMaterialsToDotsByKey(dots, ["hormigon", "madera"]),
  { a: "hormigon", b: "madera", c: "metal" },
);

console.log("combinadaApoyoPts: ok");
