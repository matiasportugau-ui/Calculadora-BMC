/**
 * Normaliza webhooks Meta (object page | instagram) hacia omni_messages.
 */

/**
 * @param {object} body
 * @returns {Array<{ channel: 'messenger'|'instagram', senderId: string, messageId: string, text: string, raw: object }>}
 */
export function extractMetaMessagingEvents(body) {
  const out = [];
  const obj = body?.object;
  if (obj !== "page" && obj !== "instagram") return out;

  const channel = obj === "page" ? "messenger" : "instagram";
  const entries = body.entry || [];
  for (const ent of entries) {
    const messaging = ent.messaging || [];
    for (const ev of messaging) {
      if (ev.message && ev.message.is_echo) continue;
      const senderId = ev.sender?.id;
      const mid = ev.message?.mid || ev.message?.message_id || ev.message?.id;
      if (!senderId || !mid) continue;
      const text =
        ev.message?.text ||
        ev.message?.attachments?.[0]?.payload?.url ||
        (ev.message?.attachments?.length ? `[${ev.message.attachments[0].type || "attachment"}]` : "");
      out.push({
        channel,
        senderId: String(senderId),
        messageId: String(mid),
        text: String(text || ""),
        raw: ev,
      });
    }
  }
  return out;
}
