-- Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
-- Migration: 005 — ETL runs audit log

CREATE TABLE IF NOT EXISTS bmc_market_intel.etl_runs (
  run_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at              TIMESTAMPTZ NOT NULL,
  finished_at             TIMESTAMPTZ,
  status                  TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  competitors_attempted   INTEGER NOT NULL DEFAULT 0,
  competitors_succeeded   INTEGER NOT NULL DEFAULT 0,
  errors                  JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS etl_runs_started_at_idx
  ON bmc_market_intel.etl_runs (started_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'etl_runs_updated_at'
      AND tgrelid = 'bmc_market_intel.etl_runs'::regclass
  ) THEN
    CREATE TRIGGER etl_runs_updated_at
      BEFORE UPDATE ON bmc_market_intel.etl_runs
      FOR EACH ROW EXECUTE FUNCTION bmc_market_intel.set_updated_at();
  END IF;
END
$$;
