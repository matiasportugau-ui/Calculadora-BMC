/**
 * Deal field extraction from message text (WAVE 4 F2).
 * Heuristic-first; AI path optional via aiWorker extract_deal job.
 */
import { createDeal, findOpenDealForConversation, updateDeal } from "./dealService.js";

const USD_RE = /(?:usd|u\$s?|\$)\s*([\d.,]+)/i;
const M2_RE = /(\d[\d.,]*)\s*m\s*[²2]/i;

/**
 * @param {string} body
 * @param {{ contactName?: string, channel?: string }} ctx
 */
export function extractDealFields(body, ctx = {}) {
  const text = String(body || "").trim();
  const lower = text.toLowerCase();
  let valueUsd = null;
  const usdMatch = text.match(USD_RE);
  if (usdMatch) {
    const n = parseFloat(usdMatch[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) valueUsd = n;
  }

  const hasQuoteIntent =
    lower.includes("cotiz") ||
    lower.includes("presupuesto") ||
    lower.includes("panel") ||
    lower.includes("techo") ||
    Boolean(M2_RE.test(text));

  let stage = "lead";
  if (valueUsd) stage = "qualified";
  if (lower.includes("propuesta") || lower.includes("pdf")) stage = "proposal";

  const contactLabel = ctx.contactName || "Cliente";
  const title = hasQuoteIntent
    ? `Cotización — ${contactLabel}`.slice(0, 512)
    : `Consulta — ${contactLabel}`.slice(0, 512);

  return {
    title,
    value_usd: valueUsd,
    stage,
    confidence: hasQuoteIntent ? 0.75 : 0.4,
    signals: { hasQuoteIntent, m2: M2_RE.test(text) },
  };
}

/**
 * Process extract_deal AI job (heuristic; registry AI optional later).
 * @param {import('pg').Pool} pool
 * @param {object} jobRow
 */
export async function processExtractDealJob(pool, jobRow) {
  const { rows: ctxRows } = await pool.query(
    `SELECT m.body, m.conversation_id, c.channel, c.contact_id, co.name AS contact_name
     FROM omni_messages m
     JOIN omni_conversations c ON c.id = m.conversation_id
     JOIN omni_contacts co ON co.id = c.contact_id
     WHERE m.id = $1`,
    [jobRow.message_id],
  );
  const ctx = ctxRows[0];
  if (!ctx) return { ok: false, error: "message_not_found" };

  const extracted = extractDealFields(ctx.body, {
    contactName: ctx.contact_name,
    channel: ctx.channel,
  });

  let deal = await findOpenDealForConversation(pool, ctx.conversation_id);
  let created = false;
  if (deal) {
    const patch = {};
    if (extracted.value_usd && !deal.value_usd) patch.value_usd = extracted.value_usd;
    if (extracted.stage !== "lead" && deal.stage === "lead") patch.stage = extracted.stage;
    if (Object.keys(patch).length) {
      const upd = await updateDeal(pool, deal.id, patch);
      deal = upd.deal;
    }
  } else if (extracted.signals.hasQuoteIntent) {
    deal = await createDeal(pool, {
      contact_id: ctx.contact_id,
      title: extracted.title,
      value_usd: extracted.value_usd,
      stage: extracted.stage,
      source_channel: ctx.channel,
      source_conversation_id: ctx.conversation_id,
      properties: { created_by: "extract_deal", message_id: jobRow.message_id },
    });
    created = true;
  }

  return {
    ok: true,
    extracted,
    deal_id: deal?.id ?? null,
    created,
  };
}
