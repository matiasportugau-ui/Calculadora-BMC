import pg from "pg";

let pool = null;

/** @param {string} databaseUrl */
export function getTraktimePool(databaseUrl) {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => {
      console.error("[traktimeDb] idle client error:", err?.message);
    });
  }
  return pool;
}

/** Solo tests / reinicio manual */
export async function resetTraktimePoolForTests() {
  if (pool) {
    if (typeof pool.end === "function") await pool.end().catch(() => {});
    pool = null;
  }
}

/** Solo tests: permite montar el router con un pool shim sin abrir Postgres. */
export function setTraktimePoolForTests(testPool) {
  pool = testPool || null;
}
