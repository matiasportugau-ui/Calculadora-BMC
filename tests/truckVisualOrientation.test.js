/**
 * Orientation contract for TruckVisual cab vs cargo bed.
 * Cargo grows +X from shiftX; truck nose must face −X (away from bed).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/components/logistica/TruckVisual.jsx"), "utf8");

console.log("truckVisualOrientation — nose faces −X");

// Windshield / grille / bumper / headlights must use negative local X (nose)
assert.match(src, /position=\{\[-CAB_LEN \* 0\.32/);
assert.match(src, /position=\{\[-CAB_LEN \* 0\.42/);
assert.match(src, /position=\{\[-CAB_LEN \* 0\.45/);
assert.match(src, /position=\{\[-CAB_LEN \* 0\.46/);

// Must NOT place windshield/grille at +CAB_LEN (toward bed)
assert.doesNotMatch(src, /position=\{\[CAB_LEN \* 0\.32/);
assert.doesNotMatch(src, /position=\{\[CAB_LEN \* 0\.42, 0\.85/);
assert.doesNotMatch(src, /position=\{\[CAB_LEN \* 0\.46/);

// Front axle under nose (cab center − fraction of CAB_LEN)
assert.match(src, /frontAxleX = cabCenterX - CAB_LEN/);

// Explicit contract comment
assert.match(src, /Truck nose \/ front faces −X/);

console.log("truckVisualOrientation — OK");
