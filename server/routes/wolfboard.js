/**
 * Wolfboard routes — Admin 2.0 ↔ CRM_Operativo cotizaciones management.
 *
 * Admin. column layout — LIVE sheet header (see server/lib/adminSheetSchema.js
 * for the SoT; realigned 2026-10-06 after `admin-bloque-columnas-corridas`
 * caught every writer here, in adminInboundRow.js and in hitlAdminBoard.js
 * silently stealing Interpretación AI / Respuesta AI / Datos Faltantes /
 * PRESUPUESTO on real human rows):
 *
 *   A(0)=ID / link           (humans leave empty; API writes MAN-/WBK-)
 *   B(1)=Asig.               (operator initials; writers leave empty)
 *   C(2)=Estado              (Pendiente / Cotizable / Aprobado / Enviado / …)
 *   D(3)=Fecha
 *   E(4)=Cliente
 *   F(5)=Origen              (short codes: WA/ML/FB/IG/VW/EM/CL/LO/LL)
 *   G(6)=Teléfono-Contacto
 *   H(7)=Dirección / Zona
 *   I(8)=Consulta
 *   J(9)=Interpretación AI
 *   K(10)=Respuesta AI
 *   L(11)=Datos Faltantes
 *   M(12)=PRESUPUESTO        (PDF hyperlink; also GCS HTML link)
 *   N(13)=Enviado            (checkbox; default FALSE on create)
 *
 * Routes:
 *   GET  /pendientes?scope=consulta|admin — filas Admin. (default: scope=consulta = col I no vacía; admin = cualquier dato en A–N)
 *   POST /sync          — Admin.K (Respuesta AI) → CRM AF (match por ID col A si existe, si no por texto G/W)
 *   POST /row           — save respuesta/link/aprobado for a specific row (writes K/M/C per the live header)
 *   POST /row-create    — append a new row aligned to the live header (A..N, Estado=Pendiente, Enviado=FALSE)
 *   POST /enviados      — move row to Enviados tab, delete from Admin
 *   GET  /export?scope=… — CSV (mismo criterio que /pendientes)
 *   POST /quote-batch   — batch AI quote generation (writes Respuesta AI → K, PDF/HTML link → M)
 */
import { Router } from "express";
import { callAgentOnce } from "../lib/agentCore.js";
import { getSheetsClient, redactGoogleError } from "../lib/googleSheetsAuth.js";
import {
  ADMIN_COL_INDEX,
  ADMIN_ESTADO_APROBADO,
  ADMIN_ESTADO_PENDIENTE,
  ADMIN_RANGE_END,
  ADMIN_RANGE_START,
  ADMIN_RANGE_WIDTH,
  adminOrigenShort,
  buildAdminRow,
  readAdminCell,
  validateAdminHeader,
} from "../lib/adminSheetSchema.js";
import { calcTechoCompleto, calcParedCompleto, calcTotalesSinIVA, mergeZonaResults } from "../../src/utils/calculations.js";
import { setListaPrecios } from "../../src/data/constants.js";
import { bomToGroups, fmtPrice, generatePrintHTML } from "../../src/utils/helpers.js";
import { uploadQuoteToGcs, uploadQuoteJsonToGcs } from "../lib/gcsUpload.js";
import { uploadQuoteToDrive } from "../lib/driveUpload.js";
import { buildWolfboardQuoteReplaySnapshot } from "../lib/wolfboardQuoteSnapshot.js";
import { sanitizeCellValue } from "../lib/sheetsCsvGuard.js";
import { appendQuoteToCrm } from "../lib/crmAppend.js";
import { normalizePanelinRole, resolveInternalServiceActor } from "../lib/panelinInternalRbac.js";
import { deriveOutcome } from "../lib/wolfboardOutcome.js";
import {
  requireWolfboardRead,
  requireWolfboardWrite,
} from "../middleware/requireWolfboardAuth.js";
import crypto from "node:crypto";
import { getAvailableProviders } from "../lib/aiProviderConfig.js";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MIN_CONSULTA_LEN = 20;
const ERROR_MARKER = "⚠ Requiere atención manual";
const RED_BG = { red: 1.0, green: 0.267, blue: 0.267 };
const WHITE_BG = { red: 1.0, green: 1.0, blue: 1.0 };

// Live Admin header: Respuesta AI lives in column K (not J). Used to colour the
// cell that holds the AI reply red when a batch call failed.
const COL_RESPUESTA_AI = ADMIN_COL_INDEX.K;

/**
 * Read the LIVE Admin. row 1 and fail closed when the header no longer
 * matches ADMIN_COLUMNS. Writers MUST stop before touching cells when
 * the header has drifted — the previous bug corrupted data silently
 * because nobody validated the live header.
 */
async function ensureAdminHeader(sheets, sheetId, tab) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tab}'!1:1`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const row = resp?.data?.values?.[0] || [];
  return validateAdminHeader(row);
}

function adminHeaderMismatch503(res, mismatches) {
  return res.status(503).json({
    ok: false,
    code: "ADMIN_HEADER_MISMATCH",
    error: "La fila 1 de Admin. no coincide con el esquema esperado; writer en pausa.",
    mismatches,
  });
}

const QUOTE_SYSTEM_PROMPT = `Sos Panelin, el asistente experto de ventas de BMC Uruguay (METALOG SAS), empresa fabricante y distribuidora de paneles de aislamiento térmico para techos, paredes, fachadas y cámaras frigoríficas.

Tu tarea: dado el texto de consulta de un cliente, generá una respuesta comercial concisa y profesional en español rioplatense (Uruguay). La respuesta debe:
1. Confirmar qué producto(s) aplican (ISODEC EPS/PIR, ISOROOF 3G, ISOROOF FOIL 3G, ISOPANEL EPS, ISOWALL PIR, etc.)
2. Mencionar precio referencial USD/m² sin IVA si podés identificar el producto y espesor con certeza
3. Si faltan datos (dimensiones, espesor, color, uso) indicar qué falta de forma concisa
4. No inventar datos que no están en la consulta; si no podés cotizar con certeza, indicar qué necesitás

Precios clave (USD/m² sin IVA, lista web):
- ISODEC EPS techo: 100mm=$45.97 | 150mm=$51.71 | 200mm=$57.99 | 250mm=$63.74
- ISOROOF 3G: 30mm=$48.63 | 40mm=$51.10 | 50mm=$53.56 | 80mm=$62.98 | 100mm=$69.15
- ISODEC PIR techo: 50mm=$50.91 | 80mm=$52.04 | 120mm=$62.55
- ISOROOF FOIL 3G: 30mm=$39.40 | 50mm=$44.66
- ISOROOF PLUS 3G (mínimo 800m²): 50mm=$60.94 | 80mm=$71.61
- ISOROOF COLONIAL 40mm: $75.72
- ISOPANEL EPS pared: 50mm=$41.79 | 100mm=$45.97 | 150mm=$51.71
- ISOWALL PIR pared: 50mm=$54.54 | 80mm=$65.03 | 100mm=$71.71
IVA Uruguay = 22% sobre el subtotal (no incluido en los precios anteriores).

Si la consulta tiene menos de 10 palabras o no identifica ningún producto, respondé exactamente: "Consulta incompleta — necesito más detalles para cotizar."

Respondé solo con el texto de respuesta al cliente, sin encabezados ni comentarios adicionales.`;

