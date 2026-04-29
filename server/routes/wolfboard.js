/**
 * Wolfboard routes — Admin 2.0 ↔ CRM_Operativo cotizaciones management.
 *
 * Admin 2.0 column layout (A=0, range A2:M):
 *   A(0)=ID  B(1)=Fecha  C(2)=?  D(3)=Telefono  E(4)=Cliente
 *   F(5)=Origen(WA/EM/CL/LO/LL)  G(6)=?  H(7)=Zona
 *   I(8)=Consulta  J(9)=RespuestaAI  K(10)=LinkDrive  L(11)=Estado
 *   M(12)=ReplaySnapshotUrl (GCS JSON — IA batch calc o pegado manualmente)
 *
 * Routes:
 *   GET  /pendientes?scope=consulta|admin — filas Admin 2.0 (default: scope=consulta = col I no vacía; admin = cualquier dato en A–M)
 *   POST /sync          — propagate Admin.J → CRM_Operativo.AF (one-way, consulta match)
 *   POST /row           — save respuesta/link/replaySnapshotUrl or approve a specific row
 *   POST /enviados      — move row to Enviados tab, delete from Admin
 *   GET  /export?scope=… — CSV (mismo criterio que /pendientes)
 *   POST /quote-batch   — batch AI quote generation (existing)
 */
import { Router } from "express";
import { google } from "googleapis";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { calcTechoCompleto, calcParedCompleto, calcTotalesSinIVA, mergeZonaResults } from "../../src/utils/calculations.js";
import { setListaPrecios } from "../../src/data/constants.js";
import { bomToGroups, fmtPrice, generatePrintHTML } from "../../src/utils/helpers.js";
import { uploadQuoteToGcs, uploadQuoteJsonToGcs } from "../lib/gcsUpload.js";
import { uploadQuoteToDrive } from "../lib/driveUpload.js";
import { buildWolfboardQuoteReplaySnapshot } from "../lib/wolfboardQuoteSnapshot.js";
import { colIndexToLetter, colLetterToIndex } from "../lib/sheetColumnLetters.js";

/** Admin-only rate limiter — authenticated routes that hit the Sheets API. */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests — retry after 1 minute" },
});

const SCOPE_WRITE = "https://www.googleapis.com/auth/spreadsheets";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MIN_CONSULTA_LEN = 20;
const ERROR_MARKER = "⚠ Requiere atención manual";
const RED_BG = { red: 1.0, green: 0.267, blue: 0.267 };
const WHITE_BG = { red: 1.0, green: 1.0, blue: 1.0 };
const ADMIN_GRID_LAST_COL = "Z";
const ADMIN_GRID_COL_COUNT = 26;

// Column J = index 9 (A=0)
const COL_J = 9;

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

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({ scopes: [SCOPE_WRITE] });
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

