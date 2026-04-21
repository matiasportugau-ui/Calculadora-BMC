#!/usr/bin/env node
/**
 * Genera un HTML de muestra de la página extra PDF+ “Planta + resumen”
 * para previsualizar en navegador sin levantar la calculadora.
 *
 * Uso: node scripts/generate-pdf-planta-sample.mjs
 * Salida: docs/samples/pdf-planta-resumen-sample.html
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { buildPdfAppendixPayload, buildPdfPlantaResumenPageHtml } from "../src/utils/quotationViews.js";
import { PANELS_TECHO, PANELS_PARED } from "../src/data/constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "docs", "samples", "pdf-planta-resumen-sample.html");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const svgPlantaPlaceholder = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="280" viewBox="0 0 520 280">
    <rect fill="#f1f5f9" width="520" height="280" rx="8"/>
    <rect x="40" y="40" width="440" height="180" fill="#dbeafe" stroke="#003366" stroke-width="2" rx="4"/>
    <text x="260" y="135" text-anchor="middle" fill="#003366" font-family="system-ui,sans-serif" font-size="14" font-weight="700">Planta 2D (muestra)</text>
  </svg>`
);
const roofPlan2d = `data:image/svg+xml;charset=utf-8,${svgPlantaPlaceholder}`;

const appendix = buildPdfAppendixPayload({
  scenario: "solo_techo",
  scenarioDef: { hasTecho: true, hasPared: false, isLibre: false },
  vis: { borders: true, canalGot: false, autoportancia: true },
  techo: {
    largo: 0,
    ancho: 0,
    familia: "ISODEC_EPS",
    espesor: "100",
    color: "Blanco",
    zonas: [{ largo: 9.5, ancho: 12 }],
    borders: { fondo: "pretil_std", frente: "gotero", latIzq: "u", latDer: "u" },
    opciones: { inclCanalon: false, inclGotSup: true },
  },
  pared: { familia: "", espesor: "" },
  camara: {},
  results: {
    paneles: {
      anchoTotal: 34.72,
      cantPaneles: 31,
      areaTotal: 293.4,
    },
  },
  grandTotal: { subtotalSinIVA: 13042.69, iva: 2869.39, totalFinal: 15912.08 },
  kpiArea: 293.4,
  kpiPaneles: 31,
  kpiApoyos: 3,
  kpiFij: 165,
  PANELS_TECHO,
  PANELS_PARED,
});

const groups = [
  {
    title: "PANELES",
    items: [{ label: "ISODEC EPS 100mm", total: 11080.3 }],
  },
  {
    title: "PERFILERÍA",
    items: [
      { label: "Frente Sup: babeta adosar", total: 45.2 },
      { label: "Encuentro: cumbrera", total: 80.0 },
    ],
  },
  {
    title: "FIJACIONES",
    items: [{ label: "Varilla / tuercas / arandelas (kit)", total: 665.76 }],
  },
  {
    title: "SELLADORES",
    items: [{ label: "Siliconas + cinta butilo", total: 858.22 }],
  },
  {
    title: "SERVICIOS",
    items: [{ label: "Flete con entrega en obra", total: 280.0 }],
  },
];

const snapshots = {
  summary: null,
  totals: null,
  borders: null,
  roofPlan2d,
  roof3d: null,
};

const bodyHtml = buildPdfPlantaResumenPageHtml(esc, appendix, snapshots, true, {
  groups,
  totals: { subtotalSinIVA: 13042.69, iva: 2869.39, totalFinal: 15912.08 },
  client: { nombre: "Cliente ejemplo S.A." },
  project: { descripcion: "Nave industrial — MVD", refInterna: "BMC-2026-0420" },
  scenarioLabel: "Techo",
});

const doc = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Muestra PDF+ — Planta + resumen (BMC)</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 10pt;
      color: #1d1d1f;
      margin: 0;
      padding: 16px;
      background: #e5e7eb;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      max-width: 210mm;
      margin: 0 auto 24px;
      background: #fff;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      padding: 8px;
    }
    .banner {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <p class="banner">
    <strong>Muestra estática</strong> — misma plantilla que PDF+ (página “Planta + resumen”).
    Generado con <code>node scripts/generate-pdf-planta-sample.mjs</code>.
  </p>
  <div class="sheet">
${bodyHtml}
  </div>
</body>
</html>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, doc, "utf8");
console.log(`OK → ${outPath}`);
