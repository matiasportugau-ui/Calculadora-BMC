/**
 * server/lib/kbAccess.js — federated, role-scoped knowledge access.
 *
 * Aggregates across the KB stores that already exist and stay untouched —
 * trainingKB.js (Q&A corrections, token-overlap), brainKB.js (learned
 * policies), rag.js (historical quote similarity via quote_embeddings) — plus
 * one new, isolated store (team_kb_embeddings) for docs/team/knowledge/*.md
 * and docs/team/PROJECT-STATE.md, so internal dev-agent roles (bmc-security,
 * bmc-calc-specialist, ...) get semantic retrieval over their own knowledge
 * file and project history, not just "read the whole file if told to."
 *
 * Design: federation, not consolidation. No existing table/store is migrated;
 * this module only reads from them. A role's access profile (kbDomains.js)
 * decides which sources are queried and how much of the character budget each
 * gets. Every item returned is tagged with a `domain` so callers can tell a
 * customer Q&A pair from a security finding from a project-history entry.
 *
 * Fails soft everywhere: a missing/unmigrated team_kb_embeddings table, a down
 * DB, or a missing OPENAI key must never break panelin_chat/mercado_libre/etc,
 * which keep their exact pre-existing behavior via trainingKB.js/brainKB.js.
 */

import pg from "pg";
import { embedText } from "./embeddings.js";
import { findRelevantExamples, resolveTrainingAnswer } from "./trainingKB.js";
import { brainBlock } from "./brainKB.js";
import { retrieveSimilarQuotes, formatRetrievedContextForPrompt } from "./rag.js";
import { resolveRoleProfile } from "./kbDomains.js";
import { config } from "../config.js";

let _pool = null;

function getPool() {
  if (!_pool) {
    if (!config.databaseUrl) return null;
    _pool = new pg.Pool({ connectionString: config.databaseUrl });
    _pool.on("error", (err) => {
      console.error("[kbAccess] Postgres pool error:", err.message);
    });
  }
  return _pool;
}

/**
 * Semantic search over team_kb_embeddings, scoped to a set of domains.
 * Returns [] on any failure (table not migrated yet, DB down, embed failure) —
 * this store is additive, callers must degrade gracefully without it.
 *
 * @param {string} query
 * @param {string[]} domains
 * @param {{k?: number, threshold?: number}} [opts]
 */
async function retrieveTeamKbChunks(query, domains, { k = 5, threshold = 0.6 } = {}) {
  if (!Array.isArray(domains) || domains.length === 0) return [];
  if (!query || typeof query !== "string" || query.trim().length < 3) return [];

  const pool = getPool();
  if (!pool) return [];

  let queryEmbedding;
  try {
    queryEmbedding = await embedText(query.trim());
  } catch (err) {
    console.warn("[kbAccess] embedText failed:", err.message);
    return [];
  }
  const embeddingLiteral = `[${queryEmbedding.join(",")}]`;
  const maxDistance = 1 - threshold;

  try {
    const result = await pool.query(
      `SELECT
         source_path,
         domain,
         text,
         (embedding <=> $1::vector) AS distance
       FROM team_kb_embeddings
       WHERE embedding IS NOT NULL
         AND domain = ANY($2::varchar[])
         AND (embedding <=> $1::vector) <= $3
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      [embeddingLiteral, domains, maxDistance, k],
    );
    return result.rows.map((row) => ({
      domain: row.domain,
      text: row.text,
      sourcePath: row.source_path,
      score: parseFloat((1 - parseFloat(row.distance)).toFixed(4)),
    }));
  } catch (err) {
    // Most common cause: team_kb_embeddings not migrated yet (relation does not
    // exist). Non-fatal — this store is additive on top of trainingKB/brainKB.
    console.warn("[kbAccess] team_kb_embeddings query failed (not migrated yet?):", err.message);
    return [];
  }
}

/**
 * Federated, role-scoped KB retrieval.
 *
 * @param {string} role — e.g. "panelin_chat" (customer-facing, unchanged behavior)
 *   or "bmc-security"/"bmc-calc-specialist" (internal dev-agent roles). Unknown
 *   roles fall back to the panelin_chat profile.
 * @param {string} query
 * @param {{limit?: number}} [opts] — limit applies per-source (trainingKB/rag/team docs),
 *   independent of the role's total character budget.
 * @returns {Promise<{items: Array<{domain: string, text: string, score: number, sourcePath?: string}>, meta: object}>}
 */
export async function kbAccess(role, query, opts = {}) {
  const profile = resolveRoleProfile(role);
  const limit = opts.limit ?? 5;
  const items = [];

  if (profile.trainingKB) {
    try {
      const examples = findRelevantExamples(query, { limit });
      for (const entry of examples) {
        const text = resolveTrainingAnswer(entry, role) || entry.goodAnswer || "";
        if (text) items.push({ domain: "customer_qa", text, score: entry.matchScore ?? 0 });
      }
    } catch (err) {
      console.warn("[kbAccess] trainingKB lookup failed:", err.message);
    }
  }

  if (profile.brain) {
    try {
      const block = brainBlock(query);
      if (block) items.push({ domain: "policy", text: block, score: 1 });
    } catch (err) {
      console.warn("[kbAccess] brainKB lookup failed:", err.message);
    }
  }

  if (profile.historicalQuotes) {
    try {
      const quotes = await retrieveSimilarQuotes(query, limit);
      const block = formatRetrievedContextForPrompt(quotes);
      if (block) items.push({ domain: "historical_quote", text: block, score: quotes[0]?.similarity ?? 0 });
    } catch (err) {
      console.warn("[kbAccess] historical quote lookup failed:", err.message);
    }
  }

  if (profile.teamDomains.length > 0) {
    const chunks = await retrieveTeamKbChunks(query, profile.teamDomains, { k: limit });
    items.push(...chunks);
  }

  items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const budget = profile.budget ?? 4000;
  let used = 0;
  const capped = [];
  for (const item of items) {
    if (used >= budget) break;
    const remaining = budget - used;
    const text = item.text.length > remaining ? item.text.slice(0, remaining - 1) + "…" : item.text;
    capped.push({ ...item, text });
    used += text.length;
  }

  return {
    items: capped,
    meta: { role, profile, sourceCount: items.length, returnedCount: capped.length },
  };
}
