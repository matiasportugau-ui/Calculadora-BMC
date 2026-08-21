/**
 * Wave 2 / N-P7 coordination monitor
 * Run: node tests/coordinationMonitor.test.js
 */
import assert from "node:assert/strict";
import {
  monitorLane,
  filterRowsByMonitor,
  exceptionsForRow,
  listCoordinationExceptions,
  countMonitorLanes,
  hasClockTime,
  isKingspanPickup,
  KINGSPAN_PICKUP_ID,
} from "../src/utils/logistica/coordinationMonitor.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("coordinationMonitor");

assert.equal(hasClockTime("retiro 14:30 Kingspan"), true);
assert.equal(hasClockTime("sin horario"), false);
ok("hasClockTime");

assert.equal(isKingspanPickup({ pickupId: KINGSPAN_PICKUP_ID }), true);
assert.equal(isKingspanPickup({ pickupId: "pickup-montfrio" }), false);
ok("isKingspanPickup");

{
  const rows = [
    { nombre: "A", estadoText: "Pendiente", fechaEntrega: "", pdf: "https://drive.google.com/x" },
    { nombre: "B", estadoText: "ENVIADO", pdf: "https://drive.google.com/y" },
    { nombre: "C", estadoText: "ENTREGADO ok", pdf: "https://drive.google.com/z" },
  ];
  assert.equal(monitorLane(rows[0]), "por_coordinar");
  assert.equal(monitorLane(rows[1]), "en_viaje");
  assert.equal(monitorLane(rows[2]), "entregado");
  assert.equal(filterRowsByMonitor(rows, "por_coordinar").length, 1);
  assert.equal(filterRowsByMonitor(rows, "en_viaje")[0].nombre, "B");
  assert.equal(filterRowsByMonitor(rows, "entregado")[0].nombre, "C");
  assert.deepEqual(countMonitorLanes(rows), {
    all: 3,
    por_coordinar: 1,
    en_viaje: 1,
    entregado: 1,
  });
  ok("lanes + filter");
}

{
  const emptyPdf = { nombre: "X", pdf: "", pickupId: "pickup-montfrio", estadoText: "ok" };
  const ks = {
    nombre: "K",
    pdf: "https://drive.google.com/file/d/abc",
    pickupId: KINGSPAN_PICKUP_ID,
    estadoText: "retiro manana",
  };
  const ksOk = {
    nombre: "K2",
    pdf: "https://drive.google.com/file/d/def",
    pickupId: KINGSPAN_PICKUP_ID,
    estadoText: "retiro 09:00",
  };
  assert.deepEqual(
    exceptionsForRow(emptyPdf).map((e) => e.code),
    ["pdf_vacio"],
  );
  assert.deepEqual(
    exceptionsForRow(ks).map((e) => e.code),
    ["kingspan_sin_hora"],
  );
  assert.equal(exceptionsForRow(ksOk).length, 0);
  const listed = listCoordinationExceptions([emptyPdf, ks, ksOk]);
  assert.equal(listed.length, 2);
  ok("exceptions pdf + kingspan hour");
}

console.log(`coordinationMonitor OK — ${passed} checks`);