const PARAM_EXTRACT_PROMPT = `Sos un extractor de datos para BMC Uruguay (paneles de aislamiento térmico).
Dado el texto de consulta de un cliente, extraé los parámetros para calcular un presupuesto.
Respondé SOLO con un objeto JSON válido, sin texto adicional, sin markdown.

Familias de paneles de techo: ISODEC_EPS (más común), ISOROOF_3G, ISODEC_PIR, ISOROOF_FOIL_3G, ISOROOF_PLUS_3G, ISOROOF_COLONIAL
Familias de paneles de pared: ISOPANEL_EPS (más común), ISOWALL_PIR
Espesores típicos techo (mm): 80, 100, 150, 200. Espesores típicos pared (mm): 50, 100, 150.
Escenarios: solo_techo (galpón/nave/tinglado/depósito), solo_fachada (paredes/fachada), techo_fachada (ambos), camara_frig (cámara de frío).

{"escenario":"solo_techo|solo_fachada|techo_fachada|camara_frig|null","techo":{"familia":"string|null","espesor":0,"largo":0,"ancho":0,"tipoEst":"metal|hormigon|madera|null"},"pared":{"familia":"string|null","espesor":0,"alto":0,"perimetro":0},"camara":{"largo_int":0,"ancho_int":0,"alto_int":0},"confianza":"alta|media|baja","faltan":["lista de datos faltantes"]}

Usá null o 0 para valores desconocidos. Si no hay escenario claro, usá null.`;

const ESCENARIO_LABELS = {
  solo_techo: "Solo Techo", solo_fachada: "Solo Fachada",
  techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica",
};

function runBatchCalc(extracted, usedDefaults) {
  const { escenario, techo, pared, camara } = extracted || {};
  if (!escenario || escenario === "null") return null;

  setListaPrecios("web");

  if (escenario === "solo_techo" || escenario === "techo_fachada") {
    if (!techo?.largo || !techo?.ancho) return null;
    const familia = techo.familia && techo.familia !== "null" ? techo.familia
      : (usedDefaults.push("panel ISODEC EPS"), "ISODEC_EPS");
    const espesor = techo.espesor || (usedDefaults.push("espesor 100mm"), 100);
    const tipoEst = techo.tipoEst && techo.tipoEst !== "null" ? techo.tipoEst : "metal";
    try {
      const r = calcTechoCompleto({
        familia, espesor, tipoEst, color: "Blanco",
        largo: techo.largo, ancho: techo.ancho,
        borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
        opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
      });
      return r?.error ? null : { ...r, _escenario: "solo_techo" };
    } catch { return null; }
  }

  if (escenario === "solo_fachada") {
    if (!pared?.alto || !pared?.perimetro) return null;
    const familia = pared.familia && pared.familia !== "null" ? pared.familia
      : (usedDefaults.push("panel ISOPANEL EPS"), "ISOPANEL_EPS");
    const espesor = pared.espesor || (usedDefaults.push("espesor 100mm"), 100);
    try {
      const r = calcParedCompleto({
        familia, espesor, alto: pared.alto, perimetro: pared.perimetro,
        tipoEst: "metal", numEsqExt: 4, numEsqInt: 0, inclSell: true,
      });
      return r?.error ? null : { ...r, _escenario: "solo_fachada" };
    } catch { return null; }
  }

  if (escenario === "camara_frig") {
    if (!camara?.largo_int || !camara?.ancho_int || !camara?.alto_int) return null;
    const familia = pared?.familia && pared.familia !== "null" ? pared.familia
      : (usedDefaults.push("panel ISOPANEL EPS"), "ISOPANEL_EPS");
    const espesor = pared?.espesor || (usedDefaults.push("espesor 150mm"), 150);
    try {
      const perim = 2 * (camara.largo_int + camara.ancho_int);
      const rP = calcParedCompleto({
        familia, espesor, perimetro: perim, alto: camara.alto_int,
        tipoEst: "metal", numEsqExt: 4, numEsqInt: 0, inclSell: true,
      });
      const rT = calcTechoCompleto({
        familia, espesor, largo: camara.largo_int, ancho: camara.ancho_int, tipoEst: "metal",
        borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
        opciones: { inclCanalon: false, inclGotSup: false, inclSell: true }, color: "Blanco",
      });
      const allItems = [...(rP?.allItems || []), ...(rT?.allItems || [])];
      const totales = calcTotalesSinIVA(allItems);
      return { ...rP, techoResult: rT, allItems, totales, _escenario: "camara_frig" };
    } catch { return null; }
  }

  return null;
}

function formatCalcResult(raw, extracted, usedDefaults) {
  if (!raw) return null;
  const escenario = raw._escenario || extracted?.escenario || "cotización";
  const allItems = raw.allItems || [];
  const totales = raw.totales || calcTotalesSinIVA(allItems);
  const area = raw.paneles?.areaTotal ?? raw.paneles?.areaNeta ?? 0;
  const cantPaneles = raw.paneles?.cantPaneles ?? 0;
  const panelLabel = allItems.find(i => i.unidad === "m²")?.label || "";

  let msg = `Cotización ${panelLabel} — ${ESCENARIO_LABELS[escenario] || escenario}.`;
  if (area) msg += ` Área: ${area} m².`;
  if (cantPaneles) msg += ` Paneles: ${cantPaneles}.`;
  msg += ` Subtotal: USD ${fmtPrice(totales.subtotalSinIVA)} + IVA 22%: USD ${fmtPrice(totales.iva)} = TOTAL USD ${fmtPrice(totales.totalFinal)}.`;

  const faltan = Array.isArray(extracted?.faltan) ? extracted.faltan : [];
  if (usedDefaults.length > 0) {
    msg += `\n\n* Presupuesto de referencia con ${usedDefaults.join(", ")}. Confirmanos si preferís otro producto o espesor.`;
  }
  if (faltan.length > 0) {
    msg += `\nPara ajustar mejor necesitamos: ${faltan.join(", ")}.`;
  }
  msg += "\n\nSaludos, BMC URUGUAY!";
  return msg.trim();
}

function sheetsAuthFail(res, err) {
  return res.status(503).json({
    ok: false,
    error: "Sheets auth error: " + redactGoogleError(err?.message || err),
  });
}

