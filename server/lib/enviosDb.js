import pg from "pg";

let pool = null;

/** @param {string} databaseUrl */
export function getEnviosPool(databaseUrl) {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 8,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => {
      console.error("[enviosDb] idle client error:", err?.message);
    });
  }
  return pool;
}

/** Solo tests / reinicio manual */
export async function resetEnviosPoolForTests() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}

export const ENVIOS_DRAFTS_DDL = `
CREATE TABLE IF NOT EXISTS envios_drafts (
  id TEXT PRIMARY KEY,
  env_no TEXT NOT NULL,
  payload JSONB NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS envios_drafts_updated_at_idx ON envios_drafts (updated_at DESC);
CREATE INDEX IF NOT EXISTS envios_drafts_env_no_idx ON envios_drafts (env_no);
`;

/**
 * Idempotent schema bootstrap (no separate migrate step required for MVP).
 * @param {import("pg").Pool} pool
 */
export async function ensureEnviosSchema(pool) {
  await pool.query(ENVIOS_DRAFTS_DDL);
}
