// ═══════════════════════════════════════════════════════════════════════════
// server/lib/emailIngestDb.js — Lazy Postgres pool for email ingest idempotency
// ───────────────────────────────────────────────────────────────────────────
// Follows the same pattern as tasksDb.js / traktimeDb.js / waDb.js.
// Backs the public.email_ingest_log table (migration 20260625000001).
// Purpose: let the unattended ingester (Cloud Run Job) run repeatedly without
// writing duplicate CRM leads, and store enough metadata (receiving casilla +
// sender) for the cockpit Email-reply branch to address its reply.
// All helpers are defensive: a null pool (no DATABASE_URL) → no-op, callers
// fall back to ingesting / default sender.
// ═══════════════════════════════════════════════════════════════════════════

import pg from "pg";

let pool = null;

/** @param {string} databaseUrl */
export function getEmailIngestPool(databaseUrl) {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => {
      console.error("[emailIngestDb] idle client error:", err?.message);
    });
  }
  return pool;
}

/** @returns {Promise<boolean>} true if this message_key was already ingested. */
export async function wasIngested(pool, messageKey) {
  if (!pool || !messageKey) return false;
  try {
    const { rows } = await pool.query(
      "select 1 from public.email_ingest_log where message_key = $1 limit 1",
      [String(messageKey)],
    );
    return rows.length > 0;
  } catch (e) {
    console.error("[emailIngestDb] wasIngested failed:", e?.message);
    return false; // fail-open: better a possible dup than dropping a lead
  }
}

/**
 * Record a processed message. Idempotent (ON CONFLICT DO NOTHING).
 * @param {{ messageKey: string, account?: string, messageId?: string, remitente?: string, crmRow?: number|null }} m
 */
export async function markIngested(pool, m) {
  if (!pool || !m?.messageKey) return;
  try {
    await pool.query(
      `insert into public.email_ingest_log (message_key, account, message_id, remitente, crm_row)
       values ($1, $2, $3, $4, $5)
       on conflict (message_key) do nothing`,
      [String(m.messageKey), m.account || null, m.messageId || null, m.remitente || null, m.crmRow ?? null],
    );
  } catch (e) {
    console.error("[emailIngestDb] markIngested failed:", e?.message);
  }
}

/** Look up the ingest metadata for a CRM_Operativo row (for the reply branch). */
export async function getIngestByRow(pool, crmRow) {
  if (!pool || !crmRow) return null;
  try {
    const { rows } = await pool.query(
      `select message_key, account, message_id, remitente, crm_row
         from public.email_ingest_log
        where crm_row = $1
        order by ingested_at desc
        limit 1`,
      [Number(crmRow)],
    );
    return rows[0] || null;
  } catch (e) {
    console.error("[emailIngestDb] getIngestByRow failed:", e?.message);
    return null;
  }
}

/** Tests / manual reset only. */
export async function resetEmailIngestPoolForTests() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
