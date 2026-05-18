-- Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
-- Migration: 003 — SKUs table

CREATE TABLE IF NOT EXISTS bmc_market_intel.skus (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   UUID NOT NULL REFERENCES bmc_market_intel.competitors(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  price_selector  TEXT NOT NULL,   -- CSS selector targeting the price element
  is_tracked      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS skus_competitor_id_idx
  ON bmc_market_intel.skus (competitor_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'skus_updated_at'
      AND tgrelid = 'bmc_market_intel.skus'::regclass
  ) THEN
    CREATE TRIGGER skus_updated_at
      BEFORE UPDATE ON bmc_market_intel.skus
      FOR EACH ROW EXECUTE FUNCTION bmc_market_intel.set_updated_at();
  END IF;
END
$$;
