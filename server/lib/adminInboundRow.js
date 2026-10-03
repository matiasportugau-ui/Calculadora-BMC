import { sanitizeCellValue } from "./sheetsCsvGuard.js";

/** Channel code → origen label written in Admin column F. */
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
  if (!ADMIN_INBOUND_ORIGEN[code]) return { ok: false, error: "invalid_channel" };
  if (!id) return { ok: false, error: "message_id_required" };
  return { ok: true, code, rowId: `${code}-${id}`, externalId: `${code}:${id}` };
}

function fechaFrom(now) {
  const d = now instanceof Date ? now : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

async function findRowByExternalId(sheets, sheetId, tab, externalId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tab}'!C:C`,
  });
  const values = res?.data?.values || [];
  for (let i = 0; i < values.length; i++) {
    if (String(values[i]?.[0] ?? "").trim() === externalId) return i + 1;
  }
  return null;
}

/**
 * Append one Admin row for one inbound message.
 * `enabled` is ADMIN_INBOUND_ROWS. Default callers pass false until that flag is on.
 * A second call with the same channel + message id returns the existing row and does not append.
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
} = {}) {
  if (!enabled) return { ok: true, skipped: "flag_off" };

  const ids = adminInboundIds(channel, messageId);
  if (!ids.ok) return ids;

  const body = String(consulta ?? "").trim() || buildInboundConsulta({ text, media, questionId, listingId, listingUrl });
  if (!body) return { ok: false, error: "consulta_required" };
  if (!sheetId) return { ok: false, error: "sheet_missing" };
  if (!sheets) return { ok: false, error: "sheets_missing" };

  const existingRow = await findRowByExternalId(sheets, sheetId, tab, ids.externalId);
  if (existingRow) {
    return { ok: true, duplicate: true, id: ids.rowId, externalId: ids.externalId, adminRow: existingRow };
  }

  const fecha = fechaFrom(now);
  const row = [
    sanitizeCellValue(ids.rowId),
    fecha,
    sanitizeCellValue(ids.externalId),
    sanitizeCellValue(telefono),
    sanitizeCellValue(cliente),
    ADMIN_INBOUND_ORIGEN[ids.code],
    "",
    sanitizeCellValue(zona),
    sanitizeCellValue(body),
    "",
    "",
    "Pendiente",
    "",
  ];

  if (dryRun) {
    return { ok: true, dryRun: true, id: ids.rowId, externalId: ids.externalId, fecha, row };
  }

  const appended = await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `'${tab}'!A:M`,
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
