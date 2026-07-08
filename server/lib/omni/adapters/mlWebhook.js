/**
 * MercadoLibre webhook resource → OmniInboundEvent.
 *
 * ML webhook notifications only include a topic + resource path. The route/service
 * layer must fetch that resource first and pass it here; this adapter stays pure
 * and offline-testable. Post-sale messaging API windows/rate rules are enforced
 * by ML on outbound; inbound messages are mirrored for HITL handling only.
 */
import crypto from "node:crypto";
import { buildIdempotencyKey } from "../types.js";

const strip = (v) => String(v || "").trim();

function removeQueryAndTrailingSlashes(value) {
  const input = strip(value);
  const queryIndex = input.indexOf("?");
  let end = queryIndex >= 0 ? queryIndex : input.length;
  while (end > 0 && input.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return input.slice(0, end);
}

export function extractMlWebhookResourceId(notification = {}) {
  const raw = strip(notification.resource || notification._id || notification.id);
  if (!raw) return "";
  const noQuery = removeQueryAndTrailingSlashes(raw);
  const parts = noQuery.split("/").filter(Boolean);
  if (parts[0] === "questions" && parts[1]) return parts[1];
  if (parts.length > 1) return parts.join("/");
  return parts[0] || noQuery;
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickMessagePayload(payload) {
  if (Array.isArray(payload?.messages) && payload.messages.length) return payload.messages[0];
  if (Array.isArray(payload?.results) && payload.results.length) return payload.results[0];
  return payload || {};
}

function mlUserIdFromMessage(message, payload) {
  return (
    message?.from?.user_id ??
    message?.from?.id ??
    message?.sender?.user_id ??
    message?.sender?.id ??
    payload?.buyer?.id ??
    payload?.from?.user_id ??
    payload?.from?.id ??
    payload?.user_id ??
    null
  );
}

export function mlWebhookToOmniEvent({ notification = {}, resourcePayload = {}, topic } = {}) {
  const resolvedTopic = strip(topic || notification.topic).toLowerCase();
  if (!new Set(["questions", "messages"]).has(resolvedTopic)) return null;

  const resourceId = extractMlWebhookResourceId(notification);
  if (!resourceId) return null;

  if (resolvedTopic === "questions") {
    const q = resourcePayload || {};
    const text = firstText(q.text, q.question?.text);
    if (!text) return null;
    const qid = strip(q.id || resourceId);
    const mlUserId = q.from?.id ?? q.user_id ?? null;
    const itemId = q.item_id || q.item?.id || null;
    return {
      source: "ml_webhook",
      channel: "ml",
      idempotency_key: buildIdempotencyKey("ml", resourceId),
      occurred_at: q.date_created || notification.sent || notification.received || new Date().toISOString(),
      contact_hint: {
        ml_user_id: mlUserId ?? undefined,
        name: mlUserId != null ? `ML#${mlUserId}` : undefined,
      },
      conversation_hint: {
        channel_conversation_id: qid,
        subject: itemId ? `ML item ${itemId}` : `ML Q:${qid}`,
      },
      message: {
        sender: "customer",
        sender_id: mlUserId != null ? String(mlUserId) : undefined,
        body: text,
        metadata: {
          ml_topic: "questions",
          ml_resource: notification.resource || null,
          ml_resource_id: resourceId,
          ml_question_id: qid,
          item_id: itemId,
          status: q.status || null,
        },
      },
      trace_id: crypto.randomUUID(),
    };
  }

  const msg = pickMessagePayload(resourcePayload);
  const text = firstText(msg.text, msg.message, msg.body, msg.plain, msg.content?.text);
  if (!text) return null;
  const mlUserId = mlUserIdFromMessage(msg, resourcePayload);
  const orderId = msg.order_id || msg.order?.id || resourcePayload.order_id || resourcePayload.order?.id || null;
  const packId = msg.pack_id || msg.pack?.id || resourcePayload.pack_id || resourcePayload.pack?.id || null;
  const convId = strip(orderId || packId || resourceId);
  return {
    source: "ml_webhook",
    channel: "ml",
    idempotency_key: buildIdempotencyKey("ml", resourceId),
    occurred_at: msg.date_created || msg.created_at || notification.sent || notification.received || new Date().toISOString(),
    contact_hint: {
      ml_user_id: mlUserId ?? undefined,
      name: mlUserId != null ? `ML#${mlUserId}` : undefined,
    },
    conversation_hint: {
      channel_conversation_id: convId,
      subject: orderId ? `ML order ${orderId}` : packId ? `ML pack ${packId}` : `ML ${resourceId}`,
    },
    message: {
      sender: "customer",
      sender_id: mlUserId != null ? String(mlUserId) : undefined,
      body: text,
      metadata: {
        ml_topic: "messages",
        ml_resource: notification.resource || null,
        ml_resource_id: resourceId,
        ml_message_id: msg.id || null,
        order_id: orderId,
        pack_id: packId,
      },
    },
    trace_id: crypto.randomUUID(),
  };
}
