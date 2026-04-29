import pg from "pg";

let pool = null;

/** @param {string} databaseUrl */
export function getTransportistaPool(databaseUrl) {
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
      console.error("[transportistaDb] idle client error:", err?.message);
    });
  }
  return pool;
}

/** Solo tests / reinicio manual */
export async function resetTransportistaPoolForTests() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
