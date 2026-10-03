/**
 * Quote → Google Sheets TSV. Money rounding, column integrity, cámara geometry.
 * Run: node tests/sheetExportTsvGates.test.js
 *
 * Tabs and newlines in client text must not shift columns. This exporter does
 * not apply the Sheets formula guard: a leading "=" is currently left as-is.
 */
import assert from "node:assert/strict";
import { buildGoogleSheetReportTsv } from "../src/utils/sheetExport.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function line(tsv, label) {
  return tsv.split("\n").find((row) => row.startsWith(`${label}\t`)) ?? null;
}

function base(overrides = {}) {
  return {
    proyecto: { fecha: "2026-10-01", refInterna: "R-1", nombre: "Ana", descripcion: "Obra" },
    scenario: "solo_techo",
    scenarioLabel: "Solo techo",
    vis: { autoportancia: true, borders: false },
    techo: {},
    pared: { alto: 99, perimetro: 99 },
    camara: { alto_int: 2.5, largo_int: 6, ancho_int: 4 },
    kpiArea: 10.25,
    kpiPaneles: 4,
    kpiApoyos: 2,
    kpiFij: 8,
    results: { warnings: [] },
    panelLine: "ISODEC 50",
    grandTotal: { subtotalSinIVA: 100.1, iva: 22.026, totalFinal: 122.1 },
    presupuestoLibre: false,
    ...overrides,
  };
}

console.log("sheetExportTsvGates");

{
  const tsv = buildGoogleSheetReportTsv(base({
    proyecto: {
      fecha: "2026-10-01",
      refInterna: "R\t2",
      nombre: "Ana\tPérez\nSA",
      descripcion: "obra",
    },
  }));
  const cliente = line(tsv, "Cliente");
  assert.equal(cliente, "Cliente\tAna Pérez SA");
  assert.equal(cliente.split("\t").length, 2);
  assert.equal(tsv.split("\n").filter((row) => row.startsWith("Cliente\t")).length, 1);
  assert.equal(line(tsv, "Ref. interna"), "Ref. interna\tR 2");
  assert.equal(line(tsv, "Área paneles (m²)"), "Área paneles (m²)\t10.3");
  assert.equal(line(tsv, "Subtotal USD s/IVA"), "Subtotal USD s/IVA\t100.10");
  assert.equal(line(tsv, "IVA 22% USD"), "IVA 22% USD\t22.03");
  assert.equal(line(tsv, "Total USD c/IVA"), "Total USD c/IVA\t122.10");
  assert.equal(line(tsv, "Panel cotizado"), "Panel cotizado\tISODEC 50");
  assert.ok(tsv.includes("(ninguna)"));
  assert.ok(tsv.includes("Apoyos\t2"));
  assert.equal(tsv.includes("Fachada / cerramiento"), false);
  ok("tabs and newlines stay in-cell and money rounds to cents");
}

{
  const tsv = buildGoogleSheetReportTsv(base({
    proyecto: {
      fecha: "2026-10-01",
      refInterna: "R-1",
      nombre: '=HYPERLINK("http://evil.example","x")',
      descripcion: "obra",
    },
    vis: { autoportancia: false, borders: false },
    kpiArea: Number.NaN,
    kpiPaneles: 0,
    grandTotal: { subtotalSinIVA: 0, iva: null, totalFinal: undefined },
  }));
  const cliente = line(tsv, "Cliente");
  assert.equal(cliente.split("\t")[1].startsWith("="), true);
  assert.equal(cliente.split("\t")[1].startsWith("'"), false);
  assert.equal(line(tsv, "Área paneles (m²)"), "Área paneles (m²)\tNaN");
  assert.equal(line(tsv, "Cant. paneles"), "Cant. paneles\t0");
  assert.equal(line(tsv, "Subtotal USD s/IVA"), "Subtotal USD s/IVA\t0.00");
  assert.equal(line(tsv, "IVA 22% USD"), "IVA 22% USD\t");
  assert.equal(line(tsv, "Total USD c/IVA"), "Total USD c/IVA\t");
  assert.ok(tsv.includes("Esquinas\t"));
  ok("zero money is printed, null IVA is blank, and a leading = is not quoted");
}

{
  const tsv = buildGoogleSheetReportTsv(base({
    scenario: "camara_frig",
    results: { warnings: ["alto\tmal\nrevisar"] },
  }));
  assert.equal(line(tsv, "Alto (m)"), "Alto (m)\t2.5");
  assert.equal(line(tsv, "Perímetro (m)"), "Perímetro (m)\t20");
  assert.equal(tsv.includes("99"), false);
  assert.ok(tsv.split("\n").includes("alto mal revisar"));
  assert.equal(tsv.includes("(ninguna)"), false);

  const unparsed = buildGoogleSheetReportTsv(base({
    scenario: "camara_frig",
    camara: { alto_int: "3", largo_int: "6m", ancho_int: 4 },
  }));
  assert.equal(line(unparsed, "Alto (m)"), "Alto (m)\t3");
  // Number("6m") is NaN, and `NaN || 0` drops it. Perimeter is 2 * ancho only.
  assert.equal(line(unparsed, "Perímetro (m)"), "Perímetro (m)\t8");

  const negative = buildGoogleSheetReportTsv(base({
    scenario: "camara_frig",
    camara: { alto_int: 3, largo_int: -1, ancho_int: 4 },
  }));
  assert.equal(line(negative, "Perímetro (m)"), "Perímetro (m)\t6");
  ok("cámara uses interior size; 6m becomes 0, a negative largo stays signed");
}

{
  const fachada = buildGoogleSheetReportTsv(base({
    scenario: "solo_fachada",
    pared: { alto: 3.2, perimetro: 18 },
  }));
  assert.equal(line(fachada, "Alto (m)"), "Alto (m)\t3.2");
  assert.equal(line(fachada, "Perímetro (m)"), "Perímetro (m)\t18");

  const libre = buildGoogleSheetReportTsv(base({
    presupuestoLibre: true,
    vis: {
      autoportancia: true,
      borders: true,
    },
    techo: {
      borders: { fondo: "custom_fondo", frente: "custom_frente", latIzq: "izq", latDer: "der" },
      opciones: { inclCanalon: true, inclGotSup: true },
    },
  }));
  assert.equal(libre.includes("Panel cotizado"), false);
  assert.equal(libre.includes("custom_fondo"), false);
  assert.equal(libre.includes("Canalón"), false);

  const bordered = buildGoogleSheetReportTsv(base({
    vis: { autoportancia: true, borders: true },
    techo: {
      borders: { fondo: "custom_fondo", frente: "custom_frente", latIzq: "izq", latDer: "der" },
      opciones: { inclCanalon: true, inclGotSup: false },
    },
  }));
  assert.equal(line(bordered, "Fondo ▲"), "Fondo ▲\tcustom_fondo");
  assert.equal(line(bordered, "Frente ▼"), "Frente ▼\tcustom_frente");
  assert.ok(bordered.includes("Opción perimetral\tCanalón"));
  assert.equal(bordered.includes("Gotero superior"), false);
  ok("libre quotes skip the panel block; borders follow the techo flags");
}

assert.throws(() => buildGoogleSheetReportTsv(base({ proyecto: undefined })), TypeError);
ok("a missing proyecto throws instead of emitting a blank header");

console.log(`sheetExportTsvGates: ${passed} passed`);
