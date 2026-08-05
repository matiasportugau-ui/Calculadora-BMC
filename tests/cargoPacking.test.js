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

// Freight column engine: 16 panels → packages fill one fila when height allows (minimize filasUsadas)
{
  const pack = placeCargo([stop], STANDARD_BED_M, { maxH: 2.4 });
  assert.equal(pack.layoutEngine, "column");
  assert.ok(pack.placed.length >= 1, "placed packages");
  assert.equal(pack.filasUsadas, 1, `expected 1 fila for 16×100mm ISODEC, got ${pack.filasUsadas}`);
  ok("column engine freight path minimizes filasUsadas");
}

// Leftover after first pack stays on used row A (not load-balance open B)
{
  const panels = [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 12 }];
  const pack = placeCargo([{ id: "s1", orden: 1, paneles: panels }], STANDARD_BED_M, { maxH: 2.4 });
  assert.equal(pack.filasUsadas, 1);
  assert.ok(pack.rowH[0] > 0.001);
  assert.ok(pack.rowH[1] <= 0.001);
  ok("column leftover packs stay on used fila");
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

// Ops UX F4: sPed + sCli on placed meta
{
  const s = {
    id: "sx",
    orden: 2,
    cliente: "Cliente X",
    orderId: "BMC-99",
    color: "#0071e3",
    paneles: [{ id: "p", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 4 }],
  };
  const pkgs = buildStopPackages(s);
  assert.equal(pkgs[0].sCli, "Cliente X");
  assert.equal(pkgs[0].sPed, "BMC-99");
  ok("buildPkgs carries sCli and sPed");
}

// F5: forced rowOverrides honored on overflow placement
{
  const s = {
    id: "s1",
    orden: 1,
    cliente: "Force",
    color: "#0071e3",
    paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 12, cantidad: 40 }],
  };
  const pkgs = buildStopPackages(s);
  assert.ok(pkgs.length >= 1);
  const key = pkgs[0].stableKey;
  const pack = placeCargo([s], 8, "balanced", {
    rowOverrides: { [key]: 1 },
    mode: "manual",
    manualOrderKeys: pkgs.map((p) => p.stableKey),
  });
  const first = pack.placed.find((p) => p.stableKey === key) || pack.placed[0];
  assert.equal(first.row, 1, `expected forced fila B, got row=${first.row}`);
  ok("rowOverrides forced fila B honored (incl. overflow path)");
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
