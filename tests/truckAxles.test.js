/**
 * Drives shipped axleCount from src/utils/logistica/truckAxles.js
 * (used by TruckVisual for 2 vs 3 axle procedural truck).
 * Run: node tests/truckAxles.test.js
 */
import assert from "node:assert/strict";
import { axleCount } from "../src/utils/logistica/truckAxles.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- real shipped function ---
assert.equal(axleCount(6), 2, "6m → 2 axles");
assert.equal(axleCount(5), 2, "5m → 2 axles");
assert.equal(axleCount(8), 3, "8m → 3 axles");
assert.equal(axleCount(10), 3, "10m → 3 axles");
assert.equal(axleCount(14), 3, "14m → 3 axles");
assert.equal(axleCount(6.01), 3, "just over 6 → 3 axles");

// --- scene must wire TruckVisual (not TruckCabin) ---
const scenePath = path.join(ROOT, "src/components/logistica/LogisticaCargoScene3d.jsx");
const scene = fs.readFileSync(scenePath, "utf8");
assert.match(scene, /import TruckVisual from ["']\.\/TruckVisual\.jsx["']/);
assert.match(scene, /<TruckVisual\s+shiftX=\{shiftX\}\s+truckL=\{truckL\}\s*\/>/);
assert.equal(scene.includes("TruckCabin"), false, "TruckCabin must be removed");
assert.match(scene, /<TruckFloor\b/);
assert.match(scene, /<HeightGuides\b/);
assert.match(scene, /<CargoBox\b/);

// --- TruckVisual uses shipped axle helper + 10s lights ---
const visualPath = path.join(ROOT, "src/components/logistica/TruckVisual.jsx");
const visual = fs.readFileSync(visualPath, "utf8");
assert.match(visual, /from ["'].*truckAxles\.js["']/);
assert.match(visual, /CAB_LIGHTS_MS\s*=\s*10_?000|10_000|10000/);
assert.match(visual, /axleCount\(/);
assert.match(visual, /stopPropagation/);

console.log("truckAxles.test.js OK", {
  axle6: axleCount(6),
  axle8: axleCount(8),
  axle14: axleCount(14),
});
