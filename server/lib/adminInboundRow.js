import { sanitizeCellValue } from "./sheetsCsvGuard.js";
import {
  ADMIN_COL_INDEX,
  ADMIN_ESTADO_PENDIENTE,
  ADMIN_INBOUND_ID_PREFIX,
  ADMIN_RANGE_END,
  ADMIN_RANGE_START,
  adminOrigenShort,
  buildAdminRow,
  extractConsultaQids,
  validateAdminHeader,
} from "./adminSheetSchema.js";

/**
 * Channel code → origen label written in Admin column F.
 * Kept for backwards compatibility with existing tests; the realigned
 * writer now goes through `adminOrigenShort(channel)` which returns the
 * SAME value for each key below so tests that assert `row[5]` keep passing.
 * (Short codes match the live sheet mandate from 2026-10-06.)
 */
export const ADMIN_INBOUND_ORIGEN = {
  WA: "WhatsApp",
  ML: "Mercado Libre",
  FB: "Facebook",
  IG: "Instagram",
  EM: "Email",
};

const MEDIA_LABEL = {
  image: "[imagen]",
  audio: "[audio]",
  sticker: "[sticker]",
};

/**
 * Consulta cell. A media-only message still produces a row.
 * Mercado Libre keeps the trailer the Grok dashboard already parses.
 */
export function buildInboundConsulta({ text, media, questionId, listingId, listingUrl } = {}) {
  let body = String(text ?? "").trim();
  if (!body && media) body = MEDIA_LABEL[media] || "";
  if (!body) return "";
  const qid = String(questionId ?? "").trim();
  if (!qid) return body;
  const bits = [`Q:${qid}`];
  const listing = String(listingId ?? "").trim();
  const url = String(listingUrl ?? "").trim();
  if (listing) bits.push(listing);
  if (url) bits.push(url);
  return `${body} — ${bits.join(" · ")}`;
}

export function adminInboundIds(channel, messageId) {
  const code = String(channel ?? "").trim().toUpperCase();
  const id = String(messageId ?? "").trim();
  if (!ADMIN_INBOUND_ID_PREFIX[code]) return { ok: false, error: "invalid_channel" };
  if (!id) return { ok: false, error: "message_id_required" };
  return { ok: true, code, rowId: `${code}-${id}`, externalId: `${code}:${id}` };
}

function fechaFrom(now) {
  const d = now instanceof Date ? now : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Dedup search against the LIVE Admin header:
 *   - column A: new writer stores `WA-…`, `ML-…`, `FB-…`, `IG-…`, `EM-…` here
 *     (humans leave A empty, pre-realignment auto rows carried the same
 *     prefixed id in A, so this covers both old and new rows).
 *   - column I: the HITL human copy of a ML question embeds `— Q:<qid>` in
 *     the Consulta trailer (see `buildInboundConsulta`). A webhook re-delivery
 *     of the same QID must not add a duplicate row even if column A doesn't
 *     carry the prefixed id.
 *
 * The pre-realignment writer stored the dedup key (`ML:qid`, `FB:mid`) in
 * column C (Estado on the live header). We no longer rely on C — the key
 * stolen that column from the operator — but we DO still match historical
 * rows that have it there so webhooks that duplicate against those rows
 * are correctly suppressed.
 */
async function findDuplicateInboundRow(sheets, sheetId, tab, { code, rowId, externalId, questionId }) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tab}'!A2:I`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const values = res?.data?.values || [];
  const prefix = ADMIN_INBOUND_ID_PREFIX[code] || "";
  const qid = String(questionId ?? "").trim();
  for (let i = 0; i < values.length; i++) {
    const row = values[i] || [];
    const a = String(row[ADMIN_COL_INDEX.A] ?? "").trim();
    if (a && (a === rowId || (prefix && a === rowId))) return i + 2;
    const c = String(row[ADMIN_COL_INDEX.C] ?? "").trim();
    if (c && c === externalId) return i + 2; // pre-realignment rows kept the key here.
    if (qid && code === "ML") {
      const consulta = String(row[ADMIN_COL_INDEX.I] ?? "");
      if (consulta && extractConsultaQids(consulta).includes(qid)) return i + 2;
    }
  }
  return null;
}

