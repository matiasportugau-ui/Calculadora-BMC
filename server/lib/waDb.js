/**
 * WA Cockpit — Postgres pool (clonado del patrón Transportista).
 * Reusa DATABASE_URL del repo; la aislación lógica se da por prefijo `wa_*` en tablas.
 */
import pg from "pg";

let pool = null;

/** @param {string} databaseUrl */
export function getWaPool(databaseUrl) {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => {
      console.error("[waDb] idle client error:", err?.message);
    });
  }
  return pool;
}

/** Solo tests / reinicio manual */
export async function resetWaPoolForTests() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
