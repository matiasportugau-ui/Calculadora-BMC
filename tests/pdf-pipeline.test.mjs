/**
 * tests/pdf-pipeline.test.mjs
 * Diagnoses the full PDF generation pipeline:
 *   1. HTML generation for all 5 layouts
 *   2. /api/pdf/generate endpoint reachability + error type
 *   3. html2pdf.js fallback path (structure check)
 *   4. pdfGenerator.js logic
 */

import { readFileSync } from "node:fs";
import { buildQuotationModel, renderPdfLayout, LAYOUT_OPTIONS } from "../src/pdf-templates/index.js";

// ── Sample quotation data ────────────────────────────────────────────────────

const SAMPLE = {
  project: { refInterna: "BMC-TEST-001", fecha: "27/04/2026", descripcion: "Test obra" },
  scenario: "solo_techo",
  panel: { label: "ISODEC EPS", espesor: 100, color: "Blanco" },
  groups: [
    {
      title: "PANELES",
      items: [{ label: "ISODEC EPS 100mm · 18 paneles", cant: 138.88, unidad: "m²", pu: 47.26, total: 6564.02 }],
    },
    {
      title: "FIJACIONES",
      items: [
        { label: "Varilla roscada 3/8\"", cant: 20, unidad: "unid", pu: 3.68, total: 73.64 },
        { label: "Tuerca 3/8\" galv.", cant: 190, unidad: "unid", pu: 0.08, total: 15.96 },
      ],
    },
    {
      title: "SERVICIOS",
      items: [{ label: "Flete con entrega en obra", cant: 1, unidad: "servicio", pu: 280, total: 280 }],
    },
  ],
  totals: { subtotalSinIVA: 6933.62, iva: 1525.40, totalFinal: 8459.02 },
  appendix: {
    scenarioLabel: "Solo Techo",
    kpi: { area: 138.88, paneles: 18, apoyosOrEsq: 3, ptsFij: 95, useApoyosLabel: true },
    zonas: [{ largo: 8, ancho: 8.96 }, { largo: 6, ancho: 5.60 }, { largo: 6, ancho: 5.60 }],
    roofBlocks: [
      { largo: 8, ancho: 8.96, anchoTotal: 8.96, cantPaneles: 8, au: 1.12 },
      { largo: 6, ancho: 5.60, anchoTotal: 5.60, cantPaneles: 5, au: 1.12 },
      { largo: 6, ancho: 5.60, anchoTotal: 5.60, cantPaneles: 5, au: 1.12 },
    ],
    panelAu: 1.12,
    tipoAguas: "una_agua",
    encounterByPair: {},
    globalBorders: {},
  },
  snapshotImages: {},
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function section(title) {
  console.log(`\n── ${title} ─────────────────────────────────────────────`);
}

// ── 1. buildQuotationModel ───────────────────────────────────────────────────

section("1. buildQuotationModel");
const q = buildQuotationModel(SAMPLE);

ok("ref extracted",          q.ref === "BMC-TEST-001");
ok("fecha extracted",        q.fecha === "27/04/2026");
ok("panelDescLine non-empty", q.panelDescLine.length > 5);
ok("areaTotalM2 > 0",        q.areaTotalM2 > 0);
ok("panelCount > 0",         q.panelCount > 0);
ok("bomGroups length",       q.bomGroups.length === 3);
ok("bomDetailGroups length", q.bomDetailGroups.length === 3);
ok("zoneRows from roofBlocks", q.zoneRows.length === 3);
ok("subtotalSinIva > 0",     q.subtotalSinIva > 0);
ok("totalConIva > 0",        q.totalConIva > 0);
ok("conditionsText non-empty", q.conditionsText.length > 10);
ok("svgPlanHtml empty (no snapshot)", q.svgPlanHtml === "");

// ── 2. renderPdfLayout — all 5 layouts ───────────────────────────────────────

section("2. renderPdfLayout — HTML generation");

for (const { id, label } of LAYOUT_OPTIONS) {
  try {
    const html = await renderPdfLayout(id, q);
    const hasDoctype  = html.startsWith("<!DOCTYPE html>");
    const hasRef      = html.includes(q.ref);
    const hasTotal    = html.includes("8,459.02") || html.includes("8459.02");
    const has3Pages   = (html.match(/class="page/g) || []).length >= 3;
    const sizeKB      = Math.round(html.length / 1024);
    ok(`${label}: doctype + ref + total + 3 pages (${sizeKB} KB)`,
       hasDoctype && hasRef && hasTotal && has3Pages,
       `doctype:${hasDoctype} ref:${hasRef} total:${hasTotal} pages:${has3Pages}`);
  } catch (err) {
    ok(`${label}: render`, false, err.message);
  }
}

// ── 3. /api/pdf/generate endpoint ───────────────────────────────────────────

section("3. /api/pdf/generate endpoint (production)");

const PROD_URL = "https://calculadora-bmc.vercel.app/api/pdf/generate";
const LOCAL_URL = "http://localhost:3001/api/pdf/generate";

async function checkEndpoint(url, label) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: "<html><body>ping</body></html>", filename: "test.pdf" }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.status === 200) {
      const ct = res.headers.get("content-type") || "";
      ok(`${label}: 200 OK, content-type: ${ct}`, ct.includes("pdf"));
    } else {
      const body = await res.json().catch(() => ({}));
      ok(`${label}: ${res.status} — ${body.error || "unknown"}`, false,
         `detail: ${(body.detail || "").slice(0, 80)}`);
    }
  } catch (err) {
    ok(`${label}: reachable`, false, err.message.slice(0, 80));
  }
}

