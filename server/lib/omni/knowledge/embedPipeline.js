/**
 * Embed pipeline for omni messages (WAVE 4 H2).
 * Stores content hash; full vector index reuses quote_embeddings RAG when enabled.
 */
import crypto from "node:crypto";
import { config } from "../../../config.js";
import { embedText } from "../../embeddings.js";

/**
 * @param {import('pg').Pool} pool
 * @param {string} messageId
 */
export async function runEmbedJob(pool, messageId) {
  if (!config.ragEnabled) {
    return { ok: true, skipped: true, reason: "rag_disabled" };
  }

  const { rows } = await pool.query(`SELECT body FROM omni_messages WHERE id = $1`, [messageId]);
  const body = rows[0]?.body;
  if (!body || String(body).trim().length < 8) {
    return { ok: true, skipped: true, reason: "body_too_short" };
  }

  const contentHash = crypto.createHash("sha256").update(String(body).trim()).digest("hex");
  const { rows: existing } = await pool.query(
    `SELECT content_hash FROM omni_message_embeddings WHERE message_id = $1`,
    [messageId],
  );
  if (existing[0]?.content_hash === contentHash) {
    return { ok: true, skipped: true, reason: "already_embedded" };
  }

  await embedText(String(body).trim(), contentHash);

  await pool.query(
    `INSERT INTO omni_message_embeddings (message_id, content_hash)
     VALUES ($1, $2)
     ON CONFLICT (message_id) DO UPDATE SET content_hash = $2, embedded_at = now()`,
    [messageId, contentHash],
  );

  return { ok: true, content_hash: contentHash };
}
