/**
 * Run: node tests/saleState.test.js
 */
import assert from "node:assert/strict";
import {
  classifySaleStatus,
  buildLogisticaEstadoPayload,
  buildEstadoSheetValue,
  isActiveLogisticsSale,
  isJunkVentasMappedRow,
  extractCamionFromText,
  saleStatusChipCaption,
  formatIsoToDdMm,
  transportistaForCamion,
  stripLogisticaMarkers,
  ventasRowIdentityFingerprint,
  findSheetRow1BasedByFingerprint,
  isTerminalSaleStatus,
} from "../src/utils/logistica/saleState.js";
import { isJunkVentasRow, mapVentasRowV2, parsePlanillaFechaToIso } from "../src/utils/logistica/ventasSheetMap.js";
import { filterOperationalVentasRows } from "../src/utils/logistica/ventasSearch.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("saleState");

{
  const c = classifySaleStatus({ fechaEntrega: "2026-05-22", estadoText: "Pago 50%" });
  assert.equal(c.status, "coordinado");
  assert.equal(c.coordDateIso, "2026-05-22");
  assert.match(saleStatusChipCaption(c), /Coordinado/);
  assert.match(saleStatusChipCaption(c), /22\/05/);
  ok("coordinado from fecha");
}

{
  const c = classifySaleStatus({
    estadoText: "Pago ok [LOGISTICA:COORDINADO FECHA=22/05/2026 CAMION=2]",
    fechaEntrega: "2026-05-22",
    camion: 2,
  });
  assert.equal(c.status, "coordinado");
  assert.equal(c.camion, 2);
  ok("camion from field");
}

{
  assert.equal(extractCamionFromText("coord Camión 3 mañana"), 3);
  assert.equal(extractCamionFromText("sin camion"), null);
  ok("extractCamionFromText");
}

{
  const c = classifySaleStatus({ estadoText: "ENTREGADO en obra" });
  assert.equal(c.status, "entregado");
  assert.equal(isActiveLogisticsSale(c), false);
  ok("entregado inactive");
}

{
  const c = classifySaleStatus({ estadoText: "CON PENDIENTES 2 paneles" });
  assert.equal(c.status, "con_pendientes");
  assert.equal(isActiveLogisticsSale(c), true);
  ok("con_pendientes stays active");
}

{
  const c = classifySaleStatus({ estadoText: "NO ENVIADO aún" });
  assert.equal(c.status, "por_coordinar");
  ok("negated enviado");
}

{
  const built = buildLogisticaEstadoPayload({
    status: "coordinado",
    fechaEntrega: "2026-08-06",
    camion: 1,
    transportista: "Expreso Este",
    existingEstadoText: "Pago 60% / EFE",
  });
  assert.equal(built.ok, true);
  assert.match(built.estadoText, /LOGISTICA:COORDINADO/);
  assert.match(built.estadoText, /CAMION=1/);
  assert.match(built.estadoText, /Pago 60%/);
  ok("build estado payload preserves notes");
}

{
  const bad = buildLogisticaEstadoPayload({ status: "coordinado" });
  assert.equal(bad.ok, false);
  ok("coordinado requires fecha");
}

{
  const v = buildEstadoSheetValue("hola [LOGISTICA:OLD X]", {
    status: "por_coordinar",
  });
  assert.equal(v.includes("[LOGISTICA:OLD"), false);
  assert.match(v, /POR_COORDINAR/);
  ok("strips previous LOGISTICA markers");
}

{
  assert.equal(formatIsoToDdMm("2026-05-22"), "22/05");
  assert.equal(formatIsoToDdMm("2026-05-22", { fullYear: true }), "22/05/2026");
  ok("formatIsoToDdMm");
}

{
  const t = transportistaForCamion([{ nombre: "A" }, { nombre: "B" }], 2);
  assert.equal(t, "B");
  assert.equal(transportistaForCamion([], 1, { 1: "Juan" }), "Juan");
  ok("transportistaForCamion");
}

{
  assert.equal(isJunkVentasMappedRow({ nombre: "NOMBRE" }), true);
  assert.equal(isJunkVentasMappedRow({ nombre: "Luis González" }), false);
  ok("junk mapped rows");
}

