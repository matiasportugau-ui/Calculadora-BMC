/**
 * WA extension batch ingest → OmniInboundEvent
 */
import crypto from "node:crypto";
import { buildIdempotencyKey } from "../types.js";

/**
 * @param {object} m Normalized ingest message from wa.js
 */
export function waExtensionMessageToOmniEvent(m) {
  const msgId = String(m.msg_id || "");
  if (!msgId || !m.chat_id) return null;

  const body = String(m.text || "").trim();
  if (!body) return null;

  const sender = m.direction === "out" ? "agent" : "customer";

  return {
    source: "wa_extension",
    channel: "wa",
    idempotency_key: buildIdempotencyKey("wa", msgId),
    occurred_at: m.ts ? new Date(m.ts).toISOString() : new Date().toISOString(),
    contact_hint: {
      wa_phone: m.phone || m.chat_id,
      name: m.contact_name || undefined,
    },
    conversation_hint: {
      channel_conversation_id: m.chat_id,
    },
    message: {
      sender,
      sender_id: m.phone || m.chat_id,
      body,
      metadata: {
        wa_msg_id: msgId,
        direction: m.direction,
        source: m.source || "extension",
      },
    },
    side_effects: { wa_chat_id: m.chat_id },
    trace_id: crypto.randomUUID(),
  };
}

/**
 * @param {{ config: object; logger?: object; messages: object[] }} args
 */
export async function shadowWriteWaExtensionBatch(args) {
  if (!args.config?.omniWaShadowWrite) return { written: 0 };
  const { shadowPersist } = await import("../normalizer.js");
  let written = 0;
  for (const m of args.messages || []) {
    const event = waExtensionMessageToOmniEvent(m);
    if (!event) continue;
    const r = await shadowPersist(event, {
      databaseUrl: args.config.databaseUrl,
      logger: args.logger,
    });
    if (r) written += 1;
  }
  return { written };
}
