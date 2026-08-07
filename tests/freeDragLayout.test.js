/**
 * Free-Drag layout overrides
 * Run: node tests/freeDragLayout.test.js
 */
import assert from "node:assert/strict";
import {
  normalizeFreePosition,
  normalizeFreePositionsMap,
  setFreePosition,
  clearFreePosition,
  applyFreePositionsToCargo,
  freePositionFromPkg,
} from "../src/utils/logistica/freeDragLayout.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("freeDragLayout");

assert.equal(normalizeFreePosition(null), null);
assert.deepEqual(normalizeFreePosition({ xStart: 1.5, zBase: 0.4, row: 1 }), {
  xStart: 1.5,
  zBase: 0.4,
  row: 1,
  freeDrag: true,
});
ok("normalizeFreePosition");

{
  const m = normalizeFreePositionsMap({
    a: { xStart: 0, zBase: 0, row: 0 },
    b: { xStart: "nope", zBase: 1 },
  });
  assert.ok(m.a);
  assert.equal(m.b, undefined);
  ok("normalizeFreePositionsMap drops invalid");
}

{
  const m = setFreePosition({}, "k1", { xStart: 2, zBase: 0.5, row: 1, len: 6 }, { truckL: 8, maxH: 2.5 });
  assert.equal(m.k1.row, 1);
  assert.equal(m.k1.xStart, 2);
  const cleared = clearFreePosition(m, "k1");
  assert.equal(cleared.k1, undefined);
  ok("set/clear free position");
}

{
  const cargo = {
    maxH: 2.5,
    placed: [
      {
        id: "p1",
        stableKey: "sk1",
        kind: "panel",
        len: 6,
        h: 0.5,
        xStart: 0,
        xEnd: 6,
        zBase: 0,
        row: 0,
        stackId: "R1-S1",
      },
    ],
    rowH: [0.5, 0],
  };
  const next = applyFreePositionsToCargo(cargo, {
    sk1: { xStart: 1.2, zBase: 0.8, row: 1 },
  });
  assert.equal(next.placed[0].xStart, 1.2);
  assert.equal(next.placed[0].zBase, 0.8);
  assert.equal(next.placed[0].row, 1);
  assert.equal(next.placed[0].freeDrag, true);
  assert.equal(next.freeDragCount, 1);
  assert.ok(next.rowH[1] >= 1.3);
  ok("applyFreePositionsToCargo");
}

{
  const fp = freePositionFromPkg({ xStart: 3, zBase: 0.2, row: 0 });
  assert.equal(fp.xStart, 3);
  ok("freePositionFromPkg");
}

console.log(`\nfreeDragLayout: ${passed} passed`);
