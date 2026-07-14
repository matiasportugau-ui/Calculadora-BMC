#!/usr/bin/env node
/**
 * Export ALL PDF generations / templates for the SAME test quote.
 * Purpose: Identify & recover a "previous" PDF template by comparing outputs.
 *
 * Usage:
 *   node scripts/pdf/export-all-pdf-generations.mjs
 *   BMC_PDF_GENERATIONS_API=http://localhost:3001 node scripts/pdf/export-all-pdf-generations.mjs
 *   node scripts/pdf/export-all-pdf-generations.mjs --no-pdf
 *
 * Outputs (dated dir):
 *   .runtime/pdf-generations-YYYY-MM-DD/
 *     testquote-BMC-TEST-ALLGEN-*.html
 *     testquote-BMC-TEST-ALLGEN-*.pdf (if API succeeds)
 *     00-INDEX.html + manifest.json + test-input.json
 *
 * This covers:
 * - Modern: every entry in LAYOUT_OPTIONS (simple + variants + legacy-marked)
 * - Legacy: generateClientVisualHTML (with planta page) and generatePrintHTML
 *
 * Modelled after:
 *   scripts/bmc-pdf-export-smoke.mjs
 *   scripts/render-quotation-preview-html.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { setListaPrecios, PANELS_TECHO, PANELS_PARED, SCENARIOS_DEF } from "../../src/data/constants.js";
import { calcTotalesSinIVA } from "../../src/utils/calculations.js";
import { bomToGroups } from "../../src/utils/helpers.js";
import { executeScenario } from "../../src/utils/scenarioOrchestrator.js";
import { buildPdfAppendixPayload, generateClientVisualHTML } from "../../src/utils/quotationViews.js";
import { generatePrintHTML } from "../../src/utils/helpers.js";
import { buildQuotationModel, renderPdfLayout, LAYOUT_OPTIONS } from "../../src/pdf-templates/index.js";
import { montevideoYmd } from "../../src/utils/quotationNaming.js";
import { pdfFileName } from "../../src/utils/projectFile.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DATE = new Date().toISOString().slice(0, 10);
const OUT_DIR = join(ROOT, ".runtime", `pdf-generations-${DATE}`);
const API_BASE = (process.env.BMC_PDF_GENERATIONS_API || process.env.BMC_PDF_SMOKE_API || "http://127.0.0.1:3001").replace(/\/+$/, "");
const NO_PDF = process.argv.includes("--no-pdf");

const BASE_REF = "BMC-TEST-ALLGEN";
const SCENARIO = "solo_techo";

/** Minimal idle data for appendix (solo_techo focused) */
const PARED_IDLE = {
  familia: "",
  espesor: "",
  color: "Blanco",
  alto: 3.5,
  perimetro: 40,
  numEsqExt: 4,
  numEsqInt: 0,
  aberturas: [],
  tipoEst: "metal",
  inclSell: true,
  incl5852: false,
};

const CAMARA_IDLE = { largo_int: 6, ancho_int: 4, alto_int: 3 };

function buildTestTecho() {
  // Same as smoke for reproducibility — 2 zones, realistic
  return {
    familia: "ISODEC_EPS",
    espesor: 100,
    color: "Blanco",
    zonas: [
      { largo: 10, ancho: 11.2, dosAguas: false },
      { largo: 6, ancho: 5.6, dosAguas: false },
    ],
    pendiente: 0,
    pendienteModo: "incluye_pendiente",
    alturaDif: 0,
    tipoAguas: "una_agua",
    tipoEst: "metal",
    ptsHorm: 0,
    ptsMetal: 0,
    ptsMadera: 0,
    borders: { frente: "", fondo: "", latIzq: "", latDer: "" },
    inclAccesorios: true,
    bordesExtendido: false,
    bordesCualquierFamilia: false,
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: true, bomComercial: false },
  };
}

function panelInfoFromTecho(techo) {
  const pd = PANELS_TECHO[techo.familia] || null;
  return {
    label: pd?.label || techo.familia,
    espesor: techo.espesor,
    color: techo.color,
    au: pd?.au ?? null,
  };
}

