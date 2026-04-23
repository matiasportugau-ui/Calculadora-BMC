/**
 * POST /api/wolfboard/quote-batch — batch AI quote for pending Admin 2.0 rows.
 *
 * Reads Admin.I (consulta) for rows where J (Respuesta AI) is empty or has a prior
 * error marker, calls Claude haiku, writes the response to Admin.J, colors J red if
 * the row can't be quoted, and propagates successful responses to CRM_Operativo.AF.
 *
 * Unquotable criteria (paints J red):
 *   - consulta text < 20 chars
 *   - Anthropic API call throws
 *   - Model returns empty string
 *
 * Body: { force?: boolean }
 *   force=false (default) — only rows where J is empty
 *   force=true            — also re-process rows where J starts with ⚠ (prior error)
 */
import { Router } from "express";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";

const SCOPE_WRITE = "https://www.googleapis.com/auth/spreadsheets";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MIN_CONSULTA_LEN = 20;
const ERROR_MARKER = "⚠ Requiere atención manual";
const RED_BG = { red: 1.0, green: 0.267, blue: 0.267 };
const WHITE_BG = { red: 1.0, green: 1.0, blue: 1.0 };

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

export function createWolfboardRouter(config) {
  const router = Router();

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
        range: `'${adminTab}'!A2:L`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      rawRows = resp.data.values || [];
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer Admin 2.0: " + e.message });
    }

    const pendingRows = rawRows
      .map((row, idx) => ({
        rowNum: idx + 2,
        consulta: String(row[8] ?? "").trim(), // I
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

      if (row.consulta.length < MIN_CONSULTA_LEN) {
        response = ERROR_MARKER;
        status = "too_short";
      } else {
        try {
          const msg = await anthropic.messages.create({
            model: HAIKU_MODEL,
            max_tokens: 512,
            system: QUOTE_SYSTEM_PROMPT,
            messages: [{ role: "user", content: row.consulta }],
          });
          response = msg.content?.[0]?.text?.trim() || "";
          if (!response) {
            response = ERROR_MARKER;
            status = "empty_response";
          }
        } catch {
          response = ERROR_MARKER;
          status = "api_error";
        }
      }

      const isError = response.startsWith("⚠");
      if (isError && status === "quoted") status = "failed";

      valueUpdates.push({
        range: `'${adminTab}'!J${row.rowNum}`,
        values: [[response]],
      });

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

      results.push({ rowNum: row.rowNum, status, preview: response.slice(0, 100) });
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
      rows: results,
    });
  });

  return router;
}
