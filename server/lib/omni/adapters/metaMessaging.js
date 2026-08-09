import crypto from "node:crypto";
import { buildIdempotencyKey } from "../types.js";

function asIsoFromTimestamp(timestamp) {
  const n = Number(timestamp);
  const ms = Number.isFinite(n) && n > 0 ? (n > 10_000_000_000 ? n : n * 1000) : Date.now();
  return new Date(ms).toISOString();
}

function senderName(messagingEvent) {
  return (
    messagingEvent?.sender?.name ||
    messagingEvent?.sender?.profile?.name ||
    messagingEvent?.sender?.profile?.first_name ||
    undefined
  );
}

function messageText(messagingEvent) {
  const msg = messagingEvent?.message || {};
  const postback = messagingEvent?.postback || {};
  const referral = messagingEvent?.referral || {};
  return String(
    msg.text ||
      postback.title ||
      postback.payload ||
      referral.ref ||
      (Array.isArray(msg.attachments) && msg.attachments.length ? "[attachment]" : ""),
  ).trim();
}

function messageNativeId(messagingEvent, prefix) {
  return (
    messagingEvent?.message?.mid ||
    messagingEvent?.postback?.mid ||
    messagingEvent?.delivery?.mids?.[0] ||
    messagingEvent?.read?.mid ||
    `${prefix}_${messagingEvent?.sender?.id || "unknown"}_${messagingEvent?.timestamp || Date.now()}`
  );
}

/**
 * @param {{ body: object; channel: "ig"|"fb"; source: "ig_webhook"|"fb_webhook" }} args
 */
export function metaMessagingWebhookToOmniEvents({ body, channel, source }) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  const events = [];
  for (const entry of entries) {
    const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
    for (const item of messaging) {
      if (!item?.sender?.id) continue;
      const text = messageText(item);
      if (!text) continue;
      const nativeId = String(messageNativeId(item, channel));
      const senderId = String(item.sender.id);
      const recipientId = item?.recipient?.id ? String(item.recipient.id) : undefined;
      const idField = channel === "ig" ? "igsid" : "psid";
      events.push({
        source,
        channel,
        idempotency_key: buildIdempotencyKey(channel, nativeId),
        occurred_at: asIsoFromTimestamp(item.timestamp),
        contact_hint: {
          [idField]: senderId,
          name: senderName(item),
        },
        conversation_hint: {
          channel_conversation_id: senderId,
        },
        message: {
          sender: "customer",
          sender_id: senderId,
          body: text,
          attachments: item?.message?.attachments || [],
          metadata: {
            [`${channel}_message_id`]: nativeId,
            recipient_id: recipientId,
            is_echo: Boolean(item?.message?.is_echo),
            type: item?.message ? "message" : item?.postback ? "postback" : "event",
          },
        },
        trace_id: crypto.randomUUID(),
      });
    }
  }
  return events;
}
