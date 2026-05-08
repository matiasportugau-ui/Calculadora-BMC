// F5 — Tests for waGap signal in trainingKB.js (mirror of mlGap).
//
// Validates that:
//   - getHealthEntries() returns a `waGap` array of entries needing a WA override.
//   - getTrainingStats().health includes a numeric `waGap`.
//   - Both new shapes (responses.whatsapp / responses.mercado_libre) AND legacy
//     fields (goodAnswerWA / goodAnswerML) count as "has override".
//
// Hits the live KB (data/training-kb.json) for shape + non-negativity, and
// verifies the override-detection logic via direct invariants.
//
// Run: node tests/waGap.test.js

import { getHealthEntries, getTrainingStats } from "../server/lib/trainingKB.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

group("getHealthEntries — waGap exposed", () => {
  const h = getHealthEntries();
  assert(Array.isArray(h.waGap), "waGap is an array");
  assert(Array.isArray(h.mlGap), "mlGap still present (no regression)");
  // Every waGap entry must have goodAnswer > 700 chars and no WA override.
  for (const e of h.waGap) {
    assert((e.goodAnswer || "").length > 700, `entry ${e.id}: goodAnswer > 700 chars`);
    const hasOverride = !!(e.responses?.whatsapp) || !!e.goodAnswerWA;
    assert(!hasOverride, `entry ${e.id}: no WA override`);
  }
});

group("getHealthEntries — mlGap mirrors waGap shape", () => {
  const h = getHealthEntries();
  for (const e of h.mlGap) {
    assert((e.goodAnswer || "").length > 350, `entry ${e.id}: goodAnswer > 350 chars`);
    const hasOverride = !!(e.responses?.mercado_libre) || !!e.goodAnswerML;
    assert(!hasOverride, `entry ${e.id}: no ML override`);
  }
});

group("getTrainingStats — health.waGap is a non-negative integer", () => {
  const s = getTrainingStats();
  assert(typeof s.health.waGap === "number", "health.waGap is number");
  assert(Number.isInteger(s.health.waGap), "health.waGap is integer");
  assert(s.health.waGap >= 0, "health.waGap >= 0");
  // mlGap still works
  assert(typeof s.health.mlGap === "number", "health.mlGap still number");
});

group("getTrainingStats — score factors waGap into the formula", () => {
  const s = getTrainingStats();
  // Score formula: max(0, 100 - stale*5 - zeroRetrieval*2 - mlGap*3 - waGap*2)
  const expected = Math.max(0,
    100 - s.health.stale * 5 - s.health.zeroRetrieval * 2 - s.health.mlGap * 3 - s.health.waGap * 2);
  assert(s.health.score === expected, `score = ${expected} (got ${s.health.score})`);
});

group("getHealthEntries — counts match getTrainingStats counts", () => {
  const h = getHealthEntries();
  const s = getTrainingStats();
  assert(h.waGap.length === s.health.waGap, "health.waGap count = getHealthEntries waGap.length");
  assert(h.mlGap.length === s.health.mlGap, "health.mlGap count = getHealthEntries mlGap.length");
  assert(h.stale.length === s.health.stale, "health.stale count = getHealthEntries stale.length");
});

console.log(`\nwaGap: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
