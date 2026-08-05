/**
 * Shared packing SoT tests (U1)
 * Run: node tests/cargoPacking.test.js
 */
import assert from "node:assert/strict";
import {
  placeCargo,
  buildStopPackages,
  STANDARD_BED_M,
  packageHeightM,
} from "../src/utils/logistica/cargoPacking.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("cargoPacking shared SoT");

const stop = {
  id: "s1",
  orden: 1,
  cliente: "Test",
  color: "#0071e3",
  paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 16 }],
};

// Freight column engine: 16 panels → 2 packages of 8 → one fila (1.92 m ≤ 2.4 m)
{
  const pack = placeCargo([stop], STANDARD_BED_M, { maxH: 2.4 });
  assert.equal(pack.layoutEngine, "column");
  assert.ok(pack.placed.length >= 1, "placed packages");
  assert.equal(pack.filasUsadas, 1, `filas=${pack.filasUsadas} (minimize occupancy)`);
  assert.ok(pack.rowH[0] > 0.001 && pack.rowH[1] <= 0.001, "row B stays empty");
  ok("column engine freight path minimizes filas");
}

// 9 panels: leftover 1-panel pack must stack on used fila, not open B
{
  const nine = {
    ...stop,
    paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 9 }],
  };
  const pack = placeCargo([nine], STANDARD_BED_M, { maxH: 2.4 });
  assert.equal(pack.filasUsadas, 1);
  assert.ok(Math.abs(pack.rowH[0] - 1.08) < 0.001, `rowH0=${pack.rowH[0]}`);
  ok("9 panels stack into one freight fila");
}

// Ops stack engine strategies
{
  const b = placeCargo([stop], 8, "balanced");
  const c = placeCargo([stop], 8, "compact");
  const d = placeCargo([stop], 8, "doorPriority");
  assert.equal(b.layoutEngine, "stack");
  assert.equal(b.strategy, "balanced");
  assert.equal(c.strategy, "compact");
  assert.equal(d.strategy, "doorPriority");
  assert.ok(b.placed.length >= 1 && c.placed.length >= 1 && d.placed.length >= 1);
  assert.ok(Array.isArray(b.stacksByRow) && b.stacksByRow.length === 2);
  // Measurable difference: stack assignment / order fingerprint (not full golden tree)
  const fp = (p) => p.placed.map((x) => `${x.stackId}:${x.layerIndex}:${x.n}`).join(";");
  assert.notEqual(fp(b), fp(c), "balanced vs compact placement fingerprint differs");
  assert.notEqual(fp(b), fp(d), "balanced vs doorPriority fingerprint differs");
  ok("stack strategies produce different placement fingerprints");
}

// buildStopPackages shared
{
  const pkgs = buildStopPackages(stop);
  assert.ok(pkgs.length >= 1);
  assert.ok(pkgs.every((p) => p.stableKey));
  ok("buildStopPackages");
}

// Height helper still SDD-aligned
{
  const h = packageHeightM("ISODEC", 100, 8);
  assert.ok(Math.abs(h - 8 * 0.12) < 0.001);
  ok("packageHeightM ISODEC");
}

// Empty
{
  const pack = placeCargo([], 8, "balanced");
  assert.equal(pack.placed.length, 0);
  assert.equal(pack.cabe, true);
  ok("empty stops");
}

console.log(`\n${passed} assertions ok`);
