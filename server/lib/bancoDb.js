import pg from "pg";

let pool = null;

/** @param {string} databaseUrl */
export function getBancoPool(databaseUrl) {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => {
      console.error("[bancoDb] idle client error:", err?.message);
    });
  }
  return pool;
}

/** Solo tests / reinicio manual */
export async function resetBancoPoolForTests() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