function normalizeText(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** 0-based indices when reading `CRM_Operativo!A4:AK` as row[] (A = 0). */
const CRM_INDEX = { A: 0, G: 6, W: 22 };

function normalizeCorrelationId(s) {
  return String(s ?? "").trim();
}

function generateWbkCorrelationId() {
  return `WBK-${crypto.randomUUID()}`;
}

/**
 * First segment of observaciones (W): Wolfboard / appendQuoteToCrm joins
 * `consulta — PDF: …` with a spaced dash; split keeps the original consulta stem.
 */
function observacionesConsultaStem(w) {
  const s = String(w ?? "").trim();
  if (!s) return "";
  const seg = s.split(/\s+[—–−-]\s+/)[0] || s;
  return String(seg).trim();
}

/** True if CRM row G or W (full or stem) matches Admin consulta after normalizeText. */
function consultaMatchesCrmRow(cr, consultaRaw) {
  const q = normalizeText(consultaRaw);
  if (!q) return false;
  const g = normalizeText(cr.G);
  const wFull = normalizeText(cr.W);
  const wStem = normalizeText(observacionesConsultaStem(cr.W));
  return (g && g === q) || (wFull && wFull === q) || (wStem && wStem === q);
}

/**
 * Find CRM row for an Admin consulta. Scans **bottom-up** so duplicate keys
 * prefer the most recently appended row.
 */
function findCrmRowByConsulta(crmRows, consulta) {
  if (!String(consulta ?? "").trim()) return null;
  for (let i = crmRows.length - 1; i >= 0; i--) {
    const cr = crmRows[i];
    if (consultaMatchesCrmRow(cr, consulta)) return cr;
  }
  return null;
}

/**
 * Match Admin ↔ CRM: prefer **column A** (corr. id) on both sheets; else text (G/W).
 * @returns {{ cr: object, matchKind: "id"|"text" }|null}
 */
function findCrmRowForWolfboard(crmRows, consulta, correlationId) {
  const cid = normalizeCorrelationId(correlationId);
  if (cid) {
    for (let i = crmRows.length - 1; i >= 0; i--) {
      const cr = crmRows[i];
      const a = normalizeCorrelationId(cr.corrId);
      if (a && a === cid) return { cr, matchKind: "id" };
    }
  }
  const byText = findCrmRowByConsulta(crmRows, consulta);
  if (byText) return { cr: byText, matchKind: "text" };
  return null;
}

function mapCrmRowsForWolfboardMatch(values) {
  return (values || []).map((row, idx) => ({
    _rowNum: idx + 4,
    corrId: String(row[CRM_INDEX.A] ?? "").trim(),
    G: String(row[CRM_INDEX.G] ?? "").trim(),
    W: String(row[CRM_INDEX.W] ?? "").trim(),
  }));
}

// Top-10 run 2026-05-11 (item #9): helper para 503 ENV_MISSING con shape estructurado (envVar, where, docs).
// `error` se mantiene en formato `<EnvVar> not configured` por compat (auth-routes.test.js parsea este string).
function envMissing503(res, envVar, where = "Cloud Run env / .env local") {
  return res.status(503).json({
    ok: false,
    code: "ENV_MISSING",
    envVar,
    where,
    docs: "AGENTS.md#env",
    error: `${envVar} not configured`,
  });
}

/**
 * Soft role hint logger — Hybrid RBAC step 1 (per drafts/01-outcome-rbac-proposal.md).
 * Logs the resolved role via pino (req.log) WITHOUT enforcement. Decision to add
 * enforcement (roleMeetsMin checks) is gated on log data; not part of this commit.
 * Called AFTER requireAuth passes — the actor token is already verified.
 */
function logRoleHint(req, config) {
  if (!req.log) return; // pino-http may be absent in tests
  const actor = resolveInternalServiceActor(req, config);
  if (!actor.ok) return;
  // roleSource derived AFTER resolution so an invalid header (e.g. typo) that
  // got ignored doesn't get mislabeled as "header" — we compare the effective
  // role to what each source would have produced.
  const headerRole = normalizePanelinRole(req.headers["x-panelin-role"]);
  const envRole = normalizePanelinRole(process.env.PANELIN_SERVICE_DEFAULT_ROLE);
  const roleSource =
    headerRole && headerRole === actor.role ? "header" :
    envRole && envRole === actor.role ? "env" :
    "default";
  req.log.info(
    { role: actor.role, route: req.path, method: req.method, roleSource },
    "wolfboard role hint",
  );
}

/**
 * Mapa de fila Admin. (A2:N) → objeto unificado.
 * Column indices follow the LIVE header (adminSheetSchema.js), NOT the old
 * pre-realignment comment-block layout.
 */
function mapAdminSheetRow(row, idx, adminSheetId) {
  const sheetBase = `https://docs.google.com/spreadsheets/d/${adminSheetId}/edit`;
  const estado = String(readAdminCell(row, "C") ?? "").trim();
  const enviadoRaw = String(readAdminCell(row, "N") ?? "").trim();
  return {
    rowNum: idx + 2,
    id: String(readAdminCell(row, "A") ?? "").trim(),
    asig: String(readAdminCell(row, "B") ?? "").trim(),
    estado,
    fecha: String(readAdminCell(row, "D") ?? "").trim(),
    cliente: String(readAdminCell(row, "E") ?? "").trim(),
    canal: String(readAdminCell(row, "F") ?? "").trim(),
    origen: String(readAdminCell(row, "F") ?? "").trim(),
    telefono: String(readAdminCell(row, "G") ?? "").trim(),
    zona: String(readAdminCell(row, "H") ?? "").trim(),
    consulta: String(readAdminCell(row, "I") ?? "").trim(),
    interpretacionAi: String(readAdminCell(row, "J") ?? "").trim(),
    respuesta: String(readAdminCell(row, "K") ?? "").trim(),
    datosFaltantes: String(readAdminCell(row, "L") ?? "").trim(),
    link: String(readAdminCell(row, "M") ?? "").trim(),
    enviado: /^(true|1|sí|si|yes)$/i.test(enviadoRaw),
    outcome: deriveOutcome(estado),
    sheetUrl: sheetBase,
  };
}

function adminRowHasAnyData(r) {
  return [
    r.id,
    r.asig,
    r.estado,
    r.fecha,
    r.cliente,
    r.canal,
    r.telefono,
    r.zona,
    r.consulta,
    r.interpretacionAi,
    r.respuesta,
    r.datosFaltantes,
    r.link,
  ].some((x) => String(x ?? "").trim() !== "");
}

/**
 * @param {"consulta"|"admin"} scope
 *   - consulta: solo filas con texto en I (comportamiento histórico / “cola de respuesta”).
 *   - admin: todas las filas con algún dato en A–M (visión completa del tablero).
 */
function filterAdminRowsByScope(rows, scope) {
  const s = String(scope || "consulta").toLowerCase();
  if (s === "admin" || s === "all" || s === "sheet") {
    return rows.filter(adminRowHasAnyData);
  }
  return rows.filter((r) => String(r.consulta || "").trim());
}

export function createWolfboardRouter(config) {
  const router = Router();

  // ── GET /pendientes ───────────────────────────────────────────────────────
  router.get("/pendientes", requireWolfboardRead, async (req, res) => {
    logRoleHint(req, config);
    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    if (!adminSheetId) return envMissing503(res, "WOLFB_ADMIN_SHEET_ID");

    const scopeRaw = String(req.query.scope || "consulta").trim().toLowerCase();
    const scope = scopeRaw === "admin" || scopeRaw === "all" || scopeRaw === "sheet" ? "admin" : "consulta";

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return sheetsAuthFail(res, e); }

    let rawRows;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: adminSheetId,
        range: `'${adminTab}'!${ADMIN_RANGE_START}2:${ADMIN_RANGE_END}`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      rawRows = resp.data.values || [];
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer Admin: " + e.message });
    }

    const mapped = rawRows.map((row, idx) => mapAdminSheetRow(row, idx, adminSheetId));
    const data = filterAdminRowsByScope(mapped, scope);

    return res.json({
      ok: true,
      scope,
      sheetRowCount: rawRows.length,
      count: data.length,
      data,
    });
  });

  // ── POST /sync ────────────────────────────────────────────────────────────
  router.post("/sync", requireWolfboardWrite, async (req, res) => {
    logRoleHint(req, config);
    const dryRun = config.wolfbDryRun;
    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    const crmSheetId = config.bmcSheetId;
    const crmTab = config.wolfbCrmMainTab;
    if (!adminSheetId) return envMissing503(res, "WOLFB_ADMIN_SHEET_ID");

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return sheetsAuthFail(res, e); }

    let adminRows;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: adminSheetId,
        range: `'${adminTab}'!${ADMIN_RANGE_START}2:${ADMIN_RANGE_END}`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      // Respuesta AI is column K on the LIVE header (not J — see
      // adminSheetSchema.js). Pre-realignment this read J, which is now
      // Interpretación AI, so the propagation to CRM.AF would push the
      // wrong text.
      adminRows = (resp.data.values || []).map((row, idx) => ({
        rowNum: idx + 2,
        id: String(readAdminCell(row, "A") ?? "").trim(),
        consulta: String(readAdminCell(row, "I") ?? "").trim(),
        respuesta: String(readAdminCell(row, "K") ?? "").trim(),
      })).filter(r => r.consulta && r.respuesta && !r.respuesta.startsWith("⚠"));
    } catch (e) {
      // Top-30 run 2026-05-12 (#A9): log estructurado antes del 503 para visibilizar el origen.
      if (req.log) req.log.error({ err: e?.message || String(e), adminSheetId, adminTab }, "wolfboard sync — read Admin failed");
      return res.status(503).json({ ok: false, error: "Error al leer Admin: " + e.message });
    }

    if (!crmSheetId || adminRows.length === 0) {
      return res.json({ ok: true, updatedAdmin: 0, updatedCrm: 0, skipped: 0, dryRun });
    }

    let crmRows = [];
    try {
      const crmResp = await sheets.spreadsheets.values.get({
        spreadsheetId: crmSheetId,
        range: `'${crmTab}'!A4:AK`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      crmRows = mapCrmRowsForWolfboardMatch(crmResp.data.values || []);
    } catch (e) {
      // Top-30 run 2026-05-12 (#A9): el read de CRM era best-effort; ahora al menos lo logueamos para no perder señal.
      if (req.log) req.log.warn({ err: e?.message || String(e), crmSheetId, crmTab }, "wolfboard sync — read CRM best-effort failed");
    }

    const crmUpdates = [];
    let skipped = 0;
    for (const aRow of adminRows) {
      const hit = findCrmRowForWolfboard(crmRows, aRow.consulta, aRow.id);
      const match = hit?.cr;
      if (match) {
        // CSV/formula injection guard — even though the source is the Admin
        // sheet, the value is operator-supplied and gets re-written into CRM
        // with USER_ENTERED, so a leading =/+/-/@ would still execute.
        crmUpdates.push({ range: `'${crmTab}'!AF${match._rowNum}`, values: [[sanitizeCellValue(aRow.respuesta)]] });
      } else {
        skipped++;
      }
    }

    if (!dryRun && crmUpdates.length > 0) {
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: crmSheetId,
          requestBody: { valueInputOption: "USER_ENTERED", data: crmUpdates },
        });
      } catch (e) {
        // Top-30 run 2026-05-12 (#A9): log estructurado antes del 503 — write CRM falló, este es el origen del 503 más opaco antes.
        if (req.log) req.log.error({ err: e?.message || String(e), crmSheetId, crmTab, updates: crmUpdates.length }, "wolfboard sync — batchUpdate CRM failed");
        return res.status(503).json({ ok: false, error: "Error al escribir en CRM: " + e.message });
      }
    }

    return res.json({ ok: true, updatedAdmin: 0, updatedCrm: crmUpdates.length, skipped, dryRun });
  });

  // ── POST /row ─────────────────────────────────────────────────────────────
  router.post("/row", requireWolfboardWrite, async (req, res) => {
    logRoleHint(req, config);
    const dryRun = config.wolfbDryRun;
    const {
      adminRow,
      respuesta,
      link,
      aprobado,
      interpretacion,
      interpretacion_ai: interpretacionAi,
      datos_faltantes: datosFaltantes,
      replaySnapshotUrl, // accepted for compat but intentionally dropped (see below)
    } = req.body || {};
    if (!adminRow) return res.status(400).json({ ok: false, error: "adminRow requerido" });

    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    const crmSheetId = config.bmcSheetId;
    const crmTab = config.wolfbCrmMainTab;
    if (!adminSheetId) return envMissing503(res, "WOLFB_ADMIN_SHEET_ID");

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return sheetsAuthFail(res, e); }

    if (!dryRun) {
      try {
        const headerCheck = await ensureAdminHeader(sheets, adminSheetId, adminTab);
        if (!headerCheck.ok) return adminHeaderMismatch503(res, headerCheck.mismatches);
      } catch (e) {
        return res.status(503).json({ ok: false, error: "Error al leer header Admin: " + e.message });
      }
    }

    // CSV/formula injection guard — see server/lib/sheetsCsvGuard.js. Sheets
    // writes use USER_ENTERED so any leading =/+/-/@/tab/CR is interpreted as
    // a formula.
    const safeRespuesta = respuesta !== undefined ? sanitizeCellValue(respuesta) : undefined;
    const safeLink = link !== undefined ? sanitizeCellValue(link) : undefined;
    const safeInterpretacion = (interpretacion ?? interpretacionAi) !== undefined
      ? sanitizeCellValue(interpretacion ?? interpretacionAi)
      : undefined;
    const safeDatosFaltantes = datosFaltantes !== undefined ? sanitizeCellValue(datosFaltantes) : undefined;

    // Map writes to the LIVE header letters:
    //   respuesta       → K (Respuesta AI)   [was J, overwrote Interpretación AI]
    //   link            → M (PRESUPUESTO)    [was K, overwrote Respuesta AI]
    //   aprobado        → C (Estado)         [was L, overwrote Datos Faltantes]
    //   interpretacion  → J (Interpretación AI, new patchable field)
    //   datos_faltantes → L (Datos Faltantes, new patchable field)
    //
    // replaySnapshotUrl is INTENTIONALLY DROPPED: it used to write to M which
    // is now PRESUPUESTO / PDF link — writing a JSON replay URL there would
    // clobber the PDF link that the HITL team maintains. The field is still
    // accepted so existing callers don't 400; it is simply logged and ignored.
    const adminUpdates = [];
    if (safeRespuesta !== undefined) adminUpdates.push({ range: `'${adminTab}'!K${adminRow}`, values: [[safeRespuesta]] });
    if (safeLink !== undefined) adminUpdates.push({ range: `'${adminTab}'!M${adminRow}`, values: [[safeLink]] });
    if (safeInterpretacion !== undefined) {
      adminUpdates.push({ range: `'${adminTab}'!J${adminRow}`, values: [[safeInterpretacion]] });
    }
    if (safeDatosFaltantes !== undefined) {
      adminUpdates.push({ range: `'${adminTab}'!L${adminRow}`, values: [[safeDatosFaltantes]] });
    }
    if (aprobado) adminUpdates.push({ range: `'${adminTab}'!C${adminRow}`, values: [[ADMIN_ESTADO_APROBADO]] });
    if (replaySnapshotUrl !== undefined && req.log) {
      req.log.warn(
        { adminRow, haveReplay: true },
        "wolfboard /row — replaySnapshotUrl dropped (no live Admin column; see adminSheetSchema.js)",
      );
    }

    if (!dryRun && adminUpdates.length > 0) {
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: adminSheetId,
          requestBody: { valueInputOption: "USER_ENTERED", data: adminUpdates },
        });
      } catch (e) {
        return res.status(503).json({ ok: false, error: "Error al escribir en Admin: " + e.message });
      }
    }

    // Propagate respuesta to CRM (best-effort)
    let crmRow = null;
    if (!dryRun && respuesta !== undefined && crmSheetId) {
      try {
        const rowResp = await sheets.spreadsheets.values.get({
          spreadsheetId: adminSheetId,
          range: `'${adminTab}'!A${adminRow}:I${adminRow}`,
          valueRenderOption: "FORMATTED_VALUE",
        });
        const vals = rowResp.data.values?.[0] || [];
        const adminId = String(vals[0] ?? "").trim();
        const consulta = String(vals[8] ?? "").trim();
        if (consulta) {
          const crmResp = await sheets.spreadsheets.values.get({
            spreadsheetId: crmSheetId,
            range: `'${crmTab}'!A4:AK`,
            valueRenderOption: "FORMATTED_VALUE",
          });
          const crmRows = mapCrmRowsForWolfboardMatch(crmResp.data.values || []);
          const hit = findCrmRowForWolfboard(crmRows, consulta, adminId);
          const match = hit?.cr;
          if (match) {
            await sheets.spreadsheets.values.update({
              spreadsheetId: crmSheetId,
              range: `'${crmTab}'!AF${match._rowNum}`,
              valueInputOption: "USER_ENTERED",
              requestBody: { values: [[safeRespuesta]] },
            });
            crmRow = match._rowNum;
          }
        }
      } catch { /* best-effort */ }
    }

    return res.json({ ok: true, adminRow, crmRow, dryRun });
  });

  // ── POST /row-create ──────────────────────────────────────────────────────
  //
  // Append a new row to Admin 2.0 for a manually-captured cotización (Step 4
  // of the F1 plan / Gap 3c). Used by the "+ Nueva consulta" button in the
  // toolbar for channels that don't auto-ingest: CL (cliente físico), LL
  // (llamada), LO (local), FB / IG (residual).
  //
  // Body: { telefono, cliente, origen, zona, consulta, notas?, link? }
  //   - consulta (string, required, non-empty after trim)
  //   - origen (string, optional — UI restricts to CL/LL/LO/FB/IG)
  //   - telefono / cliente / zona (strings, optional — sanitized for Sheets)
  //
  // Generates a synthetic ID `MAN-<timestamp>` so the row can later be matched
  // back to CRM_Operativo via the existing ID flow in `/sync`. Estado is set
  // to "Pendiente" to enter the standard triage queue.
  router.post("/row-create", requireWolfboardWrite, async (req, res) => {
    const dryRun = config.wolfbDryRun;
    const body = req.body || {};
    const consulta = String(body.consulta ?? "").trim();
    if (!consulta) {
      return res.status(400).json({ ok: false, error: "consulta requerida (no vacía)" });
    }

    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    if (!adminSheetId) return envMissing503(res, "WOLFB_ADMIN_SHEET_ID");

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return sheetsAuthFail(res, e); }

    const id = `MAN-${Date.now()}`;
    const now = new Date();
    const fecha = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

    // Append `notas` (chat transcript, VW context, operator notes) INSIDE the
    // Consulta cell (I) rather than into J (Interpretación AI). Pre-realignment
    // this went to J and silently overwrote the AI interpretation on real
    // human rows. See evidence pack `admin-bloque-columnas-corridas.md` §2.
    let consultaFinal = consulta;
    const notas = sanitizeCellValue(String(body.notas ?? "")).trim();
    if (notas) consultaFinal = `${consulta}\n\n[notas] ${notas}`;
    const link = sanitizeCellValue(String(body.link ?? body.linkDrive ?? "")).trim();
    if (link) consultaFinal = `${consultaFinal}\n[link] ${link}`;

    // Build the row aligned to the LIVE header (adminSheetSchema.js). J/K/L/M
    // intentionally left empty — those belong to Interpretación AI, Respuesta
    // AI, Datos Faltantes and PRESUPUESTO and must only be set by the HITL
    // operator (or by the AI batch pipeline for J/K). N is set to FALSE so the
    // Enviado checkbox is explicit instead of inheriting the pre-existing
    // sheet-wide FALSE sentinel that caused appends to land at row ~3836.
    const safeRow = buildAdminRow({
      A: id,
      B: "", // Asig. (operator initials) — writer never fills this.
      C: ADMIN_ESTADO_PENDIENTE,
      D: fecha,
      E: sanitizeCellValue(String(body.cliente ?? "")),
      F: adminOrigenShort(String(body.origen ?? "")),
      G: sanitizeCellValue(String(body.telefono ?? "")),
      H: sanitizeCellValue(String(body.zona ?? "")),
      I: sanitizeCellValue(consultaFinal),
      J: "",
      K: "",
      L: "",
      M: "",
      N: "FALSE",
    });

    if (dryRun) {
      return res.json({ ok: true, dryRun: true, id, fecha });
    }

    try {
      const headerCheck = await ensureAdminHeader(sheets, adminSheetId, adminTab);
      if (!headerCheck.ok) return adminHeaderMismatch503(res, headerCheck.mismatches);
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer header Admin: " + e.message });
    }

    try {
      const result = await sheets.spreadsheets.values.append({
        spreadsheetId: adminSheetId,
        range: `'${adminTab}'!${ADMIN_RANGE_START}:${ADMIN_RANGE_END}`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [safeRow] },
      });
      // Append result has updatedRange like "Admin.!A42:N42" — extract rowNum
      const updatedRange = String(result.data?.updates?.updatedRange || "");
      const m = updatedRange.match(/![A-Z]+(\d+):/);
      const adminRow = m ? Number(m[1]) : null;
      return res.json({ ok: true, id, fecha, adminRow });
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al crear fila: " + e.message });
    }
  });

  // ── POST /enviados ────────────────────────────────────────────────────────
  router.post("/enviados", requireWolfboardWrite, async (req, res) => {
    logRoleHint(req, config);
    const dryRun = config.wolfbDryRun;
    const { adminRow } = req.body || {};
    if (!adminRow) return res.status(400).json({ ok: false, error: "adminRow requerido" });

    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    const crmSheetId = config.bmcSheetId;
    const enviadosTab = config.wolfbCrmEnviadosTab;
    if (!adminSheetId) return envMissing503(res, "WOLFB_ADMIN_SHEET_ID");

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return sheetsAuthFail(res, e); }

    let rowData;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: adminSheetId,
        range: `'${adminTab}'!${ADMIN_RANGE_START}${adminRow}:${ADMIN_RANGE_END}${adminRow}`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      rowData = resp.data.values?.[0] || [];
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer fila: " + e.message });
    }

    if (!dryRun) {
      // Append to Enviados tab (best-effort). Keep the full A:N range so the
      // Enviado checkbox state travels with the row — pre-realignment this was
      // A:M which dropped the checkbox silently.
      if (crmSheetId && enviadosTab && rowData.length > 0) {
        try {
          const safeRow = rowData
            .slice(0, ADMIN_RANGE_WIDTH)
            .map(sanitizeCellValue);
          await sheets.spreadsheets.values.append({
            spreadsheetId: crmSheetId,
            range: `'${enviadosTab}'!${ADMIN_RANGE_START}:${ADMIN_RANGE_END}`,
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [safeRow] },
          });
        } catch { /* best-effort */ }
      }

      // Get numeric sheetId for deleteDimension
      let numericSheetId;
      try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: adminSheetId });
        const tab = meta.data.sheets?.find(s => s.properties?.title === adminTab);
        numericSheetId = tab?.properties?.sheetId;
      } catch (e) {
        return res.status(503).json({ ok: false, error: "Error al leer metadata: " + e.message });
      }

      if (numericSheetId === undefined) {
        return res.status(503).json({ ok: false, error: `Tab '${adminTab}' no encontrado` });
      }

      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: adminSheetId,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: numericSheetId,
                  dimension: "ROWS",
                  startIndex: adminRow - 1,
                  endIndex: adminRow,
                },
              },
            }],
          },
        });
      } catch (e) {
        return res.status(503).json({ ok: false, error: "Error al eliminar fila: " + e.message });
      }
    }

    return res.json({ ok: true, dryRun, moved: true });
  });

  // ── GET /export ───────────────────────────────────────────────────────────
  router.get("/export", requireWolfboardRead, async (req, res) => {
    logRoleHint(req, config);
    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    if (!adminSheetId) return envMissing503(res, "WOLFB_ADMIN_SHEET_ID");

    const scopeRaw = String(req.query.scope || "consulta").trim().toLowerCase();
    const scope = scopeRaw === "admin" || scopeRaw === "all" || scopeRaw === "sheet" ? "admin" : "consulta";

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return sheetsAuthFail(res, e); }

    let rawRows;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: adminSheetId,
        range: `'${adminTab}'!${ADMIN_RANGE_START}2:${ADMIN_RANGE_END}`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      rawRows = resp.data.values || [];
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer Admin: " + e.message });
    }

    const mapped = rawRows.map((row, idx) => mapAdminSheetRow(row, idx, adminSheetId));
    const rows = filterAdminRowsByScope(mapped, scope);

    const escape = v => `"${String(v).replace(/"/g, '""')}"`;
    const header = ["#", "ID", "Asig.", "Estado", "Fecha", "Cliente", "Origen", "Telefono", "Zona", "Consulta", "Interpretación AI", "Respuesta AI", "Datos Faltantes", "PRESUPUESTO", "Enviado"];
    const lines = [
      header.map(escape).join(","),
      ...rows.map(r => [r.rowNum, r.id, r.asig, r.estado, r.fecha, r.cliente, r.canal, r.telefono, r.zona, r.consulta, r.interpretacionAi, r.respuesta, r.datosFaltantes, r.link, r.enviado ? "TRUE" : "FALSE"].map(escape).join(",")),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="wolfboard-pendientes-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(lines.join("\r\n"));
  });

  router.post("/quote-batch", requireWolfboardWrite, async (req, res) => {
    logRoleHint(req, config);

    const {
      force = false,
      syncToCrm = true,
      createCrmRows = true,
      syncQuoteLink = true,
    } = req.body || {};
    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    const crmSheetId = config.bmcSheetId;
    const crmTab = config.wolfbCrmMainTab;

    if (!adminSheetId) {
      return envMissing503(res, "WOLFB_ADMIN_SHEET_ID");
    }
    // Batch AI now routes through the shared seam's provider chain, so any single
    // provider key suffices (claude preferred, then grok → gemini → openai).
    if (getAvailableProviders().length === 0) {
      return envMissing503(res, "ANTHROPIC_API_KEY (o cualquier proveedor IA)", "Cloud Run secret / .env local");
    }
    if (!config.googleApplicationCredentials && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return res.status(503).json({ ok: false, error: "GOOGLE_APPLICATION_CREDENTIALS no configurado" });
    }

    let sheets;
    try {
      sheets = await getSheetsClient();
    } catch (e) {
      return sheetsAuthFail(res, e);
    }

    // Get numeric sheetId for cell formatting
    let numericSheetId;
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: adminSheetId });
      const tab = meta.data.sheets?.find((s) => s.properties?.title === adminTab);
      numericSheetId = tab?.properties?.sheetId;
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer metadata del sheet: " + e.message });
    }

    // Validate LIVE header before touching any cell (fail-closed; see
    // adminSheetSchema.js).
    try {
      const headerCheck = await ensureAdminHeader(sheets, adminSheetId, adminTab);
      if (!headerCheck.ok) return adminHeaderMismatch503(res, headerCheck.mismatches);
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer header Admin: " + e.message });
    }

    // Read Admin rows A2:N using the live letters (A=ID, E=Cliente, G=Tel,
    // H=Zona, I=Consulta, K=Respuesta AI, M=PRESUPUESTO).
    let rawRows;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: adminSheetId,
        range: `'${adminTab}'!${ADMIN_RANGE_START}2:${ADMIN_RANGE_END}`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      rawRows = resp.data.values || [];
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer Admin.: " + e.message });
    }

    const pendingRows = rawRows
      .map((row, idx) => ({
        rowNum: idx + 2,
        adminId: String(readAdminCell(row, "A") ?? "").trim(),
        telefono: String(readAdminCell(row, "G") ?? "").trim(),
        cliente: String(readAdminCell(row, "E") ?? "").trim(),
        canal: String(readAdminCell(row, "F") ?? "").trim(),
        zona: String(readAdminCell(row, "H") ?? "").trim(),
        consulta: String(readAdminCell(row, "I") ?? "").trim(),
        respuesta: String(readAdminCell(row, "K") ?? "").trim(),
        link: String(readAdminCell(row, "M") ?? "").trim(),
      }))
      .filter((r) => {
        if (!r.consulta) return false;
        const isEmpty = !r.respuesta;
        const isErrorRow = r.respuesta.startsWith("⚠");
        return isEmpty || (force && isErrorRow);
      });

    if (pendingRows.length === 0) {
      return res.json({
        ok: true,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: rawRows.length,
        rows: [],
      });
    }

    const canCreateCrmRows = createCrmRows && crmTab === "CRM_Operativo";

    // Load CRM rows for propagation (best-effort)
    let crmRows = [];
    if (syncToCrm && crmSheetId) {
      try {
        const crmResp = await sheets.spreadsheets.values.get({
          spreadsheetId: crmSheetId,
          range: `'${crmTab}'!A4:AK`,
          valueRenderOption: "FORMATTED_VALUE",
        });
        crmRows = mapCrmRowsForWolfboardMatch(crmResp.data.values || []);
      } catch {
        // CRM read is best-effort; proceed without propagation
      }
    }

    const results = [];
    const valueUpdates = [];
    const formatRequests = [];
    const crmUpdates = [];

    for (const row of pendingRows) {
      let correlationId = normalizeCorrelationId(row.adminId);
      if (!correlationId) {
        correlationId = generateWbkCorrelationId();
        valueUpdates.push({
          range: `'${adminTab}'!A${row.rowNum}`,
          values: [[sanitizeCellValue(correlationId)]],
        });
      }

      let response = "";
      let status = "quoted";
      let method = "text";
      let quoteLink = "";
      let crmRow = null;
      let crmCreated = false;
      let extracted = null;
      const usedDefaults = [];
      let calcQuoted = false;
      let calcRaw = null;

      if (row.consulta.length < MIN_CONSULTA_LEN) {
        response = ERROR_MARKER;
        status = "too_short";
      } else {
        // Step 1: Extract structured params from the consultation text
        try {
          // Provider-fallback via the shared seam (bare mode = no Panelin prompt).
          // Claude+Haiku preferred; falls back to grok → gemini → openai defaults.
          const extractRes = await callAgentOnce(
            [{ role: "user", content: row.consulta }],
            // provider:"claude" is required for the model override to apply — callAgentOnce
            // only honors override.model on the provider that matches override.provider.
            // Keeps cheap Haiku on the claude attempt; grok/gemini/openai use their defaults on fallback.
            { bareSystemPrompt: PARAM_EXTRACT_PROMPT, channel: "chat", override: { provider: "claude", model: HAIKU_MODEL, maxTokens: 400 } },
          );
          let rawJson = (extractRes.text || "").trim();
          rawJson = rawJson.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

          // Cost observability for wolfboard extraction step (provider/model as served)
          console.log(JSON.stringify({
            event: "wolfboard_ai_call",
            provider: extractRes.provider,
            model: extractRes.model,
            estimated_cost_usd: extractRes.estimatedCostUsd,
            row: row.rowNum,
            step: "extract",
          }));

          extracted = JSON.parse(rawJson);
        } catch {
          extracted = null;
        }

        // Step 2: Try the real calculator if we have enough params
        if (extracted?.escenario && extracted.escenario !== "null") {
          calcRaw = runBatchCalc(extracted, usedDefaults);
          if (calcRaw) {
            const formatted = formatCalcResult(calcRaw, extracted, usedDefaults);
            if (formatted) {
              response = formatted;
              calcQuoted = true;
              method = "calc";
            }
          }
        }

        // Step 3: Fallback to text-only generation (original behavior)
        if (!calcQuoted) {
          try {
            const quoteRes = await callAgentOnce(
              [{ role: "user", content: row.consulta }],
              { bareSystemPrompt: QUOTE_SYSTEM_PROMPT, channel: "chat", override: { provider: "claude", model: HAIKU_MODEL, maxTokens: 512 } },
            );
            response = (quoteRes.text || "").trim();
            method = "text";

            // Cost observability for wolfboard batch (provider/model as served)
            console.log(JSON.stringify({
              event: "wolfboard_ai_call",
              provider: quoteRes.provider,
              model: quoteRes.model,
              estimated_cost_usd: quoteRes.estimatedCostUsd,
              row: row.rowNum,
            }));
            if (!response) {
              response = ERROR_MARKER;
              status = "empty_response";
            }
          } catch {
            response = ERROR_MARKER;
            status = "api_error";
          }
        }
      }

      const isError = response.startsWith("⚠");
      if (isError && status === "quoted") status = "failed";

      // CSV/formula injection guard — the response is LLM output. While
      // unlikely to start with =/+/-/@, defense-in-depth: sanitize before
      // writing to Sheets with USER_ENTERED.
      const safeResponse = sanitizeCellValue(response);

      // Respuesta AI → column K on the LIVE header. Pre-realignment this
      // went to J, which is Interpretación AI.
      valueUpdates.push({
        range: `'${adminTab}'!K${row.rowNum}`,
        values: [[safeResponse]],
      });

      // Upload quote HTML to GCS+Drive in parallel (best-effort, calc-only)
      if (calcQuoted && calcRaw && (config.gcsQuotesBucket || config.driveQuoteFolderId)) {
        try {
          const groups = bomToGroups(calcRaw);
          const totales = calcRaw.totales || calcTotalesSinIVA(calcRaw.allItems || []);
          const panelLabel = (calcRaw.allItems || []).find(i => i.unidad === "m²")?.label || "";
          const htmlDate = new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
          const html = generatePrintHTML({
            client: { nombre: row.cliente || "Cliente", rut: "", telefono: "" },
            project: { fecha: htmlDate, refInterna: `WB-${row.rowNum}`, descripcion: "" },
            scenario: calcRaw._escenario,
            panel: {
              label: panelLabel,
              espesor: extracted?.techo?.espesor || extracted?.pared?.espesor || "",
              color: "Blanco",
            },
            autoportancia: null,
            groups,
            totals: { subtotalSinIVA: totales.subtotalSinIVA, iva: totales.iva, totalFinal: totales.totalFinal },
            warnings: calcRaw.warnings || [],
            dimensions: {},
            listaPrecios: "web",
            showSKU: false,
            showUnitPrices: true,
          });
          const filename = `Cotizacion-WB${row.rowNum}-${new Date().toISOString().slice(0, 10)}.html`;
          const [gcsRes] = await Promise.allSettled([
            config.gcsQuotesBucket
              ? uploadQuoteToGcs(html, filename, config.gcsQuotesBucket)
              : Promise.resolve(null),
            config.driveQuoteFolderId
              ? uploadQuoteToDrive(html, filename, config.driveQuoteFolderId)
              : Promise.resolve(null),
          ]);
          const gcsUrl = gcsRes.status === "fulfilled" ? gcsRes.value : null;
          if (gcsUrl) {
            quoteLink = String(gcsUrl || "").trim();
            // PRESUPUESTO / PDF link → column M on the LIVE header.
            // Pre-realignment this went to K, which is Respuesta AI.
            valueUpdates.push({ range: `'${adminTab}'!M${row.rowNum}`, values: [[sanitizeCellValue(quoteLink)]] });
          }
        } catch {
          // upload pipeline is non-critical; proceed without link
        }

        try {
          // Build the replay snapshot for debugging/observability but do NOT
          // write the URL back into the sheet. The pre-realignment code wrote
          // it into column M, which is PRESUPUESTO (PDF hyperlink) on the live
          // header — doing that would clobber the quote link we just wrote
          // above. The snapshot is still uploaded to GCS so operators can
          // retrieve it from logs if they need to debug a quote.
          const snap = buildWolfboardQuoteReplaySnapshot({
            adminRow: row.rowNum,
            cliente: row.cliente,
            consulta: row.consulta,
            extracted,
            usedDefaults,
            calcRaw,
            listaPrecios: "web",
          });
          const jsonName = `Cotizacion-WB${row.rowNum}-replay-${new Date().toISOString().slice(0, 10)}-${Date.now()}.json`;
          await uploadQuoteJsonToGcs(snap, jsonName, config.gcsQuotesBucket);
        } catch {
          // JSON snapshot is non-critical
        }
      }

      if (!quoteLink && row.link) {
        quoteLink = String(row.link).trim();
      }

      let crmHit = null;
      if (syncToCrm && crmSheetId) {
        crmHit = findCrmRowForWolfboard(crmRows, row.consulta, correlationId);
        if (crmHit) {
          crmRow = crmHit.cr._rowNum;
          if (correlationId && !normalizeCorrelationId(crmHit.cr.corrId)) {
            crmUpdates.push({
              range: `'${crmTab}'!A${crmRow}`,
              values: [[sanitizeCellValue(correlationId)]],
            });
            crmHit.cr.corrId = correlationId;
          }
        } else if (canCreateCrmRows) {
          const scenario =
            extracted?.escenario && extracted.escenario !== "null"
              ? extracted.escenario
              : "presupuesto_libre";
          const total =
            Number(calcRaw?.totales?.totalFinal || 0) > 0
              ? Number(calcRaw.totales.totalFinal)
              : undefined;
          const appendRes = await appendQuoteToCrm({
            cliente: row.cliente,
            telefono: row.telefono,
            ubicacion: row.zona,
            scenario,
            lista: "web",
            total,
            pdf_url: quoteLink || "",
            vendedor: row.canal,
            observaciones: row.consulta,
            tipo_cliente: "Cliente",
            urgencia: "Media",
            probabilidad_cierre: "Media",
            correlation_id: correlationId,
          });
          if (appendRes?.ok && Number(appendRes.row) > 0) {
            crmRow = Number(appendRes.row);
            crmCreated = true;
            crmRows.push({
              _rowNum: crmRow,
              corrId: correlationId,
              G: row.consulta,
              W: row.consulta,
            });
          }
        }
      }

      if (numericSheetId !== undefined) {
        // Colour the Respuesta AI cell (K on the live header) red when the
        // batch call failed; green/white otherwise.
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId: numericSheetId,
              startRowIndex: row.rowNum - 1,
              endRowIndex: row.rowNum,
              startColumnIndex: COL_RESPUESTA_AI,
              endColumnIndex: COL_RESPUESTA_AI + 1,
            },
            cell: {
              userEnteredFormat: { backgroundColor: isError ? RED_BG : WHITE_BG },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        });
      }

      // Propagate to CRM_Operativo.AF / AH
      if (!isError && crmRow) {
        crmUpdates.push({
          range: `'${crmTab}'!AF${crmRow}`,
          values: [[safeResponse]],
        });
      }
      if (syncQuoteLink && quoteLink && crmRow) {
        crmUpdates.push({
          range: `'${crmTab}'!AH${crmRow}`,
          values: [[sanitizeCellValue(quoteLink)]],
        });
      }

      const crmMatchKind =
        crmRow == null ? null : (crmCreated ? "created" : (crmHit?.matchKind ?? null));

      results.push({
        rowNum: row.rowNum,
        status,
        method,
        crmRow,
        crmCreated,
        crmMatchKind,
        correlationId,
        quoteLink: quoteLink || "",
        preview: response.slice(0, 100),
      });
    }

    // Write responses to Admin.J
    try {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: adminSheetId,
        requestBody: { valueInputOption: "USER_ENTERED", data: valueUpdates },
      });
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al escribir respuestas: " + e.message });
    }

    // Apply red/white background formatting (best-effort)
    if (formatRequests.length > 0 && numericSheetId !== undefined) {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: adminSheetId,
          requestBody: { requests: formatRequests },
        });
      } catch {
        // formatting is non-critical
      }
    }

    // Propagate to CRM_Operativo (best-effort)
    if (crmUpdates.length > 0 && crmSheetId) {
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: crmSheetId,
          requestBody: { valueInputOption: "USER_ENTERED", data: crmUpdates },
        });
      } catch {
        // CRM propagation is best-effort
      }
    }

    const successful = results.filter((r) => r.status === "quoted").length;
    return res.json({
      ok: true,
      processed: results.length,
      successful,
      failed: results.length - successful,
      skipped: rawRows.length - results.length,
      methods: {
        calc: results.filter((r) => r.method === "calc").length,
        text: results.filter((r) => r.method === "text").length,
      },
      rows: results,
    });
  });


  return router;
}
