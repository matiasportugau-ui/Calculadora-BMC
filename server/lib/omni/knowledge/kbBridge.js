/**
 * Training KB + RAG bridge for omni context (WAVE 4 H3).
 */
import { retrieveSimilarQuotes } from "../../rag.js";
import { isSemanticEmbeddingAvailable } from "../../embeddings.js";
import { sanitizeQuoteMetadata } from "../../quoteMetadata.js";
import { config } from "../../../config.js";

// One-time loud warning so a misconfigured enablement (RAG_ENABLED on, no usable
// embedding provider key) is visible in logs without spamming every job.
let _warnedStubEmbeddings = false;

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
    if (!isSemanticEmbeddingAvailable()) {
      // Stub embeddings are non-semantic; grounding on them is worse than no
      // grounding. Skip RAG (keep recent_snippets) and warn once.
      if (!_warnedStubEmbeddings) {
        _warnedStubEmbeddings = true;
        console.warn(
          JSON.stringify({
            event: "omni_rag_skipped_stub_embeddings",
            msg:
              "RAG_ENABLED is on but no usable embedding provider key is configured; " +
              "skipping RAG grounding to avoid non-semantic stub vectors. Set a real " +
              "embedding key, run scripts/training/embedQuotes.js, and verify with " +
              "`npm run omni:rag-precheck`.",
          }),
        );
      }
    } else {
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
      .map((c, i) => `${i + 1}. sim=${c.similarity?.toFixed?.(2) ?? "?"} ${JSON.stringify(sanitizeQuoteMetadata(c.metadata)).slice(0, 200)}`);
    parts.push("Similar past quotes:\n" + cases.join("\n"));
  }
  return parts.join("\n\n").slice(0, 4000);
}
