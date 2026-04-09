import pg from "pg";

let pool = null;

/**
 * @param {{ omniDatabaseUrl?: string, databaseUrl?: string }} cfg
 * @returns {import("pg").Pool | null}
 */
export function getOmniPool(cfg) {
  const url = cfg?.omniDatabaseUrl || cfg?.databaseUrl || "";
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: 10 });
  }
  return pool;
}

/** Solo tests / reinicio manual */
export async function resetOmniPoolForTests() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
