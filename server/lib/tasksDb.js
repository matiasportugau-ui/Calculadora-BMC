// ═══════════════════════════════════════════════════════════════════════════
// server/lib/tasksDb.js — Lazy Postgres pool for Tareas (Tasks) module
// ───────────────────────────────────────────────────────────────────────────
// Follows the same pattern as traktimeDb.js / waDb.js.
// Connects to the Supabase `tasks.*` schema via DATABASE_URL.
// ═══════════════════════════════════════════════════════════════════════════

import pg from "pg";

let pool = null;

/** @param {string} databaseUrl */
export function getTasksPool(databaseUrl) {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => {
      console.error("[tasksDb] idle client error:", err?.message);
    });
  }
  return pool;
}

/** Solo tests / reinicio manual */
export async function resetTasksPoolForTests() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
