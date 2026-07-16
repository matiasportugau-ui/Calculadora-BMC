import test from "node:test";
import assert from "node:assert/strict";

import {
  ROOF_3D_FLAT_PITCH_SENTINEL,
  normalizeRoof3dScenePendiente,
} from "../src/utils/roof3dScenePendiente.js";

test("flat roof pitch bypasses the scene's falsy 15-degree fallback", () => {
  assert.equal(normalizeRoof3dScenePendiente(0), ROOF_3D_FLAT_PITCH_SENTINEL);
  assert.equal(normalizeRoof3dScenePendiente("0"), ROOF_3D_FLAT_PITCH_SENTINEL);
  assert.notEqual(normalizeRoof3dScenePendiente(0), 0);
});

test("valid positive roof pitches pass through unchanged", () => {
  assert.equal(normalizeRoof3dScenePendiente(0.01), 0.01);
  assert.equal(normalizeRoof3dScenePendiente(15), 15);
  assert.equal(normalizeRoof3dScenePendiente("5"), "5");
});

test("missing, invalid, and negative pitches degrade to the flat sentinel", () => {
  for (const value of [undefined, null, "", "not-a-number", -5]) {
    assert.equal(
      normalizeRoof3dScenePendiente(value),
      ROOF_3D_FLAT_PITCH_SENTINEL,
      `expected ${String(value)} to use the flat sentinel`,
    );
  }
});
