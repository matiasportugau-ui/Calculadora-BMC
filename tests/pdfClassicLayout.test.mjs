/**
 * tests/pdfClassicLayout.test.mjs
 * The 'classic' PDF layout must render the original HOJA VISUAL CLIENTE
 * (generateClientVisualHTML) through the renderPdfLayout dispatcher, so the
 * pre-template-system client PDF stays selectable from the layout dropdown.
 * Offline — no server, no network.
 */

import { buildQuotationModel, renderPdfLayout, LAYOUT_OPTIONS } from "../src/pdf-templates/index.js";

const SAMPLE = {
  client: { nombre: "Cliente Test", telefono: "099123456", direccion: "Av. Test 123" },
  project: { refInterna: "BMC-TEST-001", fecha: "07/07/2026", descripcion: "Obra test" },
  scenario: "solo_techo",
  panel: { label: "ISODEC EPS", espesor: 100, color: "Blanco" },
  groups: [
    {
      title: "PANELES",
      items: [{ label: "ISODEC EPS 100mm · 18 paneles", cant: 138.88, unidad: "m²", pu: 47.26, total: 6564.02 }],
    },
    {
      title: "SERVICIOS",
      items: [{ label: "Flete con entrega en obra", cant: 1, unidad: "servicio", pu: 280, total: 280 }],
    },
  ],
  totals: { subtotalSinIVA: 6933.62, iva: 1525.4, totalFinal: 8459.02 },
  // Mirrors buildPdfAppendixPayload() output — classic's appendix page needs totals/roofBlock
  appendix: {
    scenarioLabel: "Solo Techo",
    showBorders: false,
    borders: {},
    borderExtras: [],
    kpi: { area: 138.88, paneles: 18, apoyosOrEsq: 3, ptsFij: 95, useApoyosLabel: true },
    zonas: [{ largo: 8, ancho: 8.96 }],
    roofBlock: { largo: 8, ancho: 8.96, anchoTotal: 8.96, cantPaneles: 8, au: 1.12, label: "ISODEC EPS 100mm" },
    roofBlocks: [{ largo: 8, ancho: 8.96, anchoTotal: 8.96, cantPaneles: 8, au: 1.12, label: "ISODEC EPS 100mm" }],
    wallBlock: null,
    panelAu: 1.12,
    tipoAguas: "una_agua",
    encounterByPair: {},
    globalBorders: {},
    totals: { subtotalSinIVA: 6933.62, iva: 1525.4, totalFinal: 8459.02 },
  },
  snapshotImages: {},
};

let passed = 0;
let failed = 0;
function ok(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

console.log("\n── pdfClassicLayout — 'classic' layout recovery ────────────");

ok("LAYOUT_OPTIONS includes 'classic'", LAYOUT_OPTIONS.some((o) => o.id === "classic"));

const q = buildQuotationModel(SAMPLE);
ok("model preserves raw inputs", q.raw?.project?.refInterna === "BMC-TEST-001");
ok("raw client resolves nombre", q.raw?.client?.nombre === "Cliente Test");

const html = await renderPdfLayout("classic", q);
ok("renders HOJA VISUAL CLIENTE header", html.includes("HOJA VISUAL CLIENTE"));
ok("starts with doctype", html.startsWith("<!DOCTYPE html>"));
ok("includes ref", html.includes("BMC-TEST-001"));
ok("includes client name", html.includes("Cliente Test"));
ok("includes total", html.includes("8,459.02"));

const simpleHtml = await renderPdfLayout("simple", q);
ok("classic output differs from 'simple'", html !== simpleHtml);

const noRawHtml = await renderPdfLayout("classic", { ...q, raw: undefined });
ok("model without raw falls back to a template render", typeof noRawHtml === "string" && noRawHtml.length > 0 && !noRawHtml.includes("HOJA VISUAL CLIENTE"));

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
