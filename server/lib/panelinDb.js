/**
 * Panelin BMC Platform — Postgres pool
 * Reusa DATABASE_URL del proyecto (mismo que WA/Transportista).
 * Tablas aisladas lógicamente bajo prefijo `panelin_*` en el schema tracker + funciones.
 *
 * Patrón idéntico a waDb.js / transportistaDb.js para consistencia del repo.
 *
 * Review 5ae44e21 (Issue 7): webhook processor (webhooks.js) uses getPanelinPool directly (bypassing
 * panelin router getPool helper); singleton + console.error is acceptable for now (matches other Db
 * modules). Enhanced comment + no-throw guarantee preserved. Full logger injection / shared pool
 * centralization recommended for Fase 5.
 */

import pg from "pg";

let pool = null;

/**
 * @param {string} databaseUrl
 * @returns {import('pg').Pool | null}
 */
export function getPanelinPool(databaseUrl) {
  if (!databaseUrl) return null;

  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });

    // Idle-client errors must not crash the process (console per existing pattern; review-5ae44e21 tolerant)
    pool.on("error", (err) => {
      console.error("[panelinDb] idle client error:", err?.message);
    });
  }

  return pool;
}

/** Solo tests / reinicio manual */
export async function resetPanelinPoolForTests() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
