/**
 * Training KB + RAG bridge for omni context (WAVE 4 H3).
 */
import { retrieveSimilarQuotes } from "../../rag.js";
import { config } from "../../../config.js";

/**
 * Build retrieval context for suggest/classify from conversation messages.
 * @param {import('pg').Pool} pool
 * @param {string} conversationId
 * @param {string} [latestBody]
 */
export async function buildOmniRetrievalContext(pool, conversationId, latestBody = "") {
  const { rows } = await pool.query(
    `SELECT body FROM omni_messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC LIMIT 5`,
    [conversationId],
  );
  const query = latestBody || rows.map((r) => r.body).join(" ").slice(0, 2000);

  const context = {
    recent_snippets: rows.map((r) => String(r.body).slice(0, 300)),
    rag_cases: [],
  };

  if (config.ragEnabled && query.trim().length >= 8) {
    try {
      context.rag_cases = await retrieveSimilarQuotes(
        query,
        config.ragTopK,
        config.ragThreshold,
      );
    } catch {
      context.rag_cases = [];
    }
  }

  return context;
}

/**
 * Format context block for agentCore user message augmentation.
 * @param {object} ctx — from buildOmniRetrievalContext
 */
export function formatOmniContextBlock(ctx) {
  const parts = [];
  if (ctx.recent_snippets?.length) {
    parts.push("Recent thread:\n" + ctx.recent_snippets.join("\n---\n"));
  }
  if (ctx.rag_cases?.length) {
    const cases = ctx.rag_cases
      .slice(0, 3)
      .map((c, i) => `${i + 1}. sim=${c.similarity?.toFixed?.(2) ?? "?"} ${JSON.stringify(c.metadata || {}).slice(0, 200)}`);
    parts.push("Similar past quotes:\n" + cases.join("\n"));
  }
  return parts.join("\n\n").slice(0, 4000);
}