{
  const headers = [
    "CANAL",
    "VENDEDOR",
    "ID. Pedido",
    "INGRESO",
    "FACT",
    "ESTADO",
    "TIPO",
    "FECHA ENTREGA",
    "NOMBRE",
    "DIRECCIÓN",
    "ENCARGO",
    "CARPETA",
    "MONTO",
    "COSTO",
    "GAN",
    "CONTACTO",
  ];
  const junk = mapVentasRowV2(
    headers,
    ["o", "v", "", "", "", "BECAM 100%", "", "FECHA ENTREGA ", "NOMBRE", "DIRECCIÓN", "", "", "", "", "", "CONTACTO"],
    3
  );
  assert.equal(junk.nombre, "");
  assert.equal(isJunkVentasRow(junk), true);
  ok("map clears NOMBRE label + isJunk");
}

{
  const headers = ["a", "b", "ID. Pedido", "d", "e", "ESTADO", "TIPO", "FECHA ENTREGA", "NOMBRE", "DIRECCIÓN", "ENCARGO", "CARPETA", "m", "c", "g", "CONTACTO"];
  const good = mapVentasRowV2(
    headers,
    ["WA", "M", "1344", "x", "", "Pago", "FAB", "22/05/2026", "Petinho", "mapa", "pdf", "", "1", "1", "1", "099"],
    10
  );
  const junk = mapVentasRowV2(
    headers,
    ["", "", "", "", "", "BECAM seña", "", "FECHA ENTREGA ", "NOMBRE", "DIRECCIÓN", "", "", "", "", "", ""],
    4
  );
  const list = filterOperationalVentasRows([good, junk], { activeOnly: true });
  assert.equal(list.length, 1);
  assert.equal(list[0].nombre, "Petinho");
  ok("filterOperationalVentasRows drops junk");
}

{
  assert.equal(parsePlanillaFechaToIso("22/05/2026"), "2026-05-22");
  ok("fecha still parses");
}

{
  const stripped = stripLogisticaMarkers("Pago 50% [LOGISTICA:OLD X] nota");
  assert.equal(stripped.includes("[LOGISTICA:"), false);
  assert.match(stripped, /Pago 50%/);
  // Pathological tabs + unclosed markers must stay linear / not hang
  const adversarial = `${"\t".repeat(5000)}[LOGISTICA:${"x".repeat(200)}`;
  const t0 = Date.now();
  const out = stripLogisticaMarkers(adversarial);
  assert.ok(Date.now() - t0 < 200, "stripLogisticaMarkers must stay fast on adversarial input");
  assert.ok(typeof out === "string");
  ok("stripLogisticaMarkers linear / no ReDoS");
}

{
  const a = ["", "", "1344", "", "", "estado", "", "22/05", "Petinho", "Calle 1", "", "", "", "", "", "099"];
  const b = ["", "", "1345", "", "", "estado", "", "22/05", "Otro", "Calle 2", "", "", "", "", "", "098"];
  const fp = ventasRowIdentityFingerprint(a);
  assert.notEqual(fp, ventasRowIdentityFingerprint(b));
  // Estado change must not alter identity fingerprint
  const a2 = a.slice();
  a2[5] = "ENTREGADO [LOGISTICA:ENTREGADO]";
  assert.equal(ventasRowIdentityFingerprint(a2), fp);
  // After a concurrent delete above, hint row 10 is wrong content — scan finds real row
  const dataRows = [b, a]; // sheet rows 2 and 3
  assert.equal(findSheetRow1BasedByFingerprint(dataRows, fp, 10), 3);
  assert.equal(findSheetRow1BasedByFingerprint(dataRows, fp, 3), 3);
  assert.equal(findSheetRow1BasedByFingerprint(dataRows, "missing", 2), null);
  ok("fingerprint relocate after row shift");
}

{
  assert.equal(isTerminalSaleStatus("entregado"), true);
  assert.equal(isTerminalSaleStatus("enviado"), true);
  assert.equal(isTerminalSaleStatus("coordinado"), false);
  ok("terminal statuses");
}

console.log(`saleState: ${passed} passed`);
