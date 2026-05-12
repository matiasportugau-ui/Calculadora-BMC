#!/usr/bin/env node
/**
 * Smoke test: build a real solo_techo quote via executeScenario → buildQuotationModel
 * → render bmc-pdf (2-page A4) → POST /api/pdf/generate (optional) → write artifacts under .runtime/
 *
 * Usage:
 *   node scripts/bmc-pdf-export-smoke.mjs
 *   BMC_PDF_SMOKE_API=http://localhost:3001 node scripts/bmc-pdf-export-smoke.mjs
 *
 * Outputs:
 *   .runtime/bmc-pdf-smoke.html
 *   .runtime/bmc-pdf-smoke.pdf   (when API returns 200)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { setListaPrecios, PANELS_TECHO, PANELS_PARED, SCENARIOS_DEF } from "../src/data/constants.js";
import { calcTotalesSinIVA } from "../src/utils/calculations.js";
import { bomToGroups } from "../src/utils/helpers.js";
import { executeScenario } from "../src/utils/scenarioOrchestrator.js";
import { buildPdfAppendixPayload } from "../src/utils/quotationViews.js";
import { buildQuotationModel, renderPdfLayout } from "../src/pdf-templates/index.js";
import { montevideoYmd } from "../src/utils/quotationNaming.js";
import { pdfFileName } from "../src/utils/projectFile.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, ".runtime");
const API_BASE = (process.env.BMC_PDF_SMOKE_API || "http://127.0.0.1:3001").replace(/\/+$/, "");

function panelInfoFromTecho(techo) {
  const pd = PANELS_TECHO[techo.familia] || null;
  return {
    label: pd?.label || techo.familia,
    espesor: techo.espesor,
    color: techo.color,
    au: pd?.au ?? null,
  };
}

/** Minimal pared/camara for appendix helpers (solo_techo does not use pared BOM here). */
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

function buildSmokeTecho() {
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

async function tryPostPdf(html, filename) {
  const url = `${API_BASE}/api/pdf/generate`;
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
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  setListaPrecios("web");

  const scenario = "solo_techo";
  const scenarioDef = SCENARIOS_DEF.find((s) => s.id === scenario);
  if (!scenarioDef) throw new Error("SCENARIOS_DEF missing solo_techo");

  const techo = buildSmokeTecho();
  const vis = scenarioDef.visibility ?? SCENARIOS_DEF[0].visibility;

  const results = executeScenario(scenario, {
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
    nombre: "Cliente Smoke PDF",
    rut: "",
    razonSocial: "Cliente Smoke PDF",
    telefono: "",
    direccion: "Montevideo",
    nombreRefCliente: "",
    descripcion: "Cotización automática smoke (2 zonas techo)",
    refInterna: "BMC-PDF-SMOKE",
    fecha: montevideoYmd().split("-").reverse().join("/"),
  };

  const panelInfo = panelInfoFromTecho(techo);
  const kpiPaneles = results?.paneles?.cantPaneles ?? null;
  const kpiArea = results?.paneles?.areaTotal ?? results?.paneles?.areaNeta ?? null;
  const kpiApoyos = results?.autoportancia?.apoyos ?? results?.paneles?.numEsqExt ?? null;
  const kpiFij = results?.fijaciones?.puntosFijacion ?? null;

  const appendix = buildPdfAppendixPayload({
    scenario,
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
  const q = buildQuotationModel({
    client: proyecto,
    project: proyecto,
    scenario,
    panel: panelInfo,
    groups: groupsMapped,
    totals: grandTotal,
    appendix,
    snapshotImages: {},
  });

  const html = await renderPdfLayout("bmc-pdf", q);
  const htmlPath = join(OUT_DIR, "bmc-pdf-smoke.html");
  writeFileSync(htmlPath, html, "utf8");

  const fname = pdfFileName(proyecto.refInterna, proyecto);
  console.log("Quote OK:", {
    ref: proyecto.refInterna,
    subtotalSinIVA: grandTotal.subtotalSinIVA,
    iva: grandTotal.iva,
    totalFinal: grandTotal.totalFinal,
    bomGroups: groupsMapped.length,
    html: htmlPath,
  });

  const pdfAttempt = await tryPostPdf(html, fname);
  if (pdfAttempt.ok) {
    const pdfPath = join(OUT_DIR, "bmc-pdf-smoke.pdf");
    writeFileSync(pdfPath, pdfAttempt.buf);
    console.log("PDF OK:", pdfPath);
  } else {
    console.warn("PDF API skipped or failed:", {
      api: `${API_BASE}/api/pdf/generate`,
      status: pdfAttempt.status,
      detail: pdfAttempt.detail,
    });
    console.warn("Open the HTML in Chrome and print to PDF, or start API: npm run start:api");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
