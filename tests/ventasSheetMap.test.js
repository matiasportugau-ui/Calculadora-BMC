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
  parseVentasGvizCsv,
  indexVentasCsvDataRows,
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

{
  // Blank middle row must not skew later sheetRow1Based (fecha write target).
  // CSV: header@1, A@2, blank@3, B@4, C@5 → after drop blank, C must stay row 5 not 4.
  const blank = HEADERS.map(() => "");
  const rowA = [...ROW];
  rowA[VENTAS_V2_FALLBACK.nombre] = "Cliente A";
  rowA[VENTAS_V2_FALLBACK.orderId] = "100001";
  const rowB = [...ROW];
  rowB[VENTAS_V2_FALLBACK.nombre] = "Cliente B";
  rowB[VENTAS_V2_FALLBACK.orderId] = "100002";
  const rowC = [...ROW];
  rowC[VENTAS_V2_FALLBACK.nombre] = "Cliente C";
  rowC[VENTAS_V2_FALLBACK.orderId] = "100003";
  const csv = [HEADERS, rowA, blank, rowB, rowC];

  const indexed = indexVentasCsvDataRows(csv);
  assert.equal(indexed.length, 3);
  assert.deepEqual(
    indexed.map((x) => x.sheetRow1Based),
    [2, 4, 5],
  );

  // Regress the old bug: filter-then-(i+2) would assign C → 4 (B's real row).
  const skewed = csv
    .slice(1)
    .filter((r) => r.some((c) => String(c || "").trim()))
    .map((r, i) => ({ row: r, sheetRow1Based: i + 2 }));
  assert.equal(skewed[2].sheetRow1Based, 4, "documents old skew for C");
  assert.notEqual(indexed[2].sheetRow1Based, skewed[2].sheetRow1Based);
  assert.equal(indexed[2].sheetRow1Based, 5);

  const mapped = indexed.map(({ row, sheetRow1Based }) =>
    mapVentasRowV2(HEADERS, row, sheetRow1Based, { gid: "1" }),
  );
  assert.equal(mapped[2].nombre, "Cliente C");
  assert.equal(mapped[2].ventasSheetRow1Based, 5);
  ok("indexVentasCsvDataRows preserves sheet rows across blanks");
}

{
  // Live path: gviz CSV text → parseVentasGvizCsv → indexVentasCsvDataRows.
  // Old BmcLogisticaApp.parseCsv dropped blank `,,,` rows before indexing, so
  // Cliente C (sheet row 5) was written as row 4 (data corruption / Bug AT).
  const csvText = [
    HEADERS.map((h) => `"${h}"`).join(","),
    (() => {
      const r = HEADERS.map(() => "");
      r[VENTAS_V2_FALLBACK.nombre] = "Cliente A";
      r[VENTAS_V2_FALLBACK.orderId] = "100001";
      return r.map((c) => (c.includes(",") ? `"${c}"` : c)).join(",");
    })(),
    HEADERS.map(() => "").join(","), // blank sheet row 3
    (() => {
      const r = HEADERS.map(() => "");
      r[VENTAS_V2_FALLBACK.nombre] = "Cliente B";
      r[VENTAS_V2_FALLBACK.orderId] = "100002";
      return r.map((c) => (c.includes(",") ? `"${c}"` : c)).join(",");
    })(),
    (() => {
      const r = HEADERS.map(() => "");
      r[VENTAS_V2_FALLBACK.nombre] = "Cliente C";
      r[VENTAS_V2_FALLBACK.orderId] = "100003";
      return r.map((c) => (c.includes(",") ? `"${c}"` : c)).join(",");
    })(),
  ].join("\n");

  const parsed = parseVentasGvizCsv(csvText);
  assert.equal(parsed.length, 5, "parser must keep blank middle row placeholder");
  assert.ok(
    !parsed[2].some((c) => String(c || "").trim()),
    "index 2 is the blank sheet row 3 placeholder",
  );

  const indexed = indexVentasCsvDataRows(parsed);
  assert.deepEqual(
    indexed.map((x) => x.sheetRow1Based),
    [2, 4, 5],
  );
  const mapped = indexed.map(({ row, sheetRow1Based }) =>
    mapVentasRowV2(HEADERS, row, sheetRow1Based, { gid: "1" }),
  );
  assert.equal(mapped[2].nombre, "Cliente C");
  assert.equal(mapped[2].ventasSheetRow1Based, 5);
  ok("parseVentasGvizCsv + index preserves sheet rows (live gviz path / Bug AT)");
}

console.log(`ventasSheetMap: ${passed} passed`);
