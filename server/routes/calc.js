// ═══════════════════════════════════════════════════════════════════════════
// server/routes/calc.js — Calculator API for GPT Panelin Actions
// ═══════════════════════════════════════════════════════════════════════════

import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import {
  calcTechoCompleto,
  calcParedCompleto,
  calcTotalesSinIVA,
  mergeZonaResults,
} from "../../src/utils/calculations.js";
import { bomToGroups, buildWhatsAppText, fmtPrice, generatePrintHTML } from "../../src/utils/helpers.js";
import {
  setListaPrecios,
  PANELS_TECHO,
  PANELS_PARED,
  PERFIL_TECHO,
  PERFIL_PARED,
  SCENARIOS_DEF,
  VIS,
  BORDER_OPTIONS,
  SERVICIOS,
  FIJACIONES,
  SELLADORES,
  p,
} from "../../src/data/constants.js";
import { computePresupuestoLibreCatalogo, flattenPerfilesLibre } from "../../src/utils/presupuestoLibreCatalogo.js";
import { config } from "../config.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── GET /gpt-entry-point — Discovery schema for GPT Builder full accessibility ────────

const GPT_ACTIONS = [
  {
    operationId: "obtener_informe_completo",
    method: "GET",
    path: "/calc/informe",
    summary: "Informe completo con precios, reglas de asesoría y fórmulas.",
    whenToUse: "Llamar al INICIO de sesión para cargar contexto completo. Devuelve catálogo, matriz de precios, fijaciones, selladores, reglas de asesoría y fórmulas de cálculo.",
    params: [{ name: "lista", in: "query", type: "string", enum: ["venta", "web"], default: "web" }],
  },
  {
    operationId: "obtener_catalogo",
    method: "GET",
    path: "/calc/catalogo",
    summary: "Catálogo de paneles, espesores, colores y opciones.",
    whenToUse: "Para conocer familias válidas, espesores, colores y precios antes de cotizar. Guía la conversación con el usuario.",
    params: [{ name: "lista", in: "query", type: "string", enum: ["venta", "web"], default: "web" }],
  },
  {
    operationId: "obtener_escenarios",
    method: "GET",
    path: "/calc/escenarios",
    summary: "Escenarios disponibles con campos requeridos y opcionales.",
    whenToUse: "Para saber qué datos pedir según el tipo de proyecto (solo techo, fachada, techo+fachada, cámara frigorífica).",
    params: [],
  },
  {
    operationId: "calcular_presupuesto_libre",
    method: "POST",
    path: "/calc/cotizar/presupuesto-libre",
    summary: "Calcula presupuesto libre (líneas manuales por catálogo).",
    whenToUse: "Cuando el cliente pide partidas sueltas (paneles por m², perfilería por barra, tornillería, selladores, flete manual, extraordinarios) sin cotización techo/pared automática.",
    params: [
      { name: "lista", in: "body", type: "string", enum: ["venta", "web"], default: "web" },
      { name: "librePanelLines", in: "body", type: "array" },
      { name: "librePerfilQty", in: "body", type: "object" },
      { name: "libreFijQty", in: "body", type: "object" },
      { name: "libreSellQty", in: "body", type: "object" },
      { name: "flete", in: "body", type: "number", default: 0 },
      { name: "libreExtra", in: "body", type: "object" },
    ],
  },
  {
    operationId: "calcular_cotizacion",
    method: "POST",
    path: "/calc/cotizar",
    summary: "Calcula cotización completa con BOM, precios y textos.",
    whenToUse: "Cuando el usuario tiene dimensiones y opciones definidas. Devuelve resumen, BOM, texto WhatsApp y texto resumen.",
    params: [
      { name: "escenario", in: "body", required: true, type: "string", enum: ["solo_techo", "solo_fachada", "techo_fachada", "camara_frig"] },
      { name: "lista", in: "body", type: "string", enum: ["venta", "web"], default: "venta" },
      { name: "techo", in: "body", type: "object", requiredFor: ["solo_techo", "techo_fachada"] },
      { name: "pared", in: "body", type: "object", requiredFor: ["solo_fachada", "techo_fachada", "camara_frig"] },
      { name: "camara", in: "body", type: "object", requiredFor: ["camara_frig"] },
      { name: "flete", in: "body", type: "number", default: 0 },
    ],
  },
  {
    operationId: "generar_cotizacion_pdf",
    method: "POST",
    path: "/calc/cotizar/pdf",
    summary: "Genera PDF profesional y devuelve link para compartir.",
    whenToUse: "Cuando el cliente quiere la cotización en PDF. Incluir objeto cliente (nombre, teléfono, dirección). Link expira en 24h.",
    params: [
      { name: "escenario", in: "body", required: true, type: "string" },
      { name: "cliente", in: "body", type: "object", description: "nombre, rut, telefono, direccion, obra, ref, fecha, quote_code" },
      { name: "techo", in: "body", type: "object" },
      { name: "pared", in: "body", type: "object" },
      { name: "camara", in: "body", type: "object" },
      { name: "flete", in: "body", type: "number" },
    ],
  },
  {
    operationId: "listar_cotizaciones_generadas",
    method: "GET",
    path: "/calc/cotizaciones",
    summary: "Lista cotizaciones PDF generadas en la sesión.",
    whenToUse: "Para consultar historial de cotizaciones generadas (código, cliente, total, link PDF).",
    params: [],
  },
  {
    operationId: "ver_pdf_cotizacion",
    method: "GET",
    path: "/calc/pdf/{id}",
    summary: "Abre la cotización HTML (imprimir como PDF).",
    whenToUse: "URL devuelta por generar_cotizacion_pdf. Compartir con el cliente. Expira en 24h.",
    params: [{ name: "id", in: "path", required: true, type: "string", description: "pdf_id de la respuesta" }],
  },
];

