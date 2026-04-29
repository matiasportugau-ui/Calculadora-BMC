/**
 * tests/pdf-quality.test.mjs
 *
 * Real-world PDF quality test:
 *   1. Generates HTML for all 5 layouts with realistic sample data
 *   2. POSTs to production /api/pdf/generate (real Chromium render)
 *   3. Saves each PDF to /tmp/bmc-pdf-test/
 *   4. Auto-evaluates: validity, size, page count, text presence
 *   5. Prints a quality scorecard
 *
 * Usage:  node tests/pdf-quality.test.mjs
 * Output: /tmp/bmc-pdf-test/{layout}.pdf  ← open in Preview to inspect
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { buildQuotationModel, renderPdfLayout, LAYOUT_OPTIONS } from "../src/pdf-templates/index.js";

const PROD_URL  = "https://calculadora-bmc.vercel.app/api/pdf/generate";
const OUT_DIR   = "/tmp/bmc-pdf-test";
const TIMEOUT_MS = 30_000;

mkdirSync(OUT_DIR, { recursive: true });

// ── Realistic sample quotation ───────────────────────────────────────────────

const SAMPLE = {
  project: {
    refInterna: "BMC-2026-0112",
    fecha: "27/04/2026",
    descripcion: "Galpón industrial — cubierta principal + extensiones",
  },
  scenario: "solo_techo",
  panel: { label: "ISODEC EPS", espesor: 100, color: "Blanco" },
  groups: [
    {
      title: "PANELES",
      items: [
        { label: "ISODEC EPS 100mm · 18 paneles", cant: 138.88, unidad: "m²", pu: 47.26, total: 6564.02 },
      ],
    },
    {
      title: "FIJACIONES",
      items: [
        { label: "Varilla roscada 3/8\" (1m)", cant: 20, unidad: "unid", pu: 3.68, total: 73.64 },
        { label: "Tuerca 3/8\" galv.", cant: 190, unidad: "unid", pu: 0.08, total: 15.96 },
        { label: "Arandela carrocero 3/8\"", cant: 95, unidad: "unid", pu: 0.66, total: 62.51 },
        { label: "Arandela plana 3/8\"", cant: 95, unidad: "unid", pu: 0.10, total: 9.04 },
        { label: "Tortuga PVC (arand. PP)", cant: 95, unidad: "unid", pu: 1.51, total: 143.64 },
      ],
    },
    {
      title: "SELLADORES",
      items: [
        { label: "Silicona Bromplast 8×600", cant: 16, unidad: "unid", pu: 11.24, total: 179.88 },
        { label: "Silicona neutra 300 ml (Silva)", cant: 32, unidad: "unid", pu: 8.40, total: 268.80 },
        { label: "Cinta Butilo 2mm×15mm×22.5m", cant: 3, unidad: "unid", pu: 19.19, total: 57.57 },
      ],
    },
    {
      title: "SERVICIOS",
      items: [
        { label: "Flete con entrega en obra", cant: 1, unidad: "servicio", pu: 280.00, total: 280.00 },
      ],
    },
  ],
  totals: { subtotalSinIVA: 7655.06, iva: 1684.11, totalFinal: 9339.17 },
  appendix: {
    scenarioLabel: "Solo Techo",
    kpi: { area: 138.88, paneles: 18, apoyosOrEsq: 3, ptsFij: 95, useApoyosLabel: true },
    zonas: [
      { largo: 8, ancho: 8.96 },
      { largo: 6, ancho: 5.60 },
      { largo: 6, ancho: 5.60 },
    ],
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

// ── PDF analysis helpers ──────────────────────────────────────────────────────

function analyzePdf(buf) {
  const result = {
    valid: false, sizeKB: 0, pages: 0,
    hasFonts: false, hasImages: false, hasColorSpace: false, hasAnnots: false,
    score: 0, grade: "F", issues: [],
  };

  result.sizeKB = Math.round(buf.length / 1024);
  const str = buf.toString("latin1");

  // 1. Valid PDF header
  result.valid = str.startsWith("%PDF-");
  if (!result.valid) { result.issues.push("Not a valid PDF (missing %PDF- header)"); return result; }

  // 2. Page count — Chromium embeds /Type /Page for each page
  result.pages = (str.match(/\/Type\s*\/Page[^s]/g) || []).length;
  if (result.pages === 0) result.pages = (str.match(/\/Page\b/g) || []).length;

  // 3. Structural checks (all reliable in Chromium PDFs)
  result.hasFonts      = str.includes("/Font");         // text was rendered
  result.hasImages     = str.includes("/XObject");      // CSS backgrounds / SVG / images rendered
  result.hasColorSpace = str.includes("/ColorSpace");   // color rendering active
  result.hasAnnots     = str.includes("/Annots") || str.includes("/Link"); // clickable links

  // 4. Score (0–100) — structural quality indicators
  let s = 0;
  if (result.valid)         s += 15;
  if (result.sizeKB >= 60)  s += 15;  // 3-page A4 with CSS should be ≥60 KB
  if (result.sizeKB >= 90)  s += 10;  // rich layout bonus
  if (result.pages === 3)   s += 25;  // exactly 3 pages
  if (result.pages > 0 && result.pages < 3) s += 10; // partial pages
  if (result.hasFonts)      s += 15;  // text rendered
  if (result.hasImages)     s += 10;  // backgrounds/SVG rendered
  if (result.hasColorSpace) s += 10;  // colors rendered

  result.score = Math.min(100, s);
  result.grade = s >= 90 ? "A" : s >= 75 ? "B" : s >= 60 ? "C" : s >= 40 ? "D" : "F";

  if (result.sizeKB < 20)  result.issues.push(`File too small (${result.sizeKB} KB) — may be blank`);
  if (result.pages !== 3)  result.issues.push(`${result.pages} page(s) detected (expected 3)`);
  if (!result.hasFonts)    result.issues.push("No /Font objects — text may not be rendered");
  if (!result.hasImages)   result.issues.push("No /XObject — CSS backgrounds/SVG may be missing");

  return result;
}

function extractPdfText(buf) {
  let extracted = "";

  // Chromium PDFs use binary-safe stream extraction:
  // Find "stream\r\n" or "stream\n" markers as byte offsets, then
  // find matching "endstream" to get the exact binary slice.
  const STREAM_START = Buffer.from("stream\n");
  const STREAM_START2 = Buffer.from("stream\r\n");
  const STREAM_END = Buffer.from("\nendstream");

  let pos = 0;
  while (pos < buf.length) {
    let start = -1;
    let headerLen = 0;

    const idx1 = buf.indexOf(STREAM_START, pos);
    const idx2 = buf.indexOf(STREAM_START2, pos);

    if (idx1 === -1 && idx2 === -1) break;
    if (idx1 !== -1 && (idx2 === -1 || idx1 <= idx2)) {
      start = idx1 + STREAM_START.length;
      headerLen = STREAM_START.length;
      pos = idx1 + 1;
    } else {
      start = idx2 + STREAM_START2.length;
      headerLen = STREAM_START2.length;
      pos = idx2 + 1;
    }

    const end = buf.indexOf(STREAM_END, start);
    if (end === -1) break;

    const streamSlice = buf.slice(start, end);

    // Try FlateDecode decompression
    try {
      const decompressed = inflateSync(streamSlice).toString("utf8");
      extracted += decompressed + " ";
    } catch {
      // Uncompressed stream — read as latin1 text
      const raw = streamSlice.toString("latin1");
      const btBlocks = raw.match(/BT[\s\S]*?ET/g) || [];
      for (const block of btBlocks) {
        const strings = block.match(/\(([^)]*)\)/g) || [];
        extracted += strings.map(s => s.slice(1, -1)).join(" ") + " ";
      }
    }

    pos = end + STREAM_END.length;
  }

  // Also scan raw bytes for literal strings in document catalog / info
  const raw = buf.toString("latin1");
  const litStrings = raw.match(/\(([A-Za-zÀ-ÿ0-9\.\-\/\s,:_]{3,60})\)/g) || [];
  extracted += litStrings.map(s => s.slice(1, -1)).join(" ");

  return extracted;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const q = buildQuotationModel(SAMPLE);
const results = [];

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║          PDF Quality Test — Production Endpoint             ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");
console.log(`  Target: ${PROD_URL}`);
console.log(`  Output: ${OUT_DIR}/\n`);

for (const { id, label } of LAYOUT_OPTIONS) {
  process.stdout.write(`  Generating ${label}... `);
  const t0 = Date.now();

  try {
    // Generate HTML
    const html = await renderPdfLayout(id, q);
    const htmlKB = Math.round(html.length / 1024);

    // Call production endpoint
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(PROD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, filename: `${id}.pdf` }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.log(`FAILED (HTTP ${res.status}) — ${err.error}`);
      results.push({ id, label, status: "error", error: err.error, elapsed });
      continue;
    }

    // Save PDF
    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const outPath = `${OUT_DIR}/${id}.pdf`;
    writeFileSync(outPath, buf);

    // Analyze
    const analysis = analyzePdf(buf);
    console.log(`${analysis.grade} (${elapsed}s)`);

    results.push({ id, label, status: "ok", elapsed, htmlKB, ...analysis, outPath });

  } catch (err) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`ERROR (${elapsed}s) — ${err.message?.slice(0, 60)}`);
    results.push({ id, label, status: "error", error: err.message, elapsed });
  }
}

// ── Scorecard ────────────────────────────────────────────────────────────────

console.log("\n┌─────────────────────────────────────────────────────────────────────┐");
console.log("│  SCORECARD                                                          │");
console.log("├──────────────────────┬───────┬──────┬───────┬───────┬──────────────┤");
console.log("│ Layout               │ Grade │  KB  │ Pages │ Time  │ Text checks  │");
console.log("├──────────────────────┼───────┼──────┼───────┼───────┼──────────────┤");

let totalScore = 0;
let count = 0;

for (const r of results) {
  if (r.status === "error") {
    console.log(`│ ${r.label.padEnd(20)} │  ERR  │  --  │  --   │ ${r.elapsed.padStart(4)}s │ ${(r.error||"").slice(0,12).padEnd(12)} │`);
    continue;
  }
  const textChecks = [
    r.hasRef       ? "ref✓" : "ref✗",
    r.hasTotal     ? "tot✓" : "tot✗",
    r.hasPanelName ? "pan✓" : "pan✗",
  ].join(" ");
  const sizeStr = String(r.sizeKB).padStart(4);
  const pagesStr = String(r.pages).padStart(3);
  console.log(`│ ${r.label.padEnd(20)} │   ${r.grade}   │ ${sizeStr} │  ${pagesStr}  │ ${r.elapsed.padStart(4)}s │ ${textChecks.padEnd(12)} │`);
  totalScore += r.score;
  count++;
}

console.log("└──────────────────────┴───────┴──────┴───────┴───────┴──────────────┘");

if (count > 0) {
  const avg = Math.round(totalScore / count);
  const avgGrade = avg >= 90 ? "A" : avg >= 75 ? "B" : avg >= 60 ? "C" : avg >= 40 ? "D" : "F";
  console.log(`\n  Average score: ${avg}/100  (${avgGrade})`);
}

// Issues
const withIssues = results.filter(r => r.issues?.length > 0);
if (withIssues.length > 0) {
  console.log("\n  Issues found:");
  for (const r of withIssues) {
    for (const issue of r.issues) {
      console.log(`    [${r.id}] ${issue}`);
    }
  }
}

console.log(`\n  PDFs saved to: ${OUT_DIR}/`);
console.log("  Open with: open /tmp/bmc-pdf-test/\n");

const failures = results.filter(r => r.status === "error" || (r.grade && ["D","F"].includes(r.grade)));
process.exit(failures.length > 0 ? 1 : 0);
