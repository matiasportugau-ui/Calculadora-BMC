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

// Ops UX F5: rowOverrides must survive overflow fallback (no silent flip to other fila)
{
  const heavy = {
    id: "s1",
    orden: 1,
    cliente: "Acme",
    color: "#111",
    paneles: [{ id: "a", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 40 }],
  };
  const auto = placeCargo([heavy], 8, "balanced");
  const last = auto.placed[auto.placed.length - 1];
  assert.ok(last?.stableKey, "auto place yields packages");
  const wantRow = last.row === 0 ? 1 : 0;
  const forced = placeCargo([heavy], 8, "balanced", {
    mode: "manual",
    rowOverrides: { [last.stableKey]: wantRow },
    manualOrderKeys: auto.placed.map((p) => p.stableKey),
  });
  const got = forced.placed.find((p) => p.stableKey === last.stableKey);
  assert.ok(got, "forced package still placed");
  assert.equal(
    got.row,
    wantRow,
    `rowOverrides must place on forced fila even when overflowing (want ${wantRow}, got ${got.row})`,
  );
  ok("rowOverrides honored on overflow");
}

console.log(`\n${passed} assertions ok`);