// ── GET /openapi — Serves OpenAPI schema for GPT Actions ─────────────────────────────

router.get("/openapi", (req, res) => {
  const openapiPath = path.resolve(__dirname, "../../docs/openapi-calc.yaml");
  if (!fs.existsSync(openapiPath)) {
    return res.status(404).json({ ok: false, error: "OpenAPI schema not found" });
  }
  res.setHeader("Content-Type", "application/x-yaml");
  res.send(fs.readFileSync(openapiPath, "utf8"));
});

router.get("/gpt-entry-point", (req, res) => {
  const baseUrl = config.publicBaseUrl.replace(/\/$/, "");
  res.json({
    ok: true,
    version: "1.0.0",
    description: "Entry point para GPT Builder — acceso completo a todas las acciones de la Calculadora BMC.",
    base_url: baseUrl,
    openapi_url: `${baseUrl}/calc/openapi`,
    actions: GPT_ACTIONS.map((a) => ({
      ...a,
      url: `${baseUrl}${a.path}`,
    })),
    recommended_flow: [
      "1. GET /calc/informe (o /calc/catalogo + /calc/escenarios) al inicio para cargar contexto.",
      "2. Recopilar datos del usuario: escenario, dimensiones, panel, color, opciones.",
      "3. POST /calc/cotizar para calcular y mostrar resumen.",
      "4. Si el cliente quiere PDF: POST /calc/cotizar/pdf con objeto cliente.",
      "5. Compartir pdf_url con el cliente.",
    ],
    escenarios: ["solo_techo", "solo_fachada", "techo_fachada", "camara_frig", "presupuesto_libre"],
    listas_precio: ["venta", "web"],
  });
});

// ── Interaction log (dev: save to file for Cursor workflow) ──────────────────────────

router.post("/interaction-log", (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ ok: false, error: "Missing body" });
  }
  try {
    const logsDir = path.resolve(__dirname, "../../docs/team/calculator-logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filePath = path.join(logsDir, `interaction-${ts}.json`);
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2), "utf8");
    return res.json({ ok: true, path: filePath });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── PDF store (in-memory, TTL-based) ─────────────────────────────────────────

const PDF_TTL_MS = 24 * 60 * 60 * 1000;
const pdfStore = new Map();

function storePdf(html) {
  const id = crypto.randomUUID();
  pdfStore.set(id, { html, createdAt: Date.now() });
  return id;
}

function getPdf(id) {
  const entry = pdfStore.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > PDF_TTL_MS) {
    pdfStore.delete(id);
    return null;
  }
  return entry.html;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of pdfStore) {
    if (now - entry.createdAt > PDF_TTL_MS) pdfStore.delete(id);
  }
  for (const [id, entry] of quotationRegistry) {
    if (now - entry.createdAt > PDF_TTL_MS) quotationRegistry.delete(id);
  }
}, 60 * 60 * 1000);

// ── Quotation registry (tracks GPT-generated quotations) ────────────────────

const quotationRegistry = new Map();

