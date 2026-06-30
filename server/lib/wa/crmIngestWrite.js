/**
 * WhatsApp → CRM_Operativo / Form-responses Sheets ingest + auto-learn.
 *
 * Extracted verbatim from the legacy `processWaConversation` (server/index.js) so
 * BOTH the legacy path (OMNI_WA_CANONICAL OFF) and the durable `wa_crm_sync` omni
 * job (OMNI_WA_CANONICAL ON) run the SAME write code.
 *
 * The only behavioural knob is `findRow`:
 *   - "append"        → legacy behaviour: write to the first empty CRM_Operativo
 *                       row (one row per conversation burst). Keeps OFF byte-identical.
 *   - "upsertByPhone" → canonical behaviour: reuse the existing CRM_Operativo row
 *                       for this phone if present, else append. Lets per-message
 *                       omni events coalesce onto one row instead of exploding rows.
 */
import { google } from "googleapis";
import { defaultTailAHAK, rangeAHAK } from "../crmOperativoLayout.js";
import { extractLearnablePairs } from "../autoLearnExtractor.js";
import { addTrainingEntry } from "../trainingKB.js";

async function buildSheetsClient(credsPath) {
  const auth = new google.auth.GoogleAuth({
    keyFile: credsPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

/**
 * Create a WA lead row from parsed data into Form responses 1 + CRM_Operativo
 * (append only — never overwrites an existing row). Does NOT write the AF–AG
 * AI-suggestion cells (that stays in the legacy OFF path).
 *
 * @param {object} args
 * @param {object} args.parsedData      result of /api/crm/parse-conversation (`d`)
 * @param {string} args.chatId          WA phone / chat id
 * @param {string} args.dialogo         full conversation transcript (col P)
 * @param {object} args.config          server config (bmcSheetId, creds)
 * @param {object} [args.logger]
 * @param {object} [args.sheets]        optional pre-built Sheets client (tests/reuse)
 * @returns {Promise<{skipped?:boolean, reason?:string, crmRow?:number, formRow?:number, sheets?:object, sheetId?:string}>}
 */
export async function writeWaCrmIngest({
  parsedData: d,
  chatId,
  dialogo,
  config,
  logger,
  sheets: injectedSheets,
}) {
  const credsPath =
    config.googleApplicationCredentials ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "";
  if (!config.bmcSheetId || !credsPath) {
    return { skipped: true, reason: "sheets_not_configured" };
  }

  const sheets = injectedSheets || (await buildSheetsClient(credsPath));
  const sheetId = config.bmcSheetId;
  const now = new Date().toISOString();

  // Form responses 1 — append: primera fila con col C (Cliente) vacía
  const formClientes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'Form responses 1'!C2:C200",
  });
  const formRows = formClientes.data.values || [];
  let formRow = formRows.length + 2;
  for (let i = 0; i < formRows.length; i++) {
    if (!formRows[i][0] || !formRows[i][0].toString().trim()) {
      formRow = i + 2;
      break;
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'Form responses 1'!A${formRow}:P${formRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          now, now, d.cliente || "", d.telefono || chatId,
          d.ubicacion || "", "WA-Auto", d.resumen_pedido || "", d.categoria || "",
          d.urgencia || "", d.cotizacion_formal || "", d.tipo_cliente || "",
          d.vendedor || "", d.observaciones || "", d.validar_stock || "No",
          d.probabilidad_cierre || "", dialogo,
        ],
      ],
    },
  });

  // CRM_Operativo — append: first row with empty col C (Cliente) from row 4.
  // This function only ever CREATES a lead row. Canonical mode gates on
  // findCrmRowByPhone() first and skips entirely when a row already exists, so an
  // operator-edited row is never overwritten (no clobber of Estado/Observaciones/AK).
  const crmClientes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'CRM_Operativo'!C4:C500",
  });
  const crmVals = crmClientes.data.values || [];
  let crmRow = crmVals.length + 4;
  for (let i = 0; i < crmVals.length; i++) {
    if (!crmVals[i][0] || !crmVals[i][0].toString().trim()) {
      crmRow = i + 4;
      break;
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'CRM_Operativo'!B${crmRow}:K${crmRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          now, d.cliente || "", d.telefono || chatId,
          d.ubicacion || "", "WA-Auto", d.resumen_pedido || "",
          d.categoria || "", "", "Pendiente", d.vendedor || "",
        ],
      ],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'CRM_Operativo'!R${crmRow}:T${crmRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[d.probabilidad_cierre || "", d.urgencia || "", d.validar_stock || "No"]],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'CRM_Operativo'!V${crmRow}:W${crmRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[d.tipo_cliente || "", d.observaciones || ""]] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: rangeAHAK(crmRow),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [defaultTailAHAK()] },
  });

  logger?.info?.(`[WA] CRM ingest → CRM row ${crmRow}, Form row ${formRow} (create)`);
  return { crmRow, formRow, sheets, sheetId };
}

/**
 * Find an existing CRM_Operativo lead row by phone (digit-normalized match on
 * col D), so canonical mode can insert-once and never overwrite an operator row.
 * @param {object} args
 * @param {object} args.config           server config (bmcSheetId, creds)
 * @param {string} args.phone            phone / chatId to match (stable key)
 * @param {object} [args.sheets]         optional pre-built Sheets client (reuse/tests)
 * @returns {Promise<{row: number|null, sheets?: object, skipped?: boolean, reason?: string}>}
 *   row = 1-based CRM_Operativo row if a lead for this phone exists, else null.
 */
export async function findCrmRowByPhone({ config, phone, sheets: injectedSheets }) {
  const credsPath =
    config.googleApplicationCredentials ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "";
  if (!config.bmcSheetId || !credsPath) {
    return { row: null, skipped: true, reason: "sheets_not_configured" };
  }
  const sheets = injectedSheets || (await buildSheetsClient(credsPath));
  const target = String(phone || "").replace(/\D/g, "");
  if (!target) return { row: null, sheets };
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: config.bmcSheetId,
    range: "'CRM_Operativo'!C4:D500",
  });
  const rows = data.values || [];
  for (let i = 0; i < rows.length; i++) {
    const rowPhone = String((rows[i] && rows[i][1]) || "").replace(/\D/g, "");
    if (rowPhone && rowPhone === target) return { row: i + 4, sheets };
  }
  return { row: null, sheets };
}

/**
 * Extract Q→A pairs from a WA exchange and add KB candidates (best-effort).
 * @param {object} args
 * @param {Array<{role:string, content:string}>} args.turns
 * @param {string} args.chatId
 * @param {object} [args.logger]
 */
export async function runWaAutoLearn({ turns, chatId, logger }) {
  try {
    const pairs = await extractLearnablePairs(turns, { source: "wa", convId: chatId });
    for (const p of pairs) {
      addTrainingEntry({
        question: p.question,
        goodAnswer: p.goodAnswer,
        badAnswer: p.badAnswer || "",
        category: p.category || "conversational",
        context: `[WA] ${p.rationale || ""}`,
        source: p.source || "autolearned",
        status: p.confidence >= 0.92 ? "active" : "pending",
        confidence: p.confidence,
        convId: p.convId || chatId,
      });
    }
    if (pairs.length > 0) {
      logger?.info?.(`[WA] autolearn: ${pairs.length} KB candidates from ${chatId}`);
    }
    return pairs.length;
  } catch {
    return 0;
  }
}
