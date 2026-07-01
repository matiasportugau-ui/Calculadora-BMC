/**
 * WhatsApp → CRM_Operativo / Form-responses Sheets ingest + auto-learn.
 *
 * Shared by BOTH ingest paths so they run the SAME write code:
 *   - legacy `processWaConversation` (server/index.js, OMNI_WA_CANONICAL OFF)
 *   - durable `wa_crm_sync` omni job (waCrmSyncJob.js, OMNI_WA_CANONICAL ON)
 *
 * The CRM_Operativo write is HEADER-ANCHORED and KEY-BASED (crmRowMapper.js):
 * every value is placed at the column whose row-3 header matches its logical key
 * (accent/case-insensitive), falling back to the documented column letter only
 * when the header can't be found — so inserting/renaming a column never silently
 * shifts the row. Every cell is CSV/formula sanitized. See crmRowMapper.js and
 * docs/team/CRM-OPERATIVO-COLUMN-MAP.md.
 *
 * This module only ever CREATES a lead row (append to the first empty row).
 * Canonical mode gates on findCrmRowByPhone() first and skips entirely when a row
 * already exists, so an operator-edited row is never overwritten.
 */
import { google } from "googleapis";
import { buildCrmRow, validateCrmRow, sliceCrmRange } from "../crmRowMapper.js";
import { sanitizeCellValue } from "../sheetsCsvGuard.js";
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
 * (append only — never overwrites an existing row). Writes the B:W data block and
 * the AH:AK gate defaults (both header-anchored). Does NOT write the AF–AG AI
 * suggestion cells — the legacy OFF path adds those via writeWaCrmAiTail() after
 * generating the reply; canonical mode leaves them for the Omni `suggest` job.
 *
 * @param {object} args
 * @param {object} args.parsedData      result of /api/crm/parse-conversation (`d`)
 * @param {string} args.chatId          WA phone / chat id
 * @param {string} args.dialogo         full conversation transcript (col P)
 * @param {object} args.config          server config (bmcSheetId, creds)
 * @param {object} [args.logger]
 * @param {object} [args.sheets]        optional pre-built Sheets client (tests/reuse)
 * @returns {Promise<{skipped?:boolean, reason?:string, crmRow?:number, formRow?:number, sheets?:object, sheetId?:string, crmHeaders?:string[]}>}
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

  // CRM_Operativo — read row-3 headers + the Cliente column in one round-trip.
  // Headers anchor the write by column NAME; the C column locates the first empty
  // data row (≥ 4).
  const crmReads = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges: ["'CRM_Operativo'!A3:ZZ3", "'CRM_Operativo'!C4:C500"],
  });
  const crmHeaders = crmReads.data.valueRanges?.[0]?.values?.[0] || [];
  const crmVals = crmReads.data.valueRanges?.[1]?.values || [];
  let crmRow = crmVals.length + 4;
  for (let i = 0; i < crmVals.length; i++) {
    if (!crmVals[i][0] || !crmVals[i][0].toString().trim()) {
      crmRow = i + 4;
      break;
    }
  }

  // KEY-BASED data row (B:W): each column addressed by logical key, never by blind
  // array index, and every cell sanitized (CSV/formula guard).
  const waLead = {
    fecha: now,
    cliente: d.cliente || "",
    telefono: d.telefono || chatId,
    ubicacion: d.ubicacion || "",
    origen: "WA-Auto",
    consulta: d.resumen_pedido || "",
    categoria: d.categoria || "",
    estado: "Pendiente",
    responsable: d.vendedor || "",
    probabilidad: d.probabilidad_cierre || "",
    urgencia: d.urgencia || "",
    validarStock: d.validar_stock || "No",
    tipoCliente: d.tipo_cliente || "",
    observaciones: d.observaciones || "",
  };
  const waBuilt = buildCrmRow(crmHeaders, waLead, { sanitize: sanitizeCellValue });
  // requireHeaders:false — this create is fire-and-forget (legacy deletes its
  // conversation buffer right after; canonical is retried at the job level, not
  // here), so we always write best-effort: header-anchored when possible,
  // documented-column-letter fallback when the header read is empty/absent.
  // Validation is warn-only; losing the whole lead would be worse than a rare
  // out-of-window field drop on a structural change.
  const waCheck = validateCrmRow(waBuilt, crmHeaders, {
    requireHeaders: false,
    window: { from: "B", to: "W" },
  });
  if (!waCheck.ok || waBuilt.fallbacks.length) {
    logger?.warn?.(
      `[WA] CRM_Operativo header drift — errors=${waCheck.errors.join(",") || "none"} fallbacks=${waBuilt.fallbacks.join(",") || "none"} (best-effort write)`,
    );
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'CRM_Operativo'!B${crmRow}:W${crmRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [sliceCrmRange(waBuilt.row, "B", "W")] },
  });

  // AH:AK gate defaults (header-anchored). Written on create so the lead has sane
  // gate state on BOTH paths — canonical never runs the AI tail below, and legacy
  // only overwrites AF:AG afterwards.
  const waGate = buildCrmRow(
    crmHeaders,
    { linkPresupuesto: "", aprobadoEnviar: "No", enviadoEl: "", bloquearAuto: "No" },
    { sanitize: sanitizeCellValue },
  );
  const waGateCheck = validateCrmRow(waGate, crmHeaders, {
    requireHeaders: false,
    window: { from: "AH", to: "AK" },
    required: [],
  });
  if (!waGateCheck.ok || waGate.fallbacks.length) {
    logger?.warn?.(
      `[WA] CRM AH:AK drift — errors=${waGateCheck.errors.join(",") || "none"} fallbacks=${waGate.fallbacks.join(",") || "none"} (best-effort write)`,
    );
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'CRM_Operativo'!AH${crmRow}:AK${crmRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [sliceCrmRange(waGate.row, "AH", "AK")] },
  });

  logger?.info?.(`[WA] CRM ingest → CRM row ${crmRow}, Form row ${formRow} (create)`);
  return { crmRow, formRow, sheets, sheetId, crmHeaders };
}

