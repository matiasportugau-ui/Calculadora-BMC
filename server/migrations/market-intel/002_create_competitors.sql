-- Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
-- Migration: 002 — Competitors table
-- Deduplication key: normalized domain (lowercase, strip www.)

CREATE TABLE IF NOT EXISTS bmc_market_intel.competitors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  domain        TEXT NOT NULL,        -- normalized: lowercase, no www. prefix
  website_url   TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS competitors_domain_uq
  ON bmc_market_intel.competitors (domain);

CREATE OR REPLACE FUNCTION bmc_market_intel.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'competitors_updated_at'
      AND tgrelid = 'bmc_market_intel.competitors'::regclass
  ) THEN
    CREATE TRIGGER competitors_updated_at
      BEFORE UPDATE ON bmc_market_intel.competitors
      FOR EACH ROW EXECUTE FUNCTION bmc_market_intel.set_updated_at();
  END IF;
END
$$;