await checkEndpoint(PROD_URL, "Production (/api/pdf/generate)");
await checkEndpoint(LOCAL_URL, "Local     (/api/pdf/generate)");

// ── 4. pdfGenerator.js logic check ──────────────────────────────────────────

section("4. pdfGenerator.js — source inspection");

try {
  const src = readFileSync("src/utils/pdfGenerator.js", "utf8");
  ok("has htmlToPdfViaServer",   src.includes("htmlToPdfViaServer"));
  ok("has try/catch fallback",   src.includes("catch (serverErr)"));
  ok("falls back to html2pdf",   src.includes("htmlToPdfViaHtml2Pdf"));
  ok("server returns 503 → warn", src.includes("server PDF failed"));
  ok("no Shadow DOM (html2canvas compat)", !src.includes("attachShadow"));

  const serverFnMatch = src.match(/async function htmlToPdfViaServer[\s\S]*?^}/m);
  ok("server fn throws on non-ok", src.includes("if (!res.ok)"));
} catch (err) {
  ok("pdfGenerator.js readable", false, err.message);
}

// ── 5. Dockerfile — Chromium check ──────────────────────────────────────────

section("5. Dockerfile — Chromium availability");

try {
  const dockerfile = readFileSync("server/Dockerfile", "utf8");
  const hasChromiumPkg   = dockerfile.includes("chromium");
  const hasChromiumEnv   = dockerfile.includes("CHROMIUM_EXECUTABLE_PATH");
  const hasSparticuz     = readFileSync("package.json", "utf8").includes("@sparticuz/chromium");
  const hasCorrectPath   = dockerfile.includes("/usr/bin/chromium-browser");

  ok("@sparticuz/chromium in package.json", hasSparticuz);
  ok("Dockerfile installs system chromium", hasChromiumPkg);
  ok("CHROMIUM_EXECUTABLE_PATH env set",    hasChromiumEnv);
  ok("Points to /usr/bin/chromium-browser", hasCorrectPath);
} catch (err) {
  ok("Dockerfile readable", false, err.message);
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n══════════════════════════════════════════════════════`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════════════════════════\n`);

process.exit(failed > 0 ? 1 : 0);