async function tryPostPdf(html, filename) {
  if (NO_PDF) return { ok: false, status: 0, detail: "skipped --no-pdf" };
  const url = `${API_BASE}/api/pdf/generate`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, filename }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, status: res.status, detail: errText.slice(0, 400) };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: true, buf };
  } catch (e) {
    return { ok: false, status: 0, detail: String(e.message || e).slice(0, 200) };
  }
}

function buildDimensions(techo, results) {
  const d = {};
  if (techo?.zonas?.length) {
    d.zonas = techo.zonas;
  }
  if (results?.paneles?.areaTotal || results?.paneles?.areaNeta) {
    d.area = results.paneles.areaTotal || results.paneles.areaNeta;
  }
  if (results?.paneles?.cantPaneles) d.cantPaneles = results.paneles.cantPaneles;
  return d;
}

function buildManifest(entries) {
  const lines = [];
  lines.push(`# PDF Generations Export — ${DATE}`);
  lines.push(`Base ref: ${BASE_REF}`);
  lines.push(`Scenario: ${SCENARIO}`);
  lines.push(``);
  lines.push(`## Files`);
  for (const e of entries) {
    lines.push(`- **${e.label}**`);
    lines.push(`  - HTML: ${e.htmlName}`);
    if (e.pdfName) lines.push(`  - PDF: ${e.pdfName}`);
    if (e.notes) lines.push(`  - Notes: ${e.notes}`);
  }
  lines.push(``);
  lines.push(`## How to compare`);
  lines.push(`1. Open the HTML files in browser tabs.`);
  lines.push(`2. Use browser Print → Save as PDF (matches client html2pdf path) for visual match against your old PDFs.`);
  lines.push(`3. Search source for distinctive markers (see below).`);
  lines.push(``);
  lines.push(`## Distinguishing markers (search HTML)`);
  lines.push(`- Modern 'simple': .hdr, .badge>PRESUPUESTO, /bmc-pdf/assets/bmc-logo.png, .cat navy rows, bank grid, full QUOTE_TERMS`);
  lines.push(`- Legacy generateClientVisualHTML: "HOJA VISUAL CLIENTE", inline SVG logo, &#9656; bullets, appendix with planta SVG + "Resumen de partidas"`);
  lines.push(`- Legacy generatePrintHTML: "COTIZACIÓN", buildProductBadge with autoportancia, dimensions section`);
  lines.push(``);
  lines.push(`Generated by scripts/pdf/export-all-pdf-generations.mjs`);
  return lines.join("\n");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  setListaPrecios("web");

  const scenarioDef = SCENARIOS_DEF.find((s) => s.id === SCENARIO);
  if (!scenarioDef) throw new Error(`SCENARIOS_DEF missing ${SCENARIO}`);

  const techo = buildTestTecho();
  const vis = scenarioDef.visibility ?? SCENARIOS_DEF[0].visibility;

  const results = executeScenario(SCENARIO, {
    techo,
    pared: PARED_IDLE,
    camara: CAMARA_IDLE,
  });

  if (!results || results.error) {
    throw new Error(`executeScenario failed: ${results?.error || "null"}`);
  }

  const groups = bomToGroups(results);
  const allItems = [];
  groups.forEach((g) => g.items.forEach((i) => allItems.push(i)));
  const grandTotal = calcTotalesSinIVA(allItems);

  const proyecto = {
    tipoCliente: "empresa",
    nombre: "Cliente Test All Generations",
    rut: "",
    razonSocial: "Cliente Test All Generations",
    telefono: "092 663 245",
    direccion: "Montevideo, Uruguay",
    nombreRefCliente: "",
    descripcion: "Test quote to recover previous PDF template (solo_techo 2 zonas)",
    refInterna: BASE_REF,
    fecha: montevideoYmd().split("-").reverse().join("/"),
  };

  const panelInfo = panelInfoFromTecho(techo);
  const kpiPaneles = results?.paneles?.cantPaneles ?? null;
  const kpiArea = results?.paneles?.areaTotal ?? results?.paneles?.areaNeta ?? null;
  const kpiApoyos = results?.autoportancia?.apoyos ?? results?.paneles?.numEsqExt ?? null;
  const kpiFij = results?.fijaciones?.puntosFijacion ?? null;

  const appendix = buildPdfAppendixPayload({
    scenario: SCENARIO,
    scenarioDef,
    vis,
    techo,
    pared: PARED_IDLE,
    camara: CAMARA_IDLE,
    results,
    grandTotal,
    kpiArea,
    kpiPaneles,
    kpiApoyos,
    kpiFij,
    PANELS_TECHO,
    PANELS_PARED,
  });

  const groupsMapped = groups.map((g) => ({ title: g.title, items: g.items }));

  // Modern payload
  const modernInput = {
    client: proyecto,
    project: proyecto,
    scenario: SCENARIO,
    panel: panelInfo,
    groups: groupsMapped,
    totals: grandTotal,
    appendix,
    snapshotImages: {},
    quoteId: BASE_REF,
    version: 1,
  };

  // Legacy payloads
  const dimensions = buildDimensions(techo, results);
  const autoportancia = results?.autoportancia || results?.techoResult?.autoportancia || null;
  const warnings = results?.warnings || [];

  const legacyClientVisualInput = {
    client: proyecto,
    project: proyecto,
    scenario: SCENARIO,
    panel: panelInfo,
    groups: groupsMapped,
    totals: grandTotal,
    appendix,
    snapshotImages: {},
    includePlantaResumenPage: true,
  };

  const legacyPrintInput = {
    client: proyecto,
    project: proyecto,
    scenario: SCENARIO,
    panel: panelInfo,
    autoportancia,
    groups: groupsMapped.map((g) => ({
      title: g.title,
      items: g.items,
      subtotal: g.items.reduce((s, i) => s + (i.total || 0), 0),
    })),
    totals: grandTotal,
    warnings,
    dimensions,
    listaPrecios: "web",
    quotationId: BASE_REF,
    showSKU: false,
    showUnitPrices: true,
  };

  // Write raw input for reference
  const inputDump = {
    scenario: SCENARIO,
    techo,
    proyecto,
    panelInfo,
    groups: groupsMapped,
    grandTotal,
  };
  writeFileSync(join(OUT_DIR, "test-input.json"), JSON.stringify(inputDump, null, 2), "utf8");

  const entries = [];

  // 1. Modern family (all LAYOUT_OPTIONS)
  console.log("\n=== Modern family (renderPdfLayout) ===");
  for (const opt of LAYOUT_OPTIONS) {
    try {
      const q = buildQuotationModel(modernInput);
      const html = await renderPdfLayout(opt.id, q);
      const htmlName = `testquote-${BASE_REF}-${opt.id}.html`;
      const htmlPath = join(OUT_DIR, htmlName);
      writeFileSync(htmlPath, html, "utf8");

      const fname = pdfFileName(BASE_REF, proyecto).replace(".pdf", `-${opt.id}.pdf`);
      const pdfAttempt = await tryPostPdf(html, fname);
      let pdfName = null;
      if (pdfAttempt.ok) {
        pdfName = fname;
        writeFileSync(join(OUT_DIR, pdfName), pdfAttempt.buf);
      }

      const notes = opt.recommended ? "recommended" : (opt.legacy ? "legacy-marked" : "");
      console.log(`  ${opt.id}: ${htmlName}${pdfName ? " + " + pdfName : ""}`);
      entries.push({ label: `Modern: ${opt.label} (${opt.id})`, htmlName, pdfName, notes });
    } catch (e) {
      console.warn(`  ${opt.id} FAILED:`, e.message);
      entries.push({ label: `Modern: ${opt.label} (${opt.id})`, htmlName: `FAILED-${opt.id}.html`, notes: e.message });
    }
  }

  // 2. Legacy generateClientVisualHTML
  console.log("\n=== Legacy: generateClientVisualHTML ===");
  try {
    const html = generateClientVisualHTML(legacyClientVisualInput);
    const htmlName = `testquote-${BASE_REF}-legacy-clientvisual.html`;
    writeFileSync(join(OUT_DIR, htmlName), html, "utf8");

    const fname = pdfFileName(BASE_REF, proyecto).replace(".pdf", "-legacy-clientvisual.pdf");
    const pdfAttempt = await tryPostPdf(html, fname);
    let pdfName = null;
    if (pdfAttempt.ok) {
      pdfName = fname;
      writeFileSync(join(OUT_DIR, pdfName), pdfAttempt.buf);
    }
    console.log(`  legacy-clientvisual: ${htmlName}${pdfName ? " + " + pdfName : ""}`);
    entries.push({ label: "Legacy: generateClientVisualHTML (HOJA VISUAL CLIENTE + appendix)", htmlName, pdfName });
  } catch (e) {
    console.warn("  legacy-clientvisual FAILED:", e.message);
  }

  // 3. Legacy generatePrintHTML (the one used by server /cotizar/pdf)
  console.log("\n=== Legacy: generatePrintHTML ===");
  try {
    const html = generatePrintHTML(legacyPrintInput);
    const htmlName = `testquote-${BASE_REF}-legacy-print.html`;
    writeFileSync(join(OUT_DIR, htmlName), html, "utf8");

    const fname = pdfFileName(BASE_REF, proyecto).replace(".pdf", "-legacy-print.pdf");
    const pdfAttempt = await tryPostPdf(html, fname);
    let pdfName = null;
    if (pdfAttempt.ok) {
      pdfName = fname;
      writeFileSync(join(OUT_DIR, pdfName), pdfAttempt.buf);
    }
    console.log(`  legacy-print: ${htmlName}${pdfName ? " + " + pdfName : ""}`);
    entries.push({ label: "Legacy: generatePrintHTML (COTIZACIÓN + autoportancia + dimensions)", htmlName, pdfName });
  } catch (e) {
    console.warn("  legacy-print FAILED:", e.message);
  }

  // Write manifest + index
  const manifestMd = buildManifest(entries);
  writeFileSync(join(OUT_DIR, "MANIFEST.md"), manifestMd, "utf8");

  const indexHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>PDF Generations — ${DATE}</title>
<style>body{font-family:system-ui;margin:2rem} table{border-collapse:collapse} td,th{border:1px solid #ccc;padding:6px}</style>
</head><body>
<h1>PDF Template Generations Export — ${DATE}</h1>
<p><b>Base ref:</b> ${BASE_REF} &nbsp; <b>Scenario:</b> ${SCENARIO}</p>
<p>Open the HTML files. For visual PDFs use browser Print → Save as PDF (or the generated .pdf if API was available).</p>
<h2>Generated files</h2>
<table><tr><th>Generator</th><th>HTML</th><th>PDF</th></tr>
${entries.map(e => `<tr><td>${e.label}</td><td><a href="./${e.htmlName}">${e.htmlName}</a></td><td>${e.pdfName ? `<a href="./${e.pdfName}">${e.pdfName}</a>` : "— (use Print on HTML)"}</td></tr>`).join("")}
</table>
<p>See <a href="./MANIFEST.md">MANIFEST.md</a> for markers and instructions.</p>
<p>Raw input: <a href="./test-input.json">test-input.json</a></p>
</body></html>`;
  writeFileSync(join(OUT_DIR, "00-INDEX.html"), indexHtml, "utf8");

  // Also write a simple JSON manifest
  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify({ date: DATE, baseRef: BASE_REF, entries }, null, 2), "utf8");

  console.log(`\n=== Done ===`);
  console.log(`Output dir: ${OUT_DIR}`);
  console.log(`Open: ${join(OUT_DIR, "00-INDEX.html")}`);
  console.log(`Or: open ${OUT_DIR} && cat MANIFEST.md`);
  if (!NO_PDF) {
    console.log(`(PDFs attempted against ${API_BASE} — start API with: npm run start:api if missing)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
