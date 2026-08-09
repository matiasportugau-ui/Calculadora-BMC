/**
 * PEA health / schema probe for GET /api/pea/health
 */

const PEA_SCHEMA_VERSION = "pea-002";

/**
 * @param {import('pg').Pool|null} pool
 * @param {import('../../config.js').config} config
 */
export async function getPeaHealth(pool, config) {
  let schemaReady = false;
  let pendingJobs = null;
  if (pool) {
    try {
      const { rows } = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'pea' AND table_name = 'jobs'
         ) AS has_jobs`,
      );
      schemaReady = Boolean(rows[0]?.has_jobs);
      if (schemaReady) {
        const ratchet = await pool.query(
          `SELECT EXISTS (
             SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'pea' AND table_name = 'ratchet_links'
           ) AS has_ratchet`,
        );
        schemaReady = Boolean(ratchet.rows[0]?.has_ratchet);
      }
      if (schemaReady) {
        const pending = await pool.query(
          `SELECT COUNT(*)::int AS n FROM pea.jobs WHERE status = 'pending'`,
        );
        pendingJobs = pending.rows[0]?.n ?? 0;
      }
    } catch {
      schemaReady = false;
    }
  }
  return {
    ok: true,
    pea_enabled: Boolean(config.peaEnabled),
    worker_enabled: Boolean(config.peaWorkerEnabled),
    auto_diagnose: Boolean(config.peaAutoDiagnose),
    schema_ready: schemaReady,
    schema_version: PEA_SCHEMA_VERSION,
    pending_jobs: pendingJobs,
    contracts: {
      openapi: "docs/sdd/panelin-evolution-architect/contracts/openapi-pea.yaml",
      migration: "server/migrations/pea/001_pea_core.sql",
      migration_ratchet: "server/migrations/pea/002_pea_ratchet_links.sql",
    },
  };
}

export function getPeaSchemaVersion() {
  return PEA_SCHEMA_VERSION;
}
