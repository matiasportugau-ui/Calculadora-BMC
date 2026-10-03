import { appendAdminInboundRow, adminInboundIds, buildInboundConsulta } from "./adminInboundRow.js";
import { getSheetsClient } from "./googleSheetsAuth.js";
import { extractMlWebhookResourceId } from "./omni/adapters/mlWebhook.js";

/** Sheet cells cap at 50_000 characters. Leave room for the ML trailer. */
const CONSULTA_MAX = 45000;

function clip(value) {
  const text = String(value ?? "");
  return text.length > CONSULTA_MAX ? text.slice(0, CONSULTA_MAX) : text;
}

/**
 * Append one Admin row for an inbound message.
 * Flag off returns before any Sheets client is created.
 */
export async function dispatchAdminInbound(config, fields = {}, { getSheets = getSheetsClient, logger, now } = {}) {
  if (!config?.adminInboundRows) return appendAdminInboundRow({ enabled: false });

  const ids = adminInboundIds(fields.channel, fields.messageId);
  if (!ids.ok) return ids;
  const body = clip(String(fields.consulta ?? "").trim() || buildInboundConsulta(fields));
  if (!body) return { ok: false, error: "consulta_required" };
  if (!config.wolfbAdminSheetId) return { ok: false, error: "sheet_missing" };

  let sheets;
  try {
    sheets = await getSheets();
  } catch (err) {
    logger?.warn?.({ err: err?.message, channel: fields.channel }, "Admin inbound sheets client failed");
    return { ok: false, error: "sheets_client_failed" };
  }

  try {
    return await appendAdminInboundRow({
      ...fields,
      text: clip(fields.text),
      consulta: fields.consulta ? clip(fields.consulta) : undefined,
      enabled: true,
      dryRun: Boolean(config.wolfbDryRun),
      sheets,
      sheetId: config.wolfbAdminSheetId,
      tab: config.wolfbAdminTab || "Admin.",
      now,
    });
  } catch (err) {
    logger?.warn?.({ err: err?.message, channel: fields.channel, messageId: fields.messageId }, "Admin inbound append failed");
    return { ok: false, error: "admin_inbound_failed" };
  }
}

export function whatsAppInboundFields({ msg, contactName } = {}) {
  const type = String(msg?.type || "").toLowerCase();
  let media;
  if (type === "image" || msg?.image) media = "image";
  else if (type === "audio" || type === "voice" || msg?.audio) media = "audio";
  else if (type === "sticker" || msg?.sticker) media = "sticker";
  return {
    channel: "WA",
    messageId: String(msg?.id || "").trim(),
    telefono: String(msg?.from || "").trim(),
    cliente: String(contactName || msg?.from || "").trim(),
    text: String(msg?.text?.body || msg?.caption || msg?.image?.caption || msg?.video?.caption || "").trim(),
    media,
  };
}

export async function recordWhatsAppAdminInbound({ config, msg, contactName, logger, getSheets, now } = {}) {
  const fields = whatsAppInboundFields({ msg, contactName });
  if (!fields.messageId) return { ok: false, error: "message_id_required" };
  return dispatchAdminInbound(config, fields, { logger, getSheets, now });
}

export function mercadoLibreQuestionFields({ notification, question } = {}) {
  const resourceId = extractMlWebhookResourceId(notification || {});
  const q = question || {};
  const qid = String(q.id || resourceId || "").trim();
  const fromId = q.from?.id ?? q.user_id;
  return {
    channel: "ML",
    messageId: qid,
    cliente: String(q.from?.nickname || q.from?.name || (fromId != null && fromId !== "" ? `ML#${fromId}` : "")).trim(),
    telefono: "",
    text: String(q.text || q.question?.text || "").trim(),
    questionId: qid,
    listingId: String(q.item_id || q.item?.id || "").trim(),
    listingUrl: String(q.permalink || q.item?.permalink || "").trim(),
  };
}

export function metaMessagingAdminFields(channel, item) {
  const code = channel === "ig" ? "IG" : channel === "fb" ? "FB" : "";
  if (!code || !item?.sender?.id) return null;
  const cliente = String(item.sender?.name || item.sender?.profile?.name || item.sender.id);
  const msg = item.message;
  if (msg) {
    if (msg.is_echo) return null;
    const messageId = String(msg.mid || "").trim();
    if (!messageId) return null;
    const type = String(msg.attachments?.[0]?.type || "").toLowerCase();
    let media;
    if (type === "image" || type === "animated_image") media = "image";
    else if (type === "audio") media = "audio";
    else if (type === "sticker") media = "sticker";
    return {
      channel: code,
      messageId,
      cliente,
      telefono: "",
      text: String(msg.text || "").trim(),
      media,
    };
  }
  const postback = item.postback;
  if (!postback) return null;
  const messageId = String(postback.mid || "").trim();
  const text = String(postback.title || postback.payload || "").trim();
  if (!messageId || !text) return null;
  return { channel: code, messageId, cliente, telefono: "", text };
}

export function metaMessagingItems(body) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  const items = [];
  for (const entry of entries) {
    const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
    for (const item of messaging) items.push(item);
  }
  return items;
}

export function emailInboundFields({ messageId, remitente, asunto, cuerpo } = {}) {
  const subject = String(asunto || "").trim();
  const body = String(cuerpo || "").trim();
  return {
    channel: "EM",
    messageId: String(messageId || "").trim(),
    cliente: String(remitente || "").trim(),
    telefono: "",
    text: clip([subject, body].filter(Boolean).join("\n\n")),
  };
}

export async function recordEmailAdminInbound({ config, messageId, remitente, asunto, cuerpo, logger, getSheets, now } = {}) {
  const fields = emailInboundFields({ messageId, remitente, asunto, cuerpo });
  if (!fields.messageId) return { ok: false, error: "message_id_required" };
  return dispatchAdminInbound(config, fields, { logger, getSheets, now });
}
