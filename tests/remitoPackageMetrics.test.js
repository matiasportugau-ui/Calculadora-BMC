/**
 * Ops UX F3b — remito package metrics
 * Run: node tests/remitoPackageMetrics.test.js
 */
import assert from "node:assert/strict";
import {
  packageCuboidMetrics,
  buildRemitoPackageRows,
  buildRemitoSimpleModel,
  formatM3,
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
    paneles: [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 }],
    accesorios: [],
  };
  const placed = [
    { id: "p1", sId: "s1", tipo: "ISODEC", esp: 100, n: 8, len: 6, h: 0.96, row: 0 },
  ];
  const rows = buildRemitoPackageRows(stop, placed, (s, i) => `P${s.orden}-B${i + 1}`);
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
        paneles: [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 }],
        accesorios: [],
      },
    ],
    cargo: {
      placed: [{ id: "p1", sId: "s1", tipo: "ISODEC", esp: 100, n: 8, len: 6, h: 0.96, row: 0 }],
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

console.log(`\n${passed} assertions ok`);
