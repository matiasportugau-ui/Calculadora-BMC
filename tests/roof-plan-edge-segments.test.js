import assert from "node:assert/strict";
import { buildZoneBorderExteriorIntervals } from "../src/utils/roofPlanEdgeSegments.js";

let n = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  n += 1;
  console.log(`  ✓ ${msg}`);
}

console.log("roof-plan-edge-segments.test.js");

{
  // T: lower body 8.96 × 6, upper body 5.6 × 6 sitting on the top-right of the lower.
  const lower = { gi: 0, x: 0, y: 6, w: 8.96, h: 6, z: {} };
  const upper = { gi: 1, x: 3.36, y: 0, w: 5.6, h: 6, z: {} };
  const zonas = [{}, {}];
  const iv = buildZoneBorderExteriorIntervals([lower, upper], zonas);

  const topLower = iv[0].top;
  const sharedGone = !topLower.some(([a, b]) => a < 3.36 + 0.05 && b > 8.96 - 0.05);
  ok(sharedGone, "lower top is not one full 8.96 strip");
  ok(topLower.length >= 1, "lower top still has an exterior stub");
  const stub = topLower.find(([a, b]) => Math.abs(a - 0) < 0.05 && Math.abs(b - 3.36) < 0.08);
  ok(Boolean(stub), `lower top stub is 0–3.36 (got ${JSON.stringify(topLower)})`);

  const botUpper = iv[1].bottom;
  ok(botUpper.length === 0, `upper bottom fully encuentro (got ${JSON.stringify(botUpper)})`);
}

console.log(`roof-plan-edge-segments: ${n} passed`);
