/**
 * POST /api/ventas/logistica-estado payload gates.
 * Happy-path coordinado+fecha lives in saleState.test.js / open #1204.
 * These pins stop invalid status, out-of-range camión, and leftover fechas
 * from reaching the Ventas sheet.
 * Run: node tests/logisticaEstadoPayloadGates.test.js
 */
import assert from "node:assert/strict";
import {
  MAX_CAMIONES,
  buildLogisticaEstadoPayload,
  parseCamionNumber,
} from "../src/utils/logistica/saleState.js";

console.log("logisticaEstadoPayloadGates");

{
  assert.equal(parseCamionNumber(null), null);
  assert.equal(parseCamionNumber(""), null);
  assert.equal(parseCamionNumber(0), null);
  assert.equal(parseCamionNumber(13), null, "above MAX_CAMIONES is rejected");
  assert.equal(parseCamionNumber(MAX_CAMIONES + 1), null);
  assert.equal(parseCamionNumber(MAX_CAMIONES), MAX_CAMIONES);
  assert.equal(parseCamionNumber(2.9), 2, "floor, do not round up");
  assert.equal(parseCamionNumber("3"), 3);
  assert.equal(parseCamionNumber("abc"), null);
  console.log("  ✓ parseCamionNumber: empty/0/13 rejected; 12 ok; 2.9 floors");
}

{
  const bad = buildLogisticaEstadoPayload({ status: "archivado" });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "invalid_status");
  const missing = buildLogisticaEstadoPayload({});
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "invalid_status");
  console.log("  ✓ unknown / missing status is invalid_status (no sheet write)");
}

{
  const noFecha = buildLogisticaEstadoPayload({ status: "coordinado" });
  assert.equal(noFecha.ok, false);
  assert.equal(noFecha.error, "fecha_required_for_coordinado");
  const badFecha = buildLogisticaEstadoPayload({
    status: "coordinado",
    fechaEntrega: "06/08/2026",
  });
  assert.equal(badFecha.ok, false);
  assert.equal(badFecha.error, "fecha_required_for_coordinado");
  console.log("  ✓ coordinado requires YYYY-MM-DD (dd/mm is not accepted)");
}

{
  const tooBig = buildLogisticaEstadoPayload({
    status: "coordinado",
    fechaEntrega: "2026-08-06",
    camion: 13,
  });
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.error, "invalid_camion");
  const junk = buildLogisticaEstadoPayload({
    status: "coordinado",
    fechaEntrega: "2026-08-06",
    camion: "abc",
  });
  assert.equal(junk.ok, false);
  assert.equal(junk.error, "invalid_camion");
  const emptyCamion = buildLogisticaEstadoPayload({
    status: "coordinado",
    fechaEntrega: "2026-08-06",
    camion: "",
  });
  assert.equal(emptyCamion.ok, true, "blank camión is optional");
  assert.equal(emptyCamion.camion, null);
  console.log("  ✓ coordinado + bad camión → invalid_camion; blank camión ok");
}

{
  const cleared = buildLogisticaEstadoPayload({
    status: "por_coordinar",
    fechaEntrega: "2026-08-06",
    camion: 2,
    existingEstadoText: "Pago 50%",
  });
  assert.equal(cleared.ok, true);
  assert.equal(cleared.fechaEntrega, "", "por_coordinar must not keep a leftover fecha");
  assert.match(cleared.estadoText, /LOGISTICA:POR_COORDINAR/);
  assert.match(cleared.estadoText, /Pago 50%/);
  assert.ok(!/FECHA=/.test(cleared.estadoText), "cleared fecha is not stamped on the marker");
  console.log("  ✓ por_coordinar drops leftover fecha (does not stamp FECHA=)");
}

console.log("logisticaEstadoPayloadGates: ok");
