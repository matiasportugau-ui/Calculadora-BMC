-- Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
-- Migration: 006 — Alerts (dedup_key unique to prevent duplicate notifications)

CREATE TABLE IF NOT EXISTS bmc_market_intel.alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id     UUID NOT NULL REFERENCES bmc_market_intel.competitors(id) ON DELETE CASCADE,
  sku_id            UUID REFERENCES bmc_market_intel.skus(id) ON DELETE SET NULL,
  level             TEXT NOT NULL CHECK (level IN ('info', 'warning', 'critical')),
  message           TEXT NOT NULL,
  price_before      NUMERIC(12,2),
  price_after       NUMERIC(12,2),
  pct_change        NUMERIC(8,4),
  dedup_key         TEXT NOT NULL,   -- competitor_id||sku_id||level||utc_date
  notified_email    BOOLEAN NOT NULL DEFAULT FALSE,
  notified_inapp    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS alerts_dedup_key_uq
  ON bmc_market_intel.alerts (dedup_key);

CREATE INDEX IF NOT EXISTS alerts_created_at_idx
  ON bmc_market_intel.alerts (created_at DESC);

CREATE INDEX IF NOT EXISTS alerts_level_idx
  ON bmc_market_intel.alerts (level);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'alerts_updated_at'
      AND tgrelid = 'bmc_market_intel.alerts'::regclass
  ) THEN
    CREATE TRIGGER alerts_updated_at
      BEFORE UPDATE ON bmc_market_intel.alerts
      FOR EACH ROW EXECUTE FUNCTION bmc_market_intel.set_updated_at();
  END IF;
END
$$;