function normalizeText(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function requireAuth(config, req, res) {
  const expected = config.apiAuthToken;
  if (!expected) return true;
  const header =
    req.headers["x-api-key"] ||
    (req.headers.authorization
      ? String(req.headers.authorization).replace(/^Bearer\s+/i, "")
      : "");
  if (String(header || "") !== String(expected)) {
    res.status(401).json({ ok: false, error: "API key inválida o ausente (x-api-key)" });
    return false;
  }
  return true;
}

/** Mapa de fila Admin 2.0 (A2:Z) → objeto unificado (índices según comentario de cabecera). */
function mapAdminSheetRow(row, idx, adminSheetId) {
  const sheetBase = `https://docs.google.com/spreadsheets/d/${adminSheetId}/edit`;
  return {
    rowNum: idx + 2,
    id: String(row[0] ?? "").trim(),
    fecha: String(row[1] ?? "").trim(),
    telefono: String(row[3] ?? "").trim(),
    cliente: String(row[4] ?? "").trim(),
    canal: String(row[5] ?? "").trim(),
    origen: String(row[5] ?? "").trim(),
    zona: String(row[7] ?? "").trim(),
    consulta: String(row[8] ?? "").trim(),
    respuesta: String(row[9] ?? "").trim(),
    link: String(row[10] ?? "").trim(),
    estado: String(row[11] ?? "").trim(),
    replaySnapshotUrl: String(row[12] ?? "").trim(),
    sheetUrl: sheetBase,
    // Raw cell values indexed by column letter (A, B, C…) for full-grid view
    rawCells: row.map((v) => String(v ?? "")),
  };
}

function adminRowHasAnyData(r) {
  return [
    r.id,
    r.fecha,
    r.telefono,
    r.cliente,
    r.canal,
    r.zona,
    r.consulta,
    r.respuesta,
    r.link,
    r.estado,
    r.replaySnapshotUrl,
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
  router.get("/pendientes", async (req, res) => {
    if (!requireAuth(config, req, res)) return;
    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    if (!adminSheetId) return res.status(503).json({ ok: false, error: "WOLFB_ADMIN_SHEET_ID no configurado" });

    const scopeRaw = String(req.query.scope || "consulta").trim().toLowerCase();
    const scope = scopeRaw === "admin" || scopeRaw === "all" || scopeRaw === "sheet" ? "admin" : "consulta";

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return res.status(503).json({ ok: false, error: "Sheets auth error: " + e.message }); }

    let rawRows;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: adminSheetId,
        range: `'${adminTab}'!A2:Z`,
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

  // ── GET /sheet-headers ────────────────────────────────────────────────────
  router.get("/sheet-headers", adminLimiter, async (req, res) => {
    if (!requireAuth(config, req, res)) return;
    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    if (!adminSheetId) return res.status(503).json({ ok: false, error: "WOLFB_ADMIN_SHEET_ID no configurado" });

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return res.status(503).json({ ok: false, error: "Sheets auth error: " + e.message }); }

    let headerRow;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: adminSheetId,
        range: `'${adminTab}'!A1:${ADMIN_GRID_LAST_COL}1`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      headerRow = resp.data.values?.[0] || [];
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer cabecera: " + e.message });
    }

    const headers = Array.from({ length: ADMIN_GRID_COL_COUNT }, (_, index) => ({
      index,
      col: colIndexToLetter(index),
      name: String(headerRow[index] || "").trim() || colIndexToLetter(index),
    }));

    return res.json({ ok: true, headers });
  });

  // ── POST /cell ────────────────────────────────────────────────────────────
  router.post("/cell", adminLimiter, async (req, res) => {
    if (!requireAuth(config, req, res)) return;
    const { adminRow, col, value } = req.body || {};
    if (!adminRow || !col) {
      return res.status(400).json({ ok: false, error: "adminRow y col requeridos" });
    }
    const adminRowNum = Number(adminRow);
    if (!Number.isInteger(adminRowNum) || adminRowNum < 2) {
      return res.status(400).json({ ok: false, error: "adminRow debe ser un número entero mayor o igual a 2" });
    }

    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    if (!adminSheetId) return res.status(503).json({ ok: false, error: "WOLFB_ADMIN_SHEET_ID no configurado" });

    // Validate col: only A-Z letters, max 2 chars (columns A..ZZ = 0..701)
    const colUpper = String(col).trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (!colUpper || colUpper.length > 2) {
      return res.status(400).json({ ok: false, error: "col inválido — usar letra(s) A–Z o AA–ZZ" });
    }
    let colIndex;
    try { colIndex = colLetterToIndex(colUpper); }
    catch { return res.status(400).json({ ok: false, error: "col inválido" }); }
    // Extra guard: limit to column ZZ (index 701)
    if (colIndex > 701) {
      return res.status(400).json({ ok: false, error: "col fuera de rango — máximo ZZ" });
    }

    const dryRun = config.wolfbDryRun;

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return res.status(503).json({ ok: false, error: "Sheets auth error: " + e.message }); }

    if (!dryRun) {
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: adminSheetId,
          range: `'${adminTab}'!${colUpper}${adminRowNum}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[value ?? ""]] },
        });
      } catch (e) {
        return res.status(503).json({ ok: false, error: "Error al escribir celda: " + e.message });
      }
    }

    return res.json({ ok: true, adminRow: adminRowNum, col: colUpper, colIndex, dryRun });
  });

  // ── POST /sync ────────────────────────────────────────────────────────────
  router.post("/sync", async (req, res) => {
    if (!requireAuth(config, req, res)) return;
    const dryRun = config.wolfbDryRun;
    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    const crmSheetId = config.bmcSheetId;
    const crmTab = config.wolfbCrmMainTab;
    if (!adminSheetId) return res.status(503).json({ ok: false, error: "WOLFB_ADMIN_SHEET_ID no configurado" });

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return res.status(503).json({ ok: false, error: "Sheets auth error: " + e.message }); }

    let adminRows;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: adminSheetId,
        range: `'${adminTab}'!A2:M`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      adminRows = (resp.data.values || []).map((row, idx) => ({
        rowNum: idx + 2,
        consulta: String(row[8] ?? "").trim(),
        respuesta: String(row[9] ?? "").trim(),
      })).filter(r => r.consulta && r.respuesta && !r.respuesta.startsWith("⚠"));
    } catch (e) {
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
      crmRows = (crmResp.data.values || []).map((row, idx) => ({
        _rowNum: idx + 4,
        G: String(row[6] ?? "").trim(),
      }));
    } catch { /* best-effort */ }

    const crmUpdates = [];
    let skipped = 0;
    for (const aRow of adminRows) {
      const match = crmRows.find(cr => cr.G && normalizeText(cr.G) === normalizeText(aRow.consulta));
      if (match) {
        crmUpdates.push({ range: `'${crmTab}'!AF${match._rowNum}`, values: [[aRow.respuesta]] });
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
        return res.status(503).json({ ok: false, error: "Error al escribir en CRM: " + e.message });
      }
    }

    return res.json({ ok: true, updatedAdmin: 0, updatedCrm: crmUpdates.length, skipped, dryRun });
  });

  // ── POST /row ─────────────────────────────────────────────────────────────
  router.post("/row", async (req, res) => {
    if (!requireAuth(config, req, res)) return;
    const dryRun = config.wolfbDryRun;
    const { adminRow, respuesta, link, aprobado, replaySnapshotUrl } = req.body || {};
    if (!adminRow) return res.status(400).json({ ok: false, error: "adminRow requerido" });

    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    const crmSheetId = config.bmcSheetId;
    const crmTab = config.wolfbCrmMainTab;
    if (!adminSheetId) return res.status(503).json({ ok: false, error: "WOLFB_ADMIN_SHEET_ID no configurado" });

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return res.status(503).json({ ok: false, error: "Sheets auth error: " + e.message }); }

    const adminUpdates = [];
    if (respuesta !== undefined) adminUpdates.push({ range: `'${adminTab}'!J${adminRow}`, values: [[respuesta]] });
    if (link !== undefined) adminUpdates.push({ range: `'${adminTab}'!K${adminRow}`, values: [[link]] });
    if (replaySnapshotUrl !== undefined) {
      adminUpdates.push({ range: `'${adminTab}'!M${adminRow}`, values: [[replaySnapshotUrl]] });
    }
    if (aprobado) adminUpdates.push({ range: `'${adminTab}'!L${adminRow}`, values: [["Aprobado"]] });

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
          range: `'${adminTab}'!I${adminRow}`,
          valueRenderOption: "FORMATTED_VALUE",
        });
        const consulta = String(rowResp.data.values?.[0]?.[0] ?? "").trim();
        if (consulta) {
          const crmResp = await sheets.spreadsheets.values.get({
            spreadsheetId: crmSheetId,
            range: `'${crmTab}'!A4:AK`,
            valueRenderOption: "FORMATTED_VALUE",
          });
          const crmRows = (crmResp.data.values || []).map((row, idx) => ({
            _rowNum: idx + 4,
            G: String(row[6] ?? "").trim(),
          }));
          const match = crmRows.find(cr => cr.G && normalizeText(cr.G) === normalizeText(consulta));
          if (match) {
            await sheets.spreadsheets.values.update({
              spreadsheetId: crmSheetId,
              range: `'${crmTab}'!AF${match._rowNum}`,
              valueInputOption: "USER_ENTERED",
              requestBody: { values: [[respuesta]] },
            });
            crmRow = match._rowNum;
          }
        }
      } catch { /* best-effort */ }
    }

    return res.json({ ok: true, adminRow, crmRow, dryRun });
  });

  // ── POST /enviados ────────────────────────────────────────────────────────
  router.post("/enviados", async (req, res) => {
    if (!requireAuth(config, req, res)) return;
    const dryRun = config.wolfbDryRun;
    const { adminRow } = req.body || {};
    if (!adminRow) return res.status(400).json({ ok: false, error: "adminRow requerido" });

    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    const crmSheetId = config.bmcSheetId;
    const enviadosTab = config.wolfbCrmEnviadosTab;
    if (!adminSheetId) return res.status(503).json({ ok: false, error: "WOLFB_ADMIN_SHEET_ID no configurado" });

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return res.status(503).json({ ok: false, error: "Sheets auth error: " + e.message }); }

    let rowData;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: adminSheetId,
        range: `'${adminTab}'!A${adminRow}:M${adminRow}`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      rowData = resp.data.values?.[0] || [];
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer fila: " + e.message });
    }

    if (!dryRun) {
      // Append to Enviados tab (best-effort)
      if (crmSheetId && enviadosTab && rowData.length > 0) {
        try {
          await sheets.spreadsheets.values.append({
            spreadsheetId: crmSheetId,
            range: `'${enviadosTab}'!A:M`,
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [rowData] },
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
  router.get("/export", async (req, res) => {
    const tokenFromQuery = String(req.query.token || "").trim();
    if (tokenFromQuery) {
      req.headers.authorization = `Bearer ${tokenFromQuery}`;
    }
    if (!requireAuth(config, req, res)) return;
    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    if (!adminSheetId) return res.status(503).json({ ok: false, error: "WOLFB_ADMIN_SHEET_ID no configurado" });

    const scopeRaw = String(req.query.scope || "consulta").trim().toLowerCase();
    const scope = scopeRaw === "admin" || scopeRaw === "all" || scopeRaw === "sheet" ? "admin" : "consulta";

    let sheets;
    try { sheets = await getSheetsClient(); }
    catch (e) { return res.status(503).json({ ok: false, error: "Sheets auth error: " + e.message }); }

    let rawRows;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: adminSheetId,
        range: `'${adminTab}'!A2:Z`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      rawRows = resp.data.values || [];
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer Admin: " + e.message });
    }

    const mapped = rawRows.map((row, idx) => mapAdminSheetRow(row, idx, adminSheetId));
    const rows = filterAdminRowsByScope(mapped, scope);

    const escape = v => `"${String(v).replace(/"/g, '""')}"`;
    const header = ["#", "ID", "Fecha", "Telefono", "Cliente", "Canal", "Zona", "Consulta", "Respuesta IA", "Link", "Estado", "Replay JSON"];
    const lines = [
      header.map(escape).join(","),
      ...rows.map(r => [r.rowNum, r.id, r.fecha, r.telefono, r.cliente, r.canal, r.zona, r.consulta, r.respuesta, r.link, r.estado, r.replaySnapshotUrl].map(escape).join(",")),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="wolfboard-pendientes-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(lines.join("\r\n"));
  });

  router.post("/quote-batch", async (req, res) => {
    if (!requireAuth(config, req, res)) return;

    const { force = false } = req.body || {};
    const adminSheetId = config.wolfbAdminSheetId;
    const adminTab = config.wolfbAdminTab;
    const crmSheetId = config.bmcSheetId;
    const crmTab = config.wolfbCrmMainTab;

    if (!adminSheetId) {
      return res.status(503).json({ ok: false, error: "WOLFB_ADMIN_SHEET_ID no configurado" });
    }
    if (!config.anthropicApiKey) {
      return res.status(503).json({ ok: false, error: "ANTHROPIC_API_KEY no configurado" });
    }
    if (!config.googleApplicationCredentials && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return res.status(503).json({ ok: false, error: "GOOGLE_APPLICATION_CREDENTIALS no configurado" });
    }

    let sheets;
    try {
      sheets = await getSheetsClient();
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Google Sheets auth error: " + e.message });
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

    // Read Admin rows A2:L (A=ID, E=Cliente, H=Zona, I=Consulta, J=Respuesta AI)
    let rawRows;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: adminSheetId,
        range: `'${adminTab}'!A2:M`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      rawRows = resp.data.values || [];
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer Admin 2.0: " + e.message });
    }

    const pendingRows = rawRows
      .map((row, idx) => ({
        rowNum: idx + 2,
        cliente: String(row[4] ?? "").trim(),  // E
        consulta: String(row[8] ?? "").trim(),  // I
        respuesta: String(row[9] ?? "").trim(), // J
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

    // Load CRM rows for propagation (best-effort)
    let crmRows = [];
    if (crmSheetId) {
      try {
        const crmResp = await sheets.spreadsheets.values.get({
          spreadsheetId: crmSheetId,
          range: `'${crmTab}'!A4:AK`,
          valueRenderOption: "FORMATTED_VALUE",
        });
        crmRows = (crmResp.data.values || []).map((row, idx) => ({
          _rowNum: idx + 4,
          G: String(row[6] ?? "").trim(),
        }));
      } catch {
        // CRM read is best-effort; proceed without propagation
      }
    }

    const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    const results = [];
    const valueUpdates = [];
    const formatRequests = [];
    const crmUpdates = [];

    for (const row of pendingRows) {
      let response = "";
      let status = "quoted";
      let method = "text";

      if (row.consulta.length < MIN_CONSULTA_LEN) {
        response = ERROR_MARKER;
        status = "too_short";
      } else {
        // Step 1: Extract structured params from the consultation text
        let extracted = null;
        const usedDefaults = [];
        try {
          const extractMsg = await anthropic.messages.create({
            model: HAIKU_MODEL,
            max_tokens: 400,
            system: PARAM_EXTRACT_PROMPT,
            messages: [{ role: "user", content: row.consulta }],
          });
          const rawJson = (extractMsg.content?.[0]?.text || "").trim()
            .replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
          extracted = JSON.parse(rawJson);
        } catch {
          extracted = null;
        }

        // Step 2: Try the real calculator if we have enough params
        let calcQuoted = false;
        let calcRaw = null;
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
            const msg = await anthropic.messages.create({
              model: HAIKU_MODEL,
              max_tokens: 512,
              system: QUOTE_SYSTEM_PROMPT,
              messages: [{ role: "user", content: row.consulta }],
            });
            response = msg.content?.[0]?.text?.trim() || "";
            method = "text";
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

      valueUpdates.push({
        range: `'${adminTab}'!J${row.rowNum}`,
        values: [[response]],
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
            valueUpdates.push({ range: `'${adminTab}'!K${row.rowNum}`, values: [[gcsUrl]] });
          }
        } catch {
          // upload pipeline is non-critical; proceed without link
        }

        try {
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
          const jsonUrl = await uploadQuoteJsonToGcs(snap, jsonName, config.gcsQuotesBucket);
          if (jsonUrl) {
            valueUpdates.push({ range: `'${adminTab}'!M${row.rowNum}`, values: [[jsonUrl]] });
          }
        } catch {
          // JSON snapshot is non-critical
        }
      }

      if (numericSheetId !== undefined) {
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId: numericSheetId,
              startRowIndex: row.rowNum - 1,
              endRowIndex: row.rowNum,
              startColumnIndex: COL_J,
              endColumnIndex: COL_J + 1,
            },
            cell: {
              userEnteredFormat: { backgroundColor: isError ? RED_BG : WHITE_BG },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        });
      }

      // Propagate to CRM_Operativo.AF (match by consulta text in CRM.G)
      if (!isError && crmRows.length > 0) {
        const match = crmRows.find(
          (cr) => cr.G && normalizeText(cr.G) === normalizeText(row.consulta)
        );
        if (match) {
          crmUpdates.push({
            range: `'${crmTab}'!AF${match._rowNum}`,
            values: [[response]],
          });
        }
      }

      results.push({ rowNum: row.rowNum, status, method, preview: response.slice(0, 100) });
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
