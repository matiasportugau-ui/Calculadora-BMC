/**
 * Omni Core — Postgres pool + health helpers.
 */
import pg from "pg";

const OMNI_SCHEMA_VERSION = "1.0.0";

let pool = null;

/** @param {string} databaseUrl */
export function getOmniPool(databaseUrl) {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => {
      console.error("[omniDb] idle client error:", err?.message);
    });
  }
  return pool;
}

export function getOmniSchemaVersion() {
  return OMNI_SCHEMA_VERSION;
}

/** @param {import("pg").Pool} p */
export async function omniHealthCheck(p) {
  const { rows } = await p.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'omni_contacts'
    ) AS has_contacts,
    EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'omni_ingest_dedup'
    ) AS has_dedup
  `);
  const row = rows[0] || {};
  return {
    ok: Boolean(row.has_contacts && row.has_dedup),
    schema_version: OMNI_SCHEMA_VERSION,
    has_contacts: Boolean(row.has_contacts),
    has_dedup: Boolean(row.has_dedup),
  };
}

/** Solo tests */
export async function resetOmniPoolForTests() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
