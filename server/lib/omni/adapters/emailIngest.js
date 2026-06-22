/**
 * Email ingest → OmniInboundEvent
 */
import crypto from "node:crypto";
import { createHash } from "node:crypto";
import { buildIdempotencyKey } from "../types.js";

/**
 * @param {string} messageId
 */
export function emailMessageIdHash(messageId) {
  const raw = String(messageId || "").trim().toLowerCase();
  if (!raw) return createHash("sha256").update(`anon:${Date.now()}`).digest("hex").slice(0, 32);
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/**
 * @param {{
 *   asunto?: string;
 *   cuerpo: string;
 *   remitente?: string;
 *   messageId?: string;
 *   parsed?: object;
 *   crmRow?: number;
 * }} args
 */
export function emailIngestToOmniEvent(args) {
  const body = String(args.cuerpo || "").trim();
  if (!body) return null;

  const email = args.parsed?.email_remitente || args.remitente || "";
  const hash = emailMessageIdHash(args.messageId || args.asunto || body.slice(0, 120));
  const convId = `email:${hash}`;

  return {
    source: "email_ingest",
    channel: "email",
    idempotency_key: buildIdempotencyKey("email", hash),
    occurred_at: new Date().toISOString(),
    contact_hint: {
      email,
      name: args.parsed?.cliente || undefined,
      phone: args.parsed?.telefono || undefined,
    },
    conversation_hint: {
      channel_conversation_id: convId,
      subject: args.asunto ? String(args.asunto).slice(0, 512) : undefined,
    },
    message: {
      sender: "customer",
      sender_id: email || undefined,
      body: body.slice(0, 50000),
      metadata: {
        asunto: args.asunto || null,
        message_id_hash: hash,
      },
    },
    side_effects: args.crmRow ? { crm_sheet_row: args.crmRow } : undefined,
    trace_id: crypto.randomUUID(),
  };
}

/**
 * @param {{ config: object; logger?: object; payload: object }} args
 */
export async function shadowWriteEmailIngest(args) {
  if (!args.config?.omniEmailShadowWrite) return null;
  const event = emailIngestToOmniEvent(args.payload);
  if (!event) return null;
  const { shadowPersist } = await import("../normalizer.js");
  return shadowPersist(event, {
    databaseUrl: args.config.databaseUrl,
    logger: args.logger,
  });
}
