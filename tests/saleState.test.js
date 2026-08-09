/**
 * saleState pure helpers — concurrent Entregado row identity + terminal/strip guards.
 * Run: node tests/saleState.test.js
 *
 * Drives shipped src/utils/logistica/saleState.js (no reimplementation).
 */
import assert from "node:assert/strict";
import {
  stripLogisticaMarkers,
  ventasRowIdentityFingerprint,
  findSheetRow1BasedByFingerprint,
  isTerminalSaleStatus,
  TERMINAL_SALE_STATUSES,
  buildEstadoSheetValue,
  classifySaleStatus,
  saleStatusChipCaption,
} from "../src/utils/logistica/saleState.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

/** Build a row using default fingerprint indices: orderId=2, nombre=8, dir=9, tel=15 */
function rowWithIdentity({ orderId, nombre, tel, dir, estado = "" }) {
  const cells = Array(20).fill("");
  cells[2] = orderId;
  cells[8] = nombre;
  cells[9] = dir;
  cells[15] = tel;
  cells[5] = estado; // ESTADO GRAL (ignored by fingerprint)
  return cells;
}

console.log("saleState");

{
  const c = classifySaleStatus({ fechaEntrega: "2026-05-22", estadoText: "Pago 50%" });
  assert.equal(c.status, "coordinado");
  assert.match(saleStatusChipCaption(c), /Coordinado/);
  ok("classifySaleStatus coordinado from fecha");
}

{
  const stripped = stripLogisticaMarkers("Pago 50% [LOGISTICA:OLD X] nota");
  assert.ok(!/\[LOGISTICA:/i.test(stripped));
  assert.match(stripped, /Pago 50%/);
  assert.match(stripped, /nota/);
  const adversarial = "x" + "[".repeat(5000) + "LOGISTICA:never" + "]".repeat(5000);
  const t0 = Date.now();
  const out = stripLogisticaMarkers(adversarial);
  assert.ok(Date.now() - t0 < 200, "stripLogisticaMarkers must stay fast on adversarial input");
  assert.equal(typeof out, "string");
  ok("stripLogisticaMarkers linear / no ReDoS");
}

{
  const identity = {
    orderId: "100042",
    nombre: "Cliente X",
    tel: "099111222",
    dir: "Calle 1",
  };
  const cellsA = rowWithIdentity({ ...identity, estado: "estado viejo" });
  const cellsB = rowWithIdentity({ ...identity, estado: "[LOGISTICA:ENTREGADO]" });
  const fpA = ventasRowIdentityFingerprint(cellsA);
  const fpB = ventasRowIdentityFingerprint(cellsB);
  assert.equal(fpA, fpB, "estado change must not alter identity fingerprint");
  assert.ok(fpA.includes("100042"));
  assert.ok(fpA.includes("Cliente X"));

  // dataRows index 0 = sheet row 2
  const dataRows = [
    rowWithIdentity({ orderId: "1", nombre: "Other", tel: "1", dir: "A" }), // sheet 2
    rowWithIdentity({ orderId: "2", nombre: "Other2", tel: "2", dir: "B" }), // sheet 3
    cellsB, // sheet 4 — real match
    rowWithIdentity({ orderId: "9", nombre: "Z", tel: "9", dir: "Z" }), // sheet 5
  ];
  const fp = ventasRowIdentityFingerprint(cellsB);
  // Stale hint after concurrent delete above: row 5 is wrong content — scan finds 4
  assert.equal(findSheetRow1BasedByFingerprint(dataRows, fp, 5), 4);
  assert.equal(findSheetRow1BasedByFingerprint(dataRows, fp, 4), 4);
  assert.equal(findSheetRow1BasedByFingerprint(dataRows, "missing\u0001x", 2), null);
  // Prove old bug class: deleting by stale hint 5 would hit Z, not Cliente X
  assert.notEqual(ventasRowIdentityFingerprint(dataRows[5 - 2]), fp);
  ok("fingerprint relocate after row shift (wrong-row delete guard)");
}

{
  assert.equal(isTerminalSaleStatus("entregado"), true);
  assert.equal(isTerminalSaleStatus("enviado"), true);
  assert.equal(isTerminalSaleStatus("coordinado"), false);
  assert.ok(TERMINAL_SALE_STATUSES.includes("entregado"));
  ok("terminal statuses gate");
}

{
  const next = buildEstadoSheetValue("Pago [LOGISTICA:COORDINADO FECHA=01/01]", {
    status: "entregado",
    fechaIso: "2026-08-07",
    camion: 2,
    transportista: "Juan",
    comment: "ok",
  });
  assert.match(next, /LOGISTICA:ENTREGADO/);
  assert.ok(!/LOGISTICA:COORDINADO/.test(next));
  ok("buildEstadoSheetValue replaces marker");
}

console.log(`saleState: ${passed} passed`);
