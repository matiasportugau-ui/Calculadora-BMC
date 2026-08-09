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

/** Coordinación de reparto — SDD-REPARTO-COORDINACION */
export const REPARTOS_DDL = `
CREATE TABLE IF NOT EXISTS repartos (
  id TEXT PRIMARY KEY,
  reparto_no TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'en_coordinacion',
  delivery_date DATE,
  truck_l NUMERIC,
  vehicle_label TEXT,
  transportista TEXT,
  patente TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  drive_folder_id TEXT,
  drive_folder_url TEXT,
  created_by TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS repartos_updated_at_idx ON repartos (updated_at DESC);
CREATE INDEX IF NOT EXISTS repartos_status_idx ON repartos (status);
CREATE INDEX IF NOT EXISTS repartos_delivery_date_idx ON repartos (delivery_date DESC);

CREATE TABLE IF NOT EXISTS reparto_events (
  id BIGSERIAL PRIMARY KEY,
  reparto_id TEXT NOT NULL REFERENCES repartos(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT,
  type TEXT NOT NULL,
  message TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS reparto_events_reparto_id_idx ON reparto_events (reparto_id, at DESC);

CREATE TABLE IF NOT EXISTS reparto_documents (
  id TEXT PRIMARY KEY,
  reparto_id TEXT NOT NULL REFERENCES repartos(id) ON DELETE CASCADE,
  kind TEXT,
  name TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  stop_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reparto_documents_reparto_id_idx ON reparto_documents (reparto_id);
`;

/**
 * Idempotent schema bootstrap (no separate migrate step required for MVP).
 * @param {import("pg").Pool} pool
 */
export async function ensureEnviosSchema(pool) {
  await pool.query(ENVIOS_DRAFTS_DDL);
  await pool.query(REPARTOS_DDL);
}
