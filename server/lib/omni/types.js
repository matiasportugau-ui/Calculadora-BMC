/**
 * OmniInboundEvent — Zod-validated canonical inbound envelope.
 * @see docs/transformation/02-target-state.md §5
 */
import { z } from "zod";

export const OMNI_SOURCES = [
  "wa_webhook",
  "wa_extension",
  "ml_webhook",
  "ml_sync",
  "email_ingest",
  "unified_crm_ingest",
  "manual",
  "wa_backfill",
  "ml_backfill",
  "email_backfill",
];

export const OMNI_CHANNELS = ["wa", "ml", "email", "instagram", "facebook", "omnicrm"];

export const contactHintSchema = z
  .object({
    wa_phone: z.string().optional(),
    ml_user_id: z.union([z.number(), z.string()]).optional(),
    email: z.string().optional(),
    name: z.string().optional(),
    chrome_ext_contact_id: z.string().optional(),
  })
  .passthrough();

export const conversationHintSchema = z.object({
  channel_conversation_id: z.string().min(1),
  subject: z.string().optional(),
});

export const messageSchema = z.object({
  sender: z.enum(["customer", "agent", "bot"]),
  sender_id: z.string().optional(),
  body: z.string().min(1),
  attachments: z.array(z.record(z.unknown())).optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const sideEffectsSchema = z
  .object({
    crm_sheet_row: z.number().optional(),
    wa_chat_id: z.string().optional(),
  })
  .optional();

export const omniInboundEventSchema = z.object({
  source: z.enum(OMNI_SOURCES),
  channel: z.enum(OMNI_CHANNELS),
  idempotency_key: z.string().min(1).max(512),
  occurred_at: z.string().min(1),
  contact_hint: contactHintSchema,
  conversation_hint: conversationHintSchema,
  message: messageSchema,
  side_effects: sideEffectsSchema,
  trace_id: z.string().optional(),
});

/** @param {unknown} payload */
export function parseOmniInboundEvent(payload) {
  return omniInboundEventSchema.safeParse(payload);
}

/** @param {string} phone */
export function normalizeWaPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("598")) return `+${digits}`;
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length <= 9) return `+598${digits}`;
  return `+${digits}`;
}

/** @param {string} email */
export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase() || null;
}

/** @param {string|number|null|undefined} id */
export function normalizeMlUserId(id) {
  if (id == null || id === "") return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

/** @param {import("zod").infer<typeof contactHintSchema>} hint @param {string} channel */
export function buildIntegrationUuid(hint, channel) {
  if (channel === "wa") {
    const phone = normalizeWaPhone(hint.wa_phone || hint.phone);
    if (phone) return `wa:${phone}`;
  }
  if (channel === "ml") {
    const mlId = normalizeMlUserId(hint.ml_user_id);
    if (mlId != null) return `ml:${mlId}`;
  }
  if (channel === "email") {
    const em = normalizeEmail(hint.email);
    if (em) return `email:${em}`;
  }
  if (hint.chrome_ext_contact_id) {
    return `ext:${hint.chrome_ext_contact_id}`;
  }
  const name = String(hint.name || "unknown").slice(0, 64);
  return `${channel}:anon:${name.replace(/\s+/g, "_")}`;
}

/** @param {string} channel @param {string} nativeId */
export function buildIdempotencyKey(channel, nativeId) {
  return `${channel}:msg:${String(nativeId).slice(0, 480)}`;
}
