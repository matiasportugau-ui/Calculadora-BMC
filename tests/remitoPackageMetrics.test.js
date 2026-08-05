/**
 * Ops UX F3b — remito package metrics
 * Run: node tests/remitoPackageMetrics.test.js
 */
import assert from "node:assert/strict";
import { placeCargo, buildStopPackages } from "../src/utils/logistica/cargoPacking.js";
import {
  packageCuboidMetrics,
  buildRemitoPackageRows,
  buildRemitoSimpleModel,
  formatM3,
  stopPackageCodeAt,
} from "../src/utils/logistica/remitoPackageMetrics.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("remitoPackageMetrics");

{
  const c = packageCuboidMetrics({ len: 6, h: 0.96 });
  assert.ok(Math.abs(c.volumeM3 - 6 * 1.2 * 0.96) < 1e-9);
  assert.equal(c.W, 1.2);
  ok("packageCuboidMetrics default width ROW_W");
}

{
  const stop = {
    id: "s1",
    orden: 1,
    cliente: "Acme",
    orderId: "BMC-1",
    paneles: [{ id: "panel-a", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 }],
    accesorios: [],
  };
  const placed = [
    {
      id: "p1",
      sId: "s1",
      stableKey: "s1:panel:panel-a:0",
      tipo: "ISODEC",
      esp: 100,
      n: 8,
      len: 6,
      h: 0.96,
      row: 0,
    },
  ];
  const rows = buildRemitoPackageRows(stop, placed);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, "P1-B1");
  assert.equal(rows[0].fila, "A");
  assert.ok(rows[0].contenido.includes("ISODEC"));
  assert.ok(rows[0].volumeM3 > 0);
  ok("buildRemitoPackageRows");
}

{
  const model = buildRemitoSimpleModel({
    info: { numero: "ENV-1", fecha: "2026-08-05", transportista: "T1", patente: "ABC" },
    truckL: 8,
    stops: [
      {
        id: "s1",
        orden: 1,
        cliente: "Acme",
        orderId: "BMC-1",
        paneles: [{ id: "panel-a", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 }],
        accesorios: [],
      },
    ],
    cargo: {
      placed: [
        {
          id: "p1",
          sId: "s1",
          stableKey: "s1:panel:panel-a:0",
          tipo: "ISODEC",
          esp: 100,
          n: 8,
          len: 6,
          h: 0.96,
          row: 0,
        },
      ],
      rowH: [0.96, 0],
    },
  });
  assert.equal(model.header.numero, "ENV-1");
  assert.equal(model.sections.length, 1);
  assert.equal(model.totals.packages, 1);
  assert.ok(model.totals.cuboidVolumeM3 > 0);
  assert.ok(model.totals.materialVolumeM3 > 0);
  assert.equal(formatM3(1.2), "1.200");
  assert.match(formatM3(model.totals.cuboidVolumeM3), /^\d+\.\d{3}$/);
  ok("buildRemitoSimpleModel totals");
}

{
  // Critical: packing sorts by length → placed order ≠ buildStopPackages order.
  // Remito codes must still match WhatsApp (buildStopPackages index).
  const stop = {
    id: "s1",
    orden: 1,
    cliente: "Acme",
    paneles: [
      { id: "short", tipo: "ISODEC", espesor: 50, longitud: 3, cantidad: 4 },
      { id: "long", tipo: "ISOWALL", espesor: 100, longitud: 8, cantidad: 6 },
    ],
    accesorios: [{ cantidad: 2, descr: "Tornillos" }],
  };
  const stops = [stop];
  const cargo = placeCargo(stops, 8, "balanced");
  const canon = buildStopPackages(stop);
  const waCodes = canon.map((pk, i) => ({
    code: stopPackageCodeAt(stop, i),
    tipo: pk.tipo,
    stableKey: pk.stableKey,
  }));
  assert.equal(waCodes[0].tipo, "ISODEC");
  assert.equal(waCodes[1].tipo, "ISOWALL");
  assert.equal(waCodes[2].tipo, "ACCESORIOS");

  // Packing places longer packages first — opposite of declaration order
  assert.equal(cargo.placed[0].tipo, "ISOWALL");
  assert.notEqual(cargo.placed[0].stableKey, canon[0].stableKey);

  const model = buildRemitoSimpleModel({ stops, cargo });
  const remitoByTipo = Object.fromEntries(
    model.sections[0].packages.map((r) => [r.contenido.includes("Accesorios") ? "ACCESORIOS" : r.contenido.split(" ")[0], r.code]),
  );
  assert.equal(remitoByTipo.ISODEC, "P1-B1", "short panel keeps WA code P1-B1 despite placed last");
  assert.equal(remitoByTipo.ISOWALL, "P1-B2", "long panel keeps WA code P1-B2 despite placed first");
  assert.equal(remitoByTipo.ACCESORIOS, "P1-B3");
  ok("remito codes follow buildStopPackages, not placed order");
}

console.log(`\n${passed} assertions ok`);