function registerQuotation({ pdfId, pdfUrl, code, client, scenario, total, lista }) {
  quotationRegistry.set(pdfId, {
    id: pdfId,
    code: code || null,
    client: client || "—",
    scenario: scenario || "",
    total: total || 0,
    lista: lista || "web",
    pdfUrl,
    createdAt: Date.now(),
    timestamp: new Date().toISOString(),
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveTechoForCamara(paredFamilia, paredEspesor) {
  const familia = paredFamilia in PANELS_TECHO ? paredFamilia : "ISODEC_EPS";
  const panel = PANELS_TECHO[familia];
  if (panel.esp[paredEspesor]) return { familia, espesor: paredEspesor, mapped: false };
  const available = Object.keys(panel.esp).map(Number).sort((a, b) => a - b);
  const espesor = available.find(e => e >= paredEspesor) || available[available.length - 1];
  return { familia, espesor, mapped: true, original: paredEspesor };
}

const SCENARIO_LABELS = {
  solo_techo: "Solo Techo",
  solo_fachada: "Solo Fachada",
  techo_fachada: "Techo + Fachada",
  camara_frig: "Cámara Frigorífica",
  presupuesto_libre: "Presupuesto libre",
};

const LISTA_LABELS = { venta: "BMC Directo", web: "Web" };

function buildGptResponse(escenario, lista, results, flete) {
  if (!results || results.error) {
    return { ok: false, error: results?.error || "Sin resultados" };
  }

  let groups = bomToGroups(results);
  if (flete > 0) {
    groups.push({
      title: "SERVICIOS",
      items: [{ label: SERVICIOS.flete.label, sku: "FLETE", cant: 1, unidad: "servicio", pu: flete, total: flete }],
    });
  }

  const allItems = [];
  groups.forEach(g => g.items.forEach(i => allItems.push(i)));
  const totales = calcTotalesSinIVA(allItems);

  const bom = groups.map(g => {
    const subtotal = g.items.reduce((s, i) => s + (i.total || 0), 0);
    return {
      grupo: g.title,
      subtotal_usd: +subtotal.toFixed(2),
      items: g.items.map(i => {
        const item = {
          descripcion: i.label,
          sku: i.sku || null,
          cant: i.cant,
          unidad: i.unidad,
          pu_usd: i.pu,
          total_usd: i.total,
        };
        if (i.largoBarra) item.largo_barra_m = i.largoBarra;
        if (i.cantPaneles) item.cant_paneles = i.cantPaneles;
        if (i.largoPanel) item.largo_panel_m = i.largoPanel;
        return item;
      }),
    };
  });

  const resumen = results.presupuestoLibre
    ? {
        area_m2: 0,
        cant_paneles: 0,
        puntos_fijacion: 0,
        lineas_bom: allItems.length,
        subtotal_usd: totales.subtotalSinIVA,
        iva_usd: totales.iva,
        total_usd: totales.totalFinal,
      }
    : {
        area_m2: results.paneles?.areaTotal ?? results.paneles?.areaNeta ?? 0,
        cant_paneles: results.paneles?.cantPaneles ?? 0,
        puntos_fijacion: results.fijaciones?.puntosFijacion ?? 0,
        subtotal_usd: totales.subtotalSinIVA,
        iva_usd: totales.iva,
        total_usd: totales.totalFinal,
      };

  const autoportancia = results.autoportancia
    ? { ok: results.autoportancia.ok, apoyos: results.autoportancia.apoyos, vano_max_m: results.autoportancia.maxSpan }
    : null;

  const descarte = results.paneles?.descarte?.areaM2 > 0
    ? { ancho_m: results.paneles.descarte.anchoM, area_m2: results.paneles.descarte.areaM2, porcentaje: results.paneles.descarte.porcentaje }
    : null;

  const panelLabel = allItems.find(i => i.unidad === "m²")?.label || "";
  const textoResumen = results.presupuestoLibre
    ? `Presupuesto libre — ${allItems.length} línea(s) en BOM. Subtotal: USD ${fmtPrice(resumen.subtotal_usd)} + IVA 22%: USD ${fmtPrice(resumen.iva_usd)} = TOTAL USD ${fmtPrice(resumen.total_usd)}.`
    : `Cotización ${panelLabel} — ${SCENARIO_LABELS[escenario] || escenario}. `
      + `Área: ${resumen.area_m2} m². Paneles: ${resumen.cant_paneles}. `
      + `Subtotal: USD ${fmtPrice(resumen.subtotal_usd)} + IVA 22%: USD ${fmtPrice(resumen.iva_usd)} = `
      + `TOTAL USD ${fmtPrice(resumen.total_usd)}.`;

  const textoWhatsapp = buildWhatsAppText({
    client: { nombre: "—", rut: "", telefono: "" },
    project: { fecha: new Date().toLocaleDateString("es-UY"), refInterna: "", descripcion: "" },
    scenario: escenario,
    panel: { label: panelLabel, espesor: "", color: "" },
    totals: totales,
    listaLabel: LISTA_LABELS[lista] || lista,
  });

  return {
    ok: true,
    meta: {
      escenario,
      escenario_label: SCENARIO_LABELS[escenario] || escenario,
      lista,
      lista_label: LISTA_LABELS[lista] || lista,
      version: "3.1.0",
      timestamp: new Date().toISOString(),
    },
    resumen,
    bom,
    descarte,
    autoportancia,
    advertencias: results.warnings || [],
    texto_whatsapp: textoWhatsapp,
    texto_resumen: textoResumen,
  };
}

function runCalcTecho(techo) {
  const is2A = techo.tipoAguas === "dos_aguas";
  const zonas = techo.zonas || [{ largo: techo.largo || 6, ancho: techo.ancho || 5 }];

  const zonaResults = zonas.flatMap(zona => {
    if (is2A) {
      const ha = +(zona.ancho / 2).toFixed(2);
      const a1 = calcTechoCompleto({
        ...techo, largo: zona.largo, ancho: ha,
        borders: { ...techo.borders, fondo: "cumbrera" },
      });
      const a2 = calcTechoCompleto({
        ...techo, largo: zona.largo, ancho: ha,
        borders: {
          frente: techo.borders?.fondo === "cumbrera" ? "cumbrera" : (techo.borders?.fondo || "none"),
          fondo: "none",
          latIzq: techo.borders?.latIzq || "none",
          latDer: techo.borders?.latDer || "none",
        },
      });
      return [a1, a2];
    }
    return [calcTechoCompleto({ ...techo, largo: zona.largo, ancho: zona.ancho })];
  });
  return mergeZonaResults(zonaResults);
}

// ── Shared calculation runner ────────────────────────────────────────────────

function runCalculation({ escenario, lista, techo, pared, camara }) {
  if (!escenario) return { error: "Campo 'escenario' es requerido." };
  if (!["solo_techo", "solo_fachada", "techo_fachada", "camara_frig"].includes(escenario)) {
    return { error: `Escenario '${escenario}' no válido. Opciones: solo_techo, solo_fachada, techo_fachada, camara_frig.` };
  }

  setListaPrecios(lista === "venta" ? "venta" : "web");

  if (escenario === "solo_techo") {
    if (!techo?.familia || !techo?.espesor) return { error: "Para 'solo_techo' se requiere techo.familia y techo.espesor." };
    return runCalcTecho(techo);
  }

  if (escenario === "solo_fachada") {
    if (!pared?.familia || !pared?.espesor) return { error: "Para 'solo_fachada' se requiere pared.familia y pared.espesor." };
    return calcParedCompleto(pared);
  }

  if (escenario === "techo_fachada") {
    let rT = null;
    if (techo?.familia && techo?.espesor) rT = runCalcTecho(techo);
    const rP = pared?.familia && pared?.espesor ? calcParedCompleto(pared) : null;
    if (!rT && !rP) return { error: "Para 'techo_fachada' se requiere al menos techo o pared con familia y espesor." };
    const allItems = [...(rT?.allItems || []), ...(rP?.allItems || [])];
    const totales = calcTotalesSinIVA(allItems);
    return { ...rT, paredResult: rP, allItems, totales, warnings: [...(rT?.warnings || []), ...(rP?.warnings || [])] };
  }

  if (escenario === "camara_frig") {
    if (!pared?.familia || !pared?.espesor) return { error: "Para 'camara_frig' se requiere pared.familia y pared.espesor." };
    if (!camara?.largo_int || !camara?.ancho_int || !camara?.alto_int) return { error: "Para 'camara_frig' se requiere camara.largo_int, camara.ancho_int y camara.alto_int." };
    const perim = 2 * (camara.largo_int + camara.ancho_int);
    const rP = calcParedCompleto({ ...pared, perimetro: perim, alto: camara.alto_int, numEsqExt: 4, numEsqInt: 0 });
    const techoMap = resolveTechoForCamara(pared.familia, pared.espesor);
    const extraWarnings = [];
    if (techoMap.mapped) extraWarnings.push(`Techo cámara: espesor ${techoMap.original}mm no disponible en ${techoMap.familia}, se usó ${techoMap.espesor}mm.`);
    const rT = calcTechoCompleto({
      familia: techoMap.familia, espesor: techoMap.espesor,
      largo: camara.largo_int, ancho: camara.ancho_int, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
      color: pared.color,
    });
    if (rT?.error) extraWarnings.push(`Techo cámara: ${rT.error}`);
    const techoItems = rT?.error ? [] : (rT?.allItems || []);
    const allItems = [...(rP?.allItems || []), ...techoItems];
    const totales = calcTotalesSinIVA(allItems);
    return { ...rP, techoResult: rT?.error ? null : rT, allItems, totales, warnings: [...(rP?.warnings || []), ...(rT?.warnings || []), ...extraWarnings] };
  }

  return { error: "Escenario no reconocido." };
}

// ── POST /cotizar ────────────────────────────────────────────────────────────

function runPresupuestoLibreFromBody(body) {
  const {
    lista = "web",
    librePanelLines = [],
    librePerfilQty = {},
    libreFijQty = {},
    libreSellQty = {},
    flete = 0,
    libreExtra = {},
  } = body || {};
  setListaPrecios(lista === "venta" ? "venta" : "web");
  const perfilRows = flattenPerfilesLibre(PERFIL_TECHO, PERFIL_PARED);
  const perfilCatalogById = new Map(perfilRows.map((r) => [r.id, r]));
  return computePresupuestoLibreCatalogo({
    listaPrecios: lista,
    librePanelLines,
    librePerfilQty,
    perfilCatalogById,
    libreFijQty,
    libreSellQty,
    flete,
    libreExtra,
  });
}

router.post("/cotizar/presupuesto-libre", (req, res) => {
  try {
    const { lista = "web" } = req.body || {};
    const results = runPresupuestoLibreFromBody(req.body);
    if (results?.error) {
      return res.status(400).json({ ok: false, error: results.error });
    }
    return res.json(buildGptResponse("presupuesto_libre", lista, results, 0));
  } catch (err) {
    req.log.error({ err }, "calc/cotizar/presupuesto-libre failed");
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/cotizar", (req, res) => {
  try {
    const { lista = "web", escenario, techo, pared, camara, flete = 0 } = req.body;
    const results = runCalculation({ escenario, lista, techo, pared, camara });
    if (results.error && !results.allItems) {
      return res.status(400).json({ ok: false, error: results.error });
    }
    return res.json(buildGptResponse(escenario, lista, results, flete));
  } catch (err) {
    req.log.error({ err }, "calc/cotizar failed");
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /cotizar/pdf ───────────────────────────────────────────────────────

router.post("/cotizar/pdf", (req, res) => {
  try {
    const { lista = "web", escenario, techo, pared, camara, flete = 0, cliente } = req.body;
    const results = runCalculation({ escenario, lista, techo, pared, camara });
    if (results.error && !results.allItems) {
      return res.status(400).json({ ok: false, error: results.error });
    }

    const gptResp = buildGptResponse(escenario, lista, results, flete);
    if (!gptResp.ok) return res.status(400).json(gptResp);

    const panelLabel = gptResp.bom.find(g => g.grupo === "PANELES")?.items?.[0]?.descripcion || "";
    const panelData = results.allItems?.find(i => i.unidad === "m²");
    const panel = {
      label: panelLabel,
      espesor: techo?.espesor || pared?.espesor || "",
      color: techo?.color || pared?.color || "Blanco",
      au: panelData?.cantPaneles ? undefined : null,
    };
    if (escenario === "solo_techo" || escenario === "techo_fachada") {
      const fam = PANELS_TECHO[techo?.familia];
      if (fam) panel.au = fam.au;
    } else if (escenario === "solo_fachada") {
      const fam = PANELS_PARED[pared?.familia];
      if (fam) panel.au = fam.au;
    }

    const clientInfo = cliente || {};
    const project = {
      fecha: clientInfo.fecha || new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }),
      refInterna: clientInfo.ref || "",
      descripcion: clientInfo.obra || "",
    };
    const client = {
      nombre: clientInfo.nombre || "—",
      rut: clientInfo.rut || "",
      telefono: clientInfo.telefono || "",
      direccion: clientInfo.direccion || "",
    };

    const dimensions = {};
    if (techo?.zonas) {
      dimensions.zonas = techo.zonas;
      if (results.paneles?.areaTotal) dimensions.area = results.paneles.areaTotal;
      if (results.paneles?.cantPaneles) dimensions.cantPaneles = results.paneles.cantPaneles;
    }
    if (pared) {
      if (pared.alto) dimensions.alto = pared.alto;
      if (pared.perimetro) dimensions.perimetro = pared.perimetro;
      if (results.paneles?.areaNeta) dimensions.area = results.paneles.areaNeta;
      if (results.paneles?.cantPaneles) dimensions.cantPaneles = results.paneles.cantPaneles;
    }
    if (escenario === "camara_frig" && camara) {
      dimensions.zonas = [{ largo: camara.largo_int, ancho: camara.ancho_int }];
      dimensions.alto = camara.alto_int;
    }

    const groups = gptResp.bom.map(g => ({
      title: g.grupo,
      items: g.items.map(i => ({
        label: i.descripcion, sku: i.sku, cant: i.cant, unidad: i.unidad,
        pu: i.pu_usd, total: i.total_usd,
        largoBarra: i.largo_barra_m, cantPaneles: i.cant_paneles, largoPanel: i.largo_panel_m,
      })),
    }));

    const html = generatePrintHTML({
      client, project, scenario: escenario, panel,
      autoportancia: gptResp.autoportancia ? {
        ok: gptResp.autoportancia.ok,
        apoyos: gptResp.autoportancia.apoyos,
        maxSpan: gptResp.autoportancia.vano_max_m,
      } : null,
      groups,
      totals: {
        subtotalSinIVA: gptResp.resumen.subtotal_usd,
        iva: gptResp.resumen.iva_usd,
        totalFinal: gptResp.resumen.total_usd,
      },
      warnings: gptResp.advertencias,
      dimensions,
      listaPrecios: lista,
      quotationId: clientInfo.quote_code || undefined,
      showSKU: false,
      showUnitPrices: true,
    });

    const pdfId = storePdf(html);
    const baseUrl = config.publicBaseUrl.replace(/\/$/, "");
    const pdfUrl = `${baseUrl}/calc/pdf/${pdfId}`;

    registerQuotation({
      pdfId,
      pdfUrl,
      code: clientInfo.quote_code || null,
      client: clientInfo.nombre || "—",
      scenario: escenario,
      total: gptResp.resumen.total_usd,
      lista,
    });

    return res.json({
      ok: true,
      pdf_id: pdfId,
      pdf_url: pdfUrl,
      expires_in_hours: 24,
      instrucciones: "Compartí este link con el cliente. Se abre en el navegador y se puede imprimir como PDF.",
      resumen: gptResp.resumen,
    });
  } catch (err) {
    req.log.error({ err }, "calc/cotizar/pdf failed");
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /pdf/:id ─────────────────────────────────────────────────────────────

router.get("/pdf/:id", (req, res) => {
  const html = getPdf(req.params.id);
  if (!html) {
    return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cotización expirada</title></head><body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f7"><div style="text-align:center"><h1 style="color:#003366">Cotización no encontrada</h1><p style="color:#6E6E73">Este link expiró o no es válido. Solicitá una nueva cotización al asistente.</p></div></body></html>`);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// ── GET /cotizaciones ────────────────────────────────────────────────────────

router.get("/cotizaciones", (req, res) => {
  const entries = Array.from(quotationRegistry.values())
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ ok: true, count: entries.length, cotizaciones: entries });
});

// ── GET /catalogo ────────────────────────────────────────────────────────────

function panelSummary(panels, listaPrecio) {
  setListaPrecios(listaPrecio);
  const out = {};
  for (const [id, panel] of Object.entries(panels)) {
    const espesores = {};
    for (const [esp, data] of Object.entries(panel.esp)) {
      espesores[esp] = { precio_m2_usd: p(data), autoportancia_m: data.ap ?? null };
    }
    out[id] = {
      label: panel.label,
      subtipo: panel.sub,
      ancho_util_m: panel.au,
      largo_min_m: panel.lmin,
      largo_max_m: panel.lmax,
      sistema_fijacion: panel.sist,
      colores: panel.col,
      espesores,
    };
  }
  return out;
}

router.get("/catalogo", (req, res) => {
  try {
    const lista = req.query.lista || "web";
    setListaPrecios(lista === "venta" ? "venta" : "web");

    res.json({
      ok: true,
      lista,
      lista_label: LISTA_LABELS[lista] || lista,
      paneles_techo: panelSummary(PANELS_TECHO, lista),
      paneles_pared: panelSummary(PANELS_PARED, lista),
      bordes_techo: BORDER_OPTIONS,
      tipos_estructura: ["metal", "hormigon", "mixto", "madera"],
      escenarios: SCENARIOS_DEF.map(s => ({
        id: s.id,
        label: s.label,
        descripcion: s.description,
        tiene_techo: s.hasTecho,
        tiene_pared: s.hasPared,
        es_camara: !!s.isCamara,
        familias_validas: s.familias,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "calc/catalogo failed");
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /escenarios ──────────────────────────────────────────────────────────

router.get("/escenarios", (req, res) => {
  try {
    const escenarios = SCENARIOS_DEF.map(s => {
      const vis = VIS[s.id];
      const camposRequeridos = [];
      if (s.hasTecho) camposRequeridos.push("techo.familia", "techo.espesor", "techo.zonas[].largo", "techo.zonas[].ancho");
      if (s.hasPared && !s.isCamara) camposRequeridos.push("pared.familia", "pared.espesor", "pared.alto", "pared.perimetro");
      if (s.isCamara) camposRequeridos.push("pared.familia", "pared.espesor", "camara.largo_int", "camara.ancho_int", "camara.alto_int");

      const camposOpcionales = [];
      if (s.hasTecho) {
        camposOpcionales.push("techo.color", "techo.pendiente", "techo.tipoAguas", "techo.tipoEst", "techo.borders", "techo.opciones");
      }
      if (s.hasPared) {
        camposOpcionales.push("pared.color", "pared.tipoEst", "pared.numEsqExt", "pared.numEsqInt", "pared.aberturas", "pared.inclSell", "pared.incl5852");
      }
      camposOpcionales.push("lista", "flete");

      return {
        id: s.id,
        label: s.label,
        descripcion: s.description,
        tiene_techo: s.hasTecho,
        tiene_pared: s.hasPared,
        es_camara: !!s.isCamara,
        familias_validas: s.familias,
        campos_requeridos: camposRequeridos,
        campos_opcionales: camposOpcionales,
        secciones_ui: vis,
      };
    });

    res.json({ ok: true, escenarios });
  } catch (err) {
    req.log.error({ err }, "calc/escenarios failed");
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /informe — Full knowledge dump for GPT advisory ─────────────────────

function buildPriceMatrix(panels, lista) {
  setListaPrecios(lista === "venta" ? "venta" : "web");
  const rows = [];
  for (const [id, panel] of Object.entries(panels)) {
    for (const [esp, data] of Object.entries(panel.esp)) {
      rows.push({
        familia: id,
        label: panel.label,
        tipo: panel.tipo || panel.sub,
        espesor_mm: Number(esp),
        precio_m2_usd: p(data),
        autoportancia_m: data.ap ?? null,
        ancho_util_m: panel.au,
        largo_min_m: panel.lmin,
        largo_max_m: panel.lmax,
        sistema: panel.sist,
      });
    }
  }
  rows.sort((a, b) => a.precio_m2_usd - b.precio_m2_usd);
  return rows;
}

router.get("/informe", (req, res) => {
  try {
    const lista = req.query.lista || "web";
    setListaPrecios(lista === "venta" ? "venta" : "web");

    const panelesTecho = {};
    for (const [id, panel] of Object.entries(PANELS_TECHO)) {
      const espesores = {};
      for (const [esp, data] of Object.entries(panel.esp)) {
        espesores[esp] = {
          precio_m2_usd: p(data),
          autoportancia_m: data.ap ?? null,
          notas: panel.notas?.[esp] || null,
        };
      }
      panelesTecho[id] = {
        label: panel.label, subtipo: panel.sub,
        ancho_util_m: panel.au, largo_min_m: panel.lmin, largo_max_m: panel.lmax,
        sistema_fijacion: panel.sist,
        colores: panel.col,
        restricciones_color: panel.colNotes || {},
        espesor_max_color: panel.colMax || {},
        area_min_color: panel.colMinArea || {},
        espesores,
      };
    }

    const panelesPared = {};
    for (const [id, panel] of Object.entries(PANELS_PARED)) {
      const espesores = {};
      for (const [esp, data] of Object.entries(panel.esp)) {
        espesores[esp] = { precio_m2_usd: p(data) };
      }
      panelesPared[id] = {
        label: panel.label, subtipo: panel.sub,
        ancho_util_m: panel.au, largo_min_m: panel.lmin, largo_max_m: panel.lmax,
        sistema_fijacion: panel.sist,
        colores: panel.col,
        restricciones_color: panel.colNotes || {},
        notas: panel.nota50 ? { 50: panel.nota50 } : {},
        espesores,
      };
    }

    const fijaciones = {};
    for (const [id, item] of Object.entries(FIJACIONES)) {
      fijaciones[id] = { label: item.label, precio_usd: p(item), unidad: item.unidad };
    }

    const selladores = {};
    for (const [id, item] of Object.entries(SELLADORES)) {
      selladores[id] = { label: item.label, precio_usd: p(item), unidad: item.unidad };
    }

    const servicios = {
      flete: { label: SERVICIOS.flete.label, precio_usd: p(SERVICIOS.flete), unidad: SERVICIOS.flete.unidad },
    };

    const matrizPrecios = {
      techo: buildPriceMatrix(PANELS_TECHO, lista),
      pared: buildPriceMatrix(PANELS_PARED, lista),
    };

    const reglasAsesoria = {
      techo: {
        economico: "ISOROOF FOIL 3G 30mm es el más económico para techos. Ideal para tinglados simples donde la aislación no es prioridad.",
        estandar: "ISODEC EPS 100mm es la opción estándar con buena relación precio/autoportancia. Ideal para galpones y depósitos.",
        autoportante: "ISODEC EPS 150-250mm ofrece la mayor autoportancia (hasta 10.4m sin apoyos intermedios). Ideal para naves industriales de grandes luces.",
        premium: "ISOROOF PLUS 3G ofrece la máxima aislación para techos livianos. Mínimo 800m².",
        pir: "ISODEC PIR ofrece máxima resistencia al fuego (PIR). Evitar espesor 50mm.",
      },
      pared: {
        economico: "ISOPANEL EPS 50mm es el más económico pero SOLO para subdivisiones interiores. Fachada exterior mínimo 100mm.",
        estandar: "ISOPANEL EPS 100mm es la opción estándar para fachadas. Buena relación precio/aislación.",
        alto_aislamiento: "ISOPANEL EPS 150-250mm para cámaras frigoríficas o exigencias térmicas altas.",
        pir: "ISOWALL PIR para máxima resistencia al fuego en fachadas. Más costoso que EPS.",
      },
      camara: "Para cámaras frigoríficas usar ISOPANEL EPS 150-250mm en paredes. El techo se calcula automáticamente con ISODEC EPS del mismo espesor o el más cercano disponible.",
      colores: "Blanco es estándar y siempre disponible. Gris y Rojo en ISODEC EPS solo hasta 150mm con +20 días de entrega. Blanco en ISOROOF 3G requiere mínimo 500m².",
      flete: `El flete estándar cuesta USD ${p(SERVICIOS.flete).toFixed(2)} para zonas aledañas. El retiro en planta (Colonia Nicolich) es sin cargo.`,
    };

    const formulasCalculo = {
      paneles_techo: "cantPaneles = ceil(ancho / ancho_util). area = cantPaneles × largo × ancho_util. costo = area × precio_m2.",
      autoportancia: "apoyos = ceil(largo / autoportancia_m) + 1. Si largo > autoportancia_m → requiere estructura adicional.",
      fijaciones_varilla: "puntosFijacion = ceil((cantP × apoyos) × 2 + (largo × 2 / 2.5)). varillas = ceil(puntos / 4).",
      fijaciones_caballete: "Para ISOROOF. caballetes = ceil((cantP × 3 × (largo / 2.9 + 1)) + ((largo × 2) / 0.3)).",
      perfileria: "barras = ceil(dimension / largo_barra). Tornillo T1: 1 por cada 0.30m lineal de perfilería.",
      selladores_techo: "siliconas = ceil(cantP × 0.5). cintas_butilo = ceil(cantP / 10).",
      paneles_pared: "cantPaneles = ceil(perimetro / ancho_util). areaBruta = cantP × alto × au. areaNeta = areaBruta − aberturas.",
      descarte: "descarteAncho = (cantP × au) − ancho_solicitado. descarteArea = descarteAncho × largo.",
      iva: "subtotal = sum(items.total). IVA = subtotal × 0.22. total = subtotal + IVA.",
      dos_aguas: "Divide el ancho por la mitad, calcula cada agua independiente, agrega cumbrera.",
      pendiente: "largoReal = largo × (1 / cos(pendiente°)). Aplica a todos los cálculos de largo.",
    };

    const baseUrl = config.publicBaseUrl.replace(/\/$/, "");

    res.json({
      ok: true,
      meta: {
        lista, lista_label: LISTA_LABELS[lista] || lista,
        version: "3.1.0",
        timestamp: new Date().toISOString(),
        nota: "Todos los precios son SIN IVA. IVA 22% se aplica una vez al total final.",
      },
      paneles_techo: panelesTecho,
      paneles_pared: panelesPared,
      fijaciones, selladores, servicios,
      matriz_precios: matrizPrecios,
      bordes_techo: BORDER_OPTIONS,
      escenarios: SCENARIOS_DEF.map(s => ({
        id: s.id, label: s.label, descripcion: s.description,
        tiene_techo: s.hasTecho, tiene_pared: s.hasPared,
        es_camara: !!s.isCamara, familias_validas: s.familias,
      })),
      reglas_asesoria: reglasAsesoria,
      formulas_calculo: formulasCalculo,
      endpoints: {
        cotizar: `POST ${baseUrl}/calc/cotizar`,
        cotizar_pdf: `POST ${baseUrl}/calc/cotizar/pdf`,
        pdf_viewer: `GET ${baseUrl}/calc/pdf/{id}`,
      },
    });
  } catch (err) {
    req.log.error({ err }, "calc/informe failed");
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
