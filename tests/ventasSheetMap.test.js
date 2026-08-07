/**
 * Run: node tests/ventasSheetMap.test.js
 */
import assert from "node:assert/strict";
import {
  mapVentasRowV2,
  buildVentasHeaderMap,
  parsePlanillaFechaToIso,
  VENTAS_V2_FALLBACK,
  isVentasLogisticaCandidate,
  filterVentasLogisticaCandidates,
  labelVentasCandidate,
  sanitizeEncargoCell,
} from "../src/utils/logistica/ventasSheetMap.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("ventasSheetMap");

const HEADERS = [
  "CANAL",
  "VENDEDOR",
  "ID. Pedido",
  "INGRESO PEDIDO",
  "ESTADO GRAL DE VENTA",
  "ESTADO GRAL DE VENTA / …",
  "TIPO",
  "FECHA ENTREGA",
  "NOMBRE",
  "DIRECCIÓN",
  "ENCARGO",
  "CARPETA",
  "MONTO (USD SIN IVA)",
  "COSTO SIN IVA",
  "GANANCIAS SIN IVA",
  "CONTACTO",
];

const ROW = [
  "WA",
  "Matias",
  "1344059",
  "13-05",
  "NC",
  "Pago 53%/EFE … Nº Pedido 1344059 … Retiro …",
  "FAB",
  "22/05/2026",
  "Luis González (Petinho)",
  "https://maps.app.goo.gl/Rdx2bgZ6YCsuobbQ8",
  "https://drive.google.com/file/d/xxx/view?usp=sharing&name=Cotizaci-n-13052026-Isopanel-100-mm-Isodec-100-mm-petinho-WA.pdf",
  "folder-link",
  "3402,60",
  "2791,68",
  "610,92",
  "099 382 033",
];

{
  const m = buildVentasHeaderMap(HEADERS);
  assert.equal(m.nombre, 8);
  assert.equal(m.pdf, 10);
  assert.equal(m.tel, 15);
  assert.equal(m.fechaEntrega, 7);
  ok("header map indices");
}

{
  const r = mapVentasRowV2(HEADERS, ROW, 12, { gid: "926747636" });
  assert.equal(r.nombre, "Luis González (Petinho)");
  assert.notEqual(r.nombre.toUpperCase(), "NOMBRE");
  assert.equal(r.orderId, "1344059");
  assert.ok(r.pdf.includes("drive.google.com") || r.pdf.includes("Isopanel"));
  assert.ok(r.tel.includes("099") || r.tel.includes("382"));
  assert.equal(r.fechaEntrega, "2026-05-22");
  assert.equal(r.ventasSheetRow1Based, 12);
  ok("fixture Luis González maps correctly");
}

{
  // No headers — fixed fallbacks
  const r = mapVentasRowV2([], ROW, 5);
  assert.equal(r.nombre, ROW[VENTAS_V2_FALLBACK.nombre]);
  assert.equal(r.orderId, "1344059");
  ok("fallback indices without headers");
}

{
  assert.equal(parsePlanillaFechaToIso("22/05/2026"), "2026-05-22");
  assert.equal(parsePlanillaFechaToIso("2026-05-22"), "2026-05-22");
  ok("fecha parse");
}

{
  assert.equal(sanitizeEncargoCell("PEDIDO").pdf, "");
  assert.equal(sanitizeEncargoCell("ENCARGO").pdf, "");
  assert.ok(sanitizeEncargoCell("https://drive.google.com/file/d/xxx/view").pdf.includes("drive"));
  assert.equal(sanitizeEncargoCell("2 Gotero Isopanel 200mm").pdf, "");
  assert.ok(sanitizeEncargoCell("2 Gotero Isopanel 200mm").plainText.includes("Gotero"));
  ok("sanitizeEncargoCell");
}

{
  const good = mapVentasRowV2(HEADERS, ROW, 12, { gid: "926747636" });
  assert.equal(isVentasLogisticaCandidate(good), true);
  assert.equal(labelVentasCandidate(good), "Luis González (Petinho)");

  const garbage = mapVentasRowV2(
    HEADERS,
    [
      "CANAL",
      "VENDEDOR",
      "ID. Pedido",
      "",
      "",
      "",
      "",
      "",
      "NOMBRE",
      "DIRECCIÓN",
      "PEDIDO",
      "",
      "",
      "",
      "",
      "CONTACTO",
    ],
    3,
  );
  assert.equal(isVentasLogisticaCandidate(garbage), false);
  assert.equal(labelVentasCandidate({ nombre: "", orderId: "", ventasSheetRow1Based: 9 }), "fila 9");
  assert.equal(labelVentasCandidate({ nombre: "", orderId: "1345381" }), "#1345381");

  const filtered = filterVentasLogisticaCandidates([good, garbage]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].nombre, "Luis González (Petinho)");
  ok("candidate filter + labels reject garbage");
}

console.log(`ventasSheetMap: ${passed} passed`);