/** Read row 1 and fail closed when the header no longer matches ADMIN_COLUMNS. */
async function assertHeaderMatches(sheets, sheetId, tab) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tab}'!1:1`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const headerRow = resp?.data?.values?.[0] || [];
  return validateAdminHeader(headerRow);
}

/**
 * Append one Admin row for one inbound message.
 * `enabled` is ADMIN_INBOUND_ROWS. Default callers pass false until that flag is on.
 * A second call with the same channel + message id returns the existing row and does not append.
 *
 * The row shape follows the LIVE Admin header (A=id, B=Asig., C=Estado,
 * D=Fecha, E=Cliente, F=Origen, G=Teléfono, H=Zona, I=Consulta, J/K/L/M
 * left empty on create — those belong to Interpretación AI / Respuesta AI /
 * Datos Faltantes / PRESUPUESTO and must NOT be touched by the ingest
 * writer — and N=`FALSE` so the Enviado checkbox is set explicitly).
 */
export async function appendAdminInboundRow({
  sheets,
  sheetId,
  tab = "Admin.",
  channel,
  messageId,
  telefono = "",
  cliente = "",
  zona = "",
  text,
  media,
  questionId,
  listingId,
  listingUrl,
  consulta,
  enabled = false,
  dryRun = false,
  now = new Date(),
  skipHeaderCheck = false,
} = {}) {
  if (!enabled) return { ok: true, skipped: "flag_off" };

  const ids = adminInboundIds(channel, messageId);
  if (!ids.ok) return ids;

  const body = String(consulta ?? "").trim() || buildInboundConsulta({ text, media, questionId, listingId, listingUrl });
  if (!body) return { ok: false, error: "consulta_required" };
  if (!sheetId) return { ok: false, error: "sheet_missing" };
  if (!sheets) return { ok: false, error: "sheets_missing" };

  if (!skipHeaderCheck && !dryRun) {
    try {
      const headerCheck = await assertHeaderMatches(sheets, sheetId, tab);
      if (!headerCheck.ok) {
        return { ok: false, error: "admin_header_mismatch", mismatches: headerCheck.mismatches };
      }
    } catch {
      // Reading row 1 should never fail silently; propagate as a generic failure.
      return { ok: false, error: "admin_header_read_failed" };
    }
  }

  const existingRow = await findDuplicateInboundRow(sheets, sheetId, tab, {
    code: ids.code,
    rowId: ids.rowId,
    externalId: ids.externalId,
    questionId,
  });
  if (existingRow) {
    return { ok: true, duplicate: true, id: ids.rowId, externalId: ids.externalId, adminRow: existingRow };
  }

  const fecha = fechaFrom(now);
  const row = buildAdminRow({
    A: sanitizeCellValue(ids.rowId),
    B: "",
    C: ADMIN_ESTADO_PENDIENTE,
    D: fecha,
    E: sanitizeCellValue(cliente),
    F: adminOrigenShort(ids.code),
    G: sanitizeCellValue(telefono),
    H: sanitizeCellValue(zona),
    I: sanitizeCellValue(body),
    J: "",
    K: "",
    L: "",
    M: "",
    N: "FALSE",
  });

  if (dryRun) {
    return { ok: true, dryRun: true, id: ids.rowId, externalId: ids.externalId, fecha, row };
  }

  const appended = await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `'${tab}'!${ADMIN_RANGE_START}:${ADMIN_RANGE_END}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
  const updatedRange = String(appended?.data?.updates?.updatedRange || "");
  const match = updatedRange.match(/![A-Z]+(\d+):/);
  return {
    ok: true,
    id: ids.rowId,
    externalId: ids.externalId,
    fecha,
    adminRow: match ? Number(match[1]) : null,
  };
}
