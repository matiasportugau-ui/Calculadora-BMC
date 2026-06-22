/**
 * MercadoLibre question → OmniInboundEvent
 */
import crypto from "node:crypto";
import { buildIdempotencyKey } from "../types.js";

/**
 * @param {{ q: object; nickname?: string; itemTitle?: string }} args
 */
export function mlQuestionToOmniEvent({ q, nickname, itemTitle }) {
  const qid = String(q?.id || "");
  if (!qid) return null;
  const text = String(q.text || "").trim();
  if (!text) return null;

  const mlUserId = q.from?.id ?? null;
  const subject = itemTitle
    ? `${itemTitle}`.slice(0, 512)
    : q.item_id
      ? `ML item ${q.item_id}`
      : `ML Q:${qid}`;

  return {
    source: "ml_sync",
    channel: "ml",
    idempotency_key: buildIdempotencyKey("ml", qid),
    occurred_at: q.date_created || new Date().toISOString(),
    contact_hint: {
      ml_user_id: mlUserId,
      name: nickname || (mlUserId ? `ML#${mlUserId}` : undefined),
    },
    conversation_hint: {
      channel_conversation_id: qid,
      subject,
    },
    message: {
      sender: "customer",
      sender_id: mlUserId != null ? String(mlUserId) : undefined,
      body: text,
      metadata: {
        ml_question_id: qid,
        item_id: q.item_id || null,
      },
    },
    trace_id: crypto.randomUUID(),
  };
}

/**
 * Agent outbound ML answer mirror
 */
export function mlAgentReplyToOmniEvent({ questionId, text, agentId }) {
  const qid = String(questionId || "");
  const body = String(text || "").trim();
  if (!qid || !body) return null;

  return {
    source: "ml_sync",
    channel: "ml",
    idempotency_key: buildIdempotencyKey("ml", `answer:${qid}:${Date.now()}`),
    occurred_at: new Date().toISOString(),
    contact_hint: {},
    conversation_hint: {
      channel_conversation_id: qid,
    },
    message: {
      sender: "agent",
      sender_id: agentId || "send-approved",
      body,
      metadata: { ml_question_id: qid, outbound: true },
    },
    trace_id: crypto.randomUUID(),
  };
}

/**
 * @param {{ config: object; logger?: object; questions: object[]; nicknames?: Record<string,string>; items?: Record<string,object> }} args
 */
export async function shadowWriteMlQuestions(args) {
  if (!args.config?.omniMlShadowWrite) return { written: 0 };
  const { shadowPersist } = await import("../normalizer.js");
  let written = 0;
  for (const q of args.questions || []) {
    const uid = q.from?.id;
    const nickname = args.nicknames?.[uid];
    const item = args.items?.[q.item_id];
    const event = mlQuestionToOmniEvent({
      q,
      nickname,
      itemTitle: item?.title,
    });
    if (!event) continue;
    const r = await shadowPersist(event, {
      databaseUrl: args.config.databaseUrl,
      logger: args.logger,
    });
    if (r) written += 1;
  }
  return { written };
}
