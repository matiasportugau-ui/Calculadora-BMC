/**
 * server/ml-crm-sync.js
 * Lógica ML → CRM_Operativo compartida entre CLI y webhook live.
 * Usada por:
 *   - scripts/panelsim-ml-crm-sync.js  (CLI / sesión)
 *   - server/index.js webhook handler  (live 24/7)
 */

import { google } from "googleapis";
import { setListaPrecios, PANELS_TECHO, PANELS_PARED, p } from "../src/data/constants.js";
import { defaultTailAGAK_ML } from "./lib/crmOperativoLayout.js";
import { analyzeQuotationGaps, formatGapsForOperator } from "./ml-quotation-gaps.js";

const SHEET_TAB  = "CRM_Operativo";
const HEADER_ROW = 3;
const CLOSE      = "Saludos BMC URUGUAY!";

// ── Date helpers ──────────────────────────────────────────────────────────

function formatDate(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}
function formatDateTime(iso) {
  const d = new Date(iso);
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function today() { return formatDate(new Date().toISOString()); }

// ── Categoría automática ──────────────────────────────────────────────────

export function autoCategoria(itemTitle = "", questionText = "") {
  const txt = (itemTitle + " " + questionText).toLowerCase();
  if (txt.includes("techo") || txt.includes("cubierta") || txt.includes("isodec")) return "Paneles Techo";
  if (txt.includes("fachada") || txt.includes("pared") || txt.includes("isopanel")) return "Paneles Fachada";
  if (txt.includes("galpón") || txt.includes("galpon")) return "Galpones";
  if (txt.includes("gotero") || txt.includes("canalón") || txt.includes("babeta")) return "Accesorios";
  if (txt.includes("caucho") || txt.includes("rubber") || txt.includes("impertech") || txt.includes("sellador")) return "Impermeabilizantes";
  return "Consultas";
}

// ── Matriz local (sin HTTP — usa datos de src/utils/calculations.js) ─────

export function buildMatrizInforme() {
  setListaPrecios("web");
  const paneles_techo = {};
  for (const [id, panel] of Object.entries(PANELS_TECHO)) {
    const espesores = {};
    for (const [esp, data] of Object.entries(panel.esp || {})) {
      espesores[esp] = { precio_m2_usd: p(data) };
    }
    paneles_techo[id] = { espesores };
  }
  const paneles_pared = {};
  for (const [id, panel] of Object.entries(PANELS_PARED)) {
    const espesores = {};
    for (const [esp, data] of Object.entries(panel.esp || {})) {
      espesores[esp] = { precio_m2_usd: p(data) };
    }
    paneles_pared[id] = { espesores };
  }
  const techo = [];
  for (const [id, panel] of Object.entries(PANELS_TECHO)) {
    for (const [esp, data] of Object.entries(panel.esp || {})) {
      techo.push({ familia: id, espesor_mm: Number(esp), precio_m2_usd: p(data) });
    }
  }
  return { paneles_techo, paneles_pared, matriz_precios: { techo } };
}

// ── Buscar precio en Matriz ───────────────────────────────────────────────

export function findMatrizPrice(itemTitle = "", informe) {
  const title = itemTitle.toLowerCase();
  const espMatch = title.match(/(\d+)\s*mm/);
  const espesor = espMatch ? parseInt(espMatch[1]) : null;

  if (title.includes("isodec") || (title.includes("techo") && title.includes("panel"))) {
    if (espesor) {
      const eps = informe?.paneles_techo?.ISODEC_EPS?.espesores?.[espesor]?.precio_m2_usd;
      if (eps) return { precio: eps, fuente: `Matriz Isodec EPS ${espesor}mm` };
    }
  }
  if (title.includes("isopanel") || title.includes("fachada") || title.includes("pared")) {
    if (espesor) {
      const eps = informe?.paneles_pared?.ISOPANEL_EPS?.espesores?.[espesor]?.precio_m2_usd
               || informe?.paneles_pared?.ISOWALL_PIR?.espesores?.[espesor]?.precio_m2_usd;
      if (eps) return { precio: eps, fuente: `Matriz Isopanel EPS ${espesor}mm` };
    }
  }
  if (title.includes("isoroof") && espesor) {
    const familia = title.includes("foil") ? "ISOROOF_FOIL"
                  : title.includes("plus") ? "ISOROOF_PLUS"
                  : "ISOROOF_3G";
    const match = (informe?.matriz_precios?.techo || []).find(
      (r) => r.familia === familia && r.espesor_mm === espesor
    );
    if (match) return { precio: match.precio_m2_usd, fuente: `Matriz ${familia} ${espesor}mm` };
  }
  return null;
}

// ── Respuesta sugerida ────────────────────────────────────────────────────

export function generateResponse(q, item, nickname, hasPriceMismatch) {
  if (hasPriceMismatch) return "";
  const gaps = analyzeQuotationGaps(q, item);
  if (gaps.missingPoints.length > 0) {
    return formatGapsForOperator(nickname, gaps);
  }
  const text      = (q.text || "").toLowerCase();
  const itemTitle = (item?.title || "").toLowerCase();
  const priceML   = item?.price;
  const firstName = nickname.replace(/[_\d]/g, " ").trim().split(" ")[0] || nickname;

  const isColorQ   = text.includes("color") || text.includes("opciones") || text.includes("colores");
  const isShipping = text.includes("envío") || text.includes("envio") || text.includes("flete") || text.includes("delivery");
  const hasDims    = /\d+\s*(x|por|\*)\s*\d+/.test(text);
  const hasM2      = text.includes("m2") || text.includes("m²") || text.includes("metro");
  const isPriceQ   = text.includes("cuánto") || text.includes("cuanto") || text.includes("precio") ||
                     text.includes("costo") || text.includes("presupuesto") || text.includes("vale") || text.includes("cuesta");
  const isTechoQ   = text.includes("techo");
  const isFachadaQ = text.includes("fachada") || text.includes("pared");

  const pubEsTecho   = itemTitle.includes("techo") || itemTitle.includes("isodec") || itemTitle.includes("cubierta");
  const pubEsFachada = itemTitle.includes("fachada") || itemTitle.includes("isopanel") || itemTitle.includes("pared");
  const productoEquivocado = (isTechoQ && pubEsFachada) || (isFachadaQ && pubEsTecho);

  if (isColorQ) {
    const color = item?.attributes?.find((a) => a.id === "COLOR")?.value_name;
    const colorText = color ? `en color ${color}` : "en los colores indicados en la publicación";
    return `Hola ${firstName}! Esta publicación viene ${colorText}. Si necesitás otra variante escribinos por acá y te confirmamos disponibilidad. ${CLOSE}`;
  }
  if (productoEquivocado) {
    const tipoNecesita  = isTechoQ ? "techo" : "fachada";
    const tipoPublicado = pubEsTecho ? "techo" : "fachada";
    if (priceML)
      return `Hola ${firstName}! Esta publicación corresponde a paneles de ${tipoPublicado}. Para ${tipoNecesita} tenemos otra línea — el precio publicado es USD ${priceML}/m². ¿Nos confirmás las medidas y el uso para armarte el presupuesto correcto? ${CLOSE}`;
    return `Hola ${firstName}! Esta publicación es para paneles de ${tipoPublicado}. Para ${tipoNecesita} contamos con otra línea — escribinos con las medidas y te cotizamos. ${CLOSE}`;
  }
  if ((hasDims || hasM2) && priceML)
    return `Hola ${firstName}! El precio publicado es de USD ${priceML}/m². Con las medidas que indicás te armamos el presupuesto completo — confirmanos largo y ancho si querés el detalle. ${CLOSE}`;
  if (isShipping)
    return `Hola ${firstName}! Realizamos envíos a todo el país. Indicanos la ciudad de entrega y la cantidad que necesitás para cotizarte el traslado. ${CLOSE}`;
  if (isPriceQ && priceML)
    return `Hola ${firstName}! El precio es de USD ${priceML}/m² IVA inc. Si nos indicás las medidas (largo × ancho) te calculamos la cantidad exacta y el total. ${CLOSE}`;
  return `Hola ${firstName}! Con gusto te ayudamos. ¿Podés darnos más detalles sobre lo que necesitás (medidas, cantidad, uso)? ${CLOSE}`;
}

// ── Sheets client ─────────────────────────────────────────────────────────

async function createSheetsClient(credsPath) {
  const auth = new google.auth.GoogleAuth({
    ...(credsPath ? { keyFile: credsPath } : {}),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

// ── syncUnansweredQuestions ───────────────────────────────────────────────
// Punto de entrada principal — usado por CLI y webhook.
// `ml`        : instancia createMercadoLibreClient (con token ya inicializado)
// `sheetId`   : BMC_SHEET_ID
// `credsPath` : GOOGLE_APPLICATION_CREDENTIALS (vacío = Application Default Credentials)
// `logger`    : objeto con .info/.warn/.error opcionales (compatible con pino y console)

export async function syncUnansweredQuestions({ ml, sheetId, credsPath, logger = console }) {
  // 1. Matriz local
  let informe = null;
  try { informe = buildMatrizInforme(); } catch { /* sin Matriz */ }

  // 2. Preguntas sin responder
  const sellerId = await ml.resolveSellerId();
  const qRes = await ml.requestWithRetries({
    method: "GET",
    path: "/questions/search",
    query: { seller_id: sellerId, status: "UNANSWERED", limit: 50 },
  });
  const questions = qRes.questions || [];
  if (questions.length === 0) {
    logger.info?.("✓ Sin preguntas ML pendientes");
    return { synced: 0 };
  }
  logger.info?.(`  ${questions.length} pregunta(s) sin responder`);
  questions.sort((a, b) => new Date(a.date_created) - new Date(b.date_created));

  // 3. Nicknames
  const nicknames = {};
  for (const q of questions) {
    const uid = q.from?.id;
    if (uid && !nicknames[uid]) {
      const u = await ml.requestWithRetries({ method: "GET", path: `/users/${uid}` }).catch(() => null);
      nicknames[uid] = u?.nickname || `ML#${uid}`;
    }
  }

  // 4. Items
  const items = {};
  for (const q of questions) {
    if (q.item_id && !items[q.item_id]) {
      items[q.item_id] = await ml.requestWithRetries({ method: "GET", path: `/items/${q.item_id}` }).catch(() => null);
    }
  }

  // 5. Sheets
  const sheets = await createSheetsClient(credsPath);
  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${SHEET_TAB}'!A${HEADER_ROW}:AF2000`,
  });
  const allRows  = dataRes.data.values || [];
  const headers  = allRows[0] || [];
  const dataRows = allRows.slice(1);
  const iObs   = headers.indexOf("Observaciones");
  const iFecha = headers.indexOf("Fecha");

  // 6. Dedup por Q:<id>
  const existingQIds = new Set();
  for (const row of dataRows) {
    const match = (row[iObs] || "").match(/Q:(\d+)/);
    if (match) existingQIds.add(match[1]);
  }
  const newQuestions = questions.filter((q) => !existingQIds.has(String(q.id)));
  if (newQuestions.length === 0) {
    logger.info?.("✓ Todas las preguntas ya están en el CRM");
    return { synced: 0 };
  }
  logger.info?.(`  ${newQuestions.length} nueva(s) para agregar`);

  // 7. Primeras filas vacías
  const emptyRows = [];
  for (let i = 0; i < dataRows.length; i++) {
    if (!(dataRows[i][iFecha] || "").trim()) emptyRows.push(HEADER_ROW + 1 + i);
    if (emptyRows.length >= newQuestions.length) break;
  }

  // 8. Escribir
  let written = 0;
  const newRows = [];
  for (let i = 0; i < newQuestions.length && i < emptyRows.length; i++) {
    const q         = newQuestions[i];
    const rowNum    = emptyRows[i];
    const item      = items[q.item_id] || {};
    const nickname  = nicknames[q.from?.id] || `ML#${q.from?.id}`;
    const itemTitle = item.title || q.item_id || "";
    const priceML   = item.price || null;

    const matrizMatch      = informe ? findMatrizPrice(itemTitle, informe) : null;
    const hasPriceMismatch = priceML && matrizMatch && (priceML !== matrizMatch.precio);
    const priceAlert       = hasPriceMismatch
      ? `⚠ PRECIO ML USD ${priceML} ≠ ${matrizMatch.fuente} USD ${matrizMatch.precio} — verificar antes de responder`
      : "";

    const estado            = hasPriceMismatch ? "Pendiente revisión precio" : "Pendiente";
    const respuestaSugerida = generateResponse(q, item, nickname, hasPriceMismatch);
    const obsBase           = `Q:${q.id} | ${formatDateTime(q.date_created)} | ${q.item_id} ${itemTitle}`;
    const obs               = priceAlert ? `${obsBase} | ${priceAlert}` : obsBase;

    const rowCore = [
      formatDate(q.date_created), nickname, "", "", "ML", q.text,
      autoCategoria(itemTitle, q.text), "Alta", estado, "PANELSIM",
      "Responder ML", today(), "Nuevo", "No", "No", "", "", "Hoy", "No", "",
      "ML", obs, formatDate(q.date_created), "", "", "", "Sí", "", "", "SI",
      respuestaSugerida,
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${SHEET_TAB}'!B${rowNum}:AK${rowNum}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[...rowCore, ...defaultTailAGAK_ML()]],
      },
    });

    newRows.push({ questionId: String(q.id), rowNum, questionText: q.text || "", itemTitle, nickname });
    logger.info?.(`  ✓ F${rowNum} — Q:${q.id} | ${nickname} | "${q.text?.slice(0, 45)}"${hasPriceMismatch ? " 🔴 revisión precio" : ""}`);
    written++;
  }

  return { synced: written, rows: newRows };
}
