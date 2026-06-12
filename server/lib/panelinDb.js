/**
 * Panelin BMC Platform — Postgres pool
 * Reusa DATABASE_URL del proyecto (mismo que WA/Transportista).
 * Tablas aisladas lógicamente bajo prefijo `panelin_*` en el schema tracker + funciones.
 *
 * Patrón idéntico a waDb.js / transportistaDb.js para consistencia del repo.
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

    // Idle-client errors must not crash the process
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
