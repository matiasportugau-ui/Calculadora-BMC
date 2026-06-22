/**
 * WA Cloud API webhook → OmniInboundEvent
 */
import crypto from "node:crypto";
import { buildIdempotencyKey } from "../types.js";

/**
 * @param {{ msg: object; chatId: string; contactName?: string }} args
 */
export function waWebhookToOmniEvent({ msg, chatId, contactName }) {
  const text = msg.text?.body || msg.caption || "";
  if (!text) return null;

  const msgId = String(msg.id || `cloud_in_${chatId}_${Date.now()}`);
  const phoneDigits = String(chatId || "").replace(/\D/g, "").slice(0, 32);
  const tsIso = new Date(
    Number(msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now()),
  ).toISOString();

  return {
    source: "wa_webhook",
    channel: "wa",
    idempotency_key: buildIdempotencyKey("wa", msgId),
    occurred_at: tsIso,
    contact_hint: {
      wa_phone: phoneDigits || chatId,
      name: contactName || undefined,
    },
    conversation_hint: {
      channel_conversation_id: chatId,
    },
    message: {
      sender: "customer",
      sender_id: phoneDigits || chatId,
      body: text,
      metadata: { wa_msg_id: msgId, type: msg.type || "text" },
    },
    side_effects: { wa_chat_id: chatId },
    trace_id: crypto.randomUUID(),
  };
}

/**
 * @param {{ config: object; logger?: object; msg: object; chatId: string; contactName?: string }} args
 */
export async function shadowWriteWaWebhook(args) {
  if (!args.config?.omniWaShadowWrite) return null;
  const event = waWebhookToOmniEvent(args);
  if (!event) return null;
  const { shadowPersist } = await import("../normalizer.js");
  return shadowPersist(event, {
    databaseUrl: args.config.databaseUrl,
    logger: args.logger,
  });
}