/**
 * Write the AF:AG AI-suggestion cells (suggested reply + provider) for a lead row,
 * header-anchored + sanitized. Legacy OFF path only — canonical mode leaves the
 * suggestion to the Omni `suggest` job. When the AI call failed, pass respuesta=""
 * / provider="" (writes blanks, same effect as not writing them).
 *
 * @param {object} args
 * @param {object} args.sheets      Sheets client (reuse the one from writeWaCrmIngest)
 * @param {string} args.sheetId
 * @param {number} args.crmRow      1-based CRM_Operativo row
 * @param {string[]} args.crmHeaders row-3 headers (from writeWaCrmIngest)
 * @param {string} [args.respuesta] suggested reply text (AF)
 * @param {string} [args.provider]  IA provider label (AG)
 * @param {object} [args.logger]
 */
export async function writeWaCrmAiTail({
  sheets,
  sheetId,
  crmRow,
  crmHeaders,
  respuesta = "",
  provider = "",
  logger,
}) {
  const waTail = buildCrmRow(
    crmHeaders,
    { respuestaSugerida: respuesta || "", providerIa: provider || "" },
    { sanitize: sanitizeCellValue },
  );
  const waTailCheck = validateCrmRow(waTail, crmHeaders, {
    requireHeaders: false,
    window: { from: "AF", to: "AG" },
    required: [],
  });
  if (!waTailCheck.ok || waTail.fallbacks.length) {
    logger?.warn?.(
      `[WA] CRM AF:AG drift — errors=${waTailCheck.errors.join(",") || "none"} fallbacks=${waTail.fallbacks.join(",") || "none"} (best-effort write)`,
    );
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'CRM_Operativo'!AF${crmRow}:AG${crmRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [sliceCrmRange(waTail.row, "AF", "AG")] },
  });
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
      logger?.info?.({ chat_id: chatId, kb_candidates: pairs.length }, "[WA] autolearn KB candidates");
    }
    return pairs.length;
  } catch {
    return 0;
  }
}
