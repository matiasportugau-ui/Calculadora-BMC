-- Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
-- Migration: 004 — Price history (delta-only writes)

CREATE TABLE IF NOT EXISTS bmc_market_intel.price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id          UUID NOT NULL REFERENCES bmc_market_intel.skus(id) ON DELETE CASCADE,
  competitor_id   UUID NOT NULL REFERENCES bmc_market_intel.competitors(id) ON DELETE CASCADE,
  price           NUMERIC(12,2) NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'UYU',
  scraped_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS price_history_sku_scraped_idx
  ON bmc_market_intel.price_history (sku_id, competitor_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS price_history_scraped_at_idx
  ON bmc_market_intel.price_history (scraped_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'price_history_updated_at'
      AND tgrelid = 'bmc_market_intel.price_history'::regclass
  ) THEN
    CREATE TRIGGER price_history_updated_at
      BEFORE UPDATE ON bmc_market_intel.price_history
      FOR EACH ROW EXECUTE FUNCTION bmc_market_intel.set_updated_at();
  END IF;
END
$$;
