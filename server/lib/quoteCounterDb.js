// ═══════════════════════════════════════════════════════════════════════════
// server/lib/quoteCounterDb.js — Global quote counter pool
// Singleton pg.Pool pattern (same as waDb.js, transportistaDb.js)
// ═══════════════════════════════════════════════════════════════════════════

import pg from "pg";

let pool = null;

export function getQuoteCounterPool(databaseUrl) {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => {
      console.error("[quoteCounterDb] idle client error:", err?.message);
    });
  }
  return pool;
}

export async function resetQuoteCounterPoolForTests() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
