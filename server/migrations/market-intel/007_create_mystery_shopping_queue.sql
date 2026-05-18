-- Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
-- Migration: 007 — Mystery shopping queue
-- Tasks created by ETL; MUST be approved and executed by a human operator.
-- The system never auto-approves or auto-submits mystery shopping data.

CREATE TABLE IF NOT EXISTS bmc_market_intel.mystery_shopping_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   UUID NOT NULL REFERENCES bmc_market_intel.competitors(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL CHECK (reason IN ('blocked', 'manual_request', 'recurring_parse_error')),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
  notes           TEXT,
  approved_by     TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS msq_status_idx
  ON bmc_market_intel.mystery_shopping_queue (status);

CREATE INDEX IF NOT EXISTS msq_competitor_id_idx
  ON bmc_market_intel.mystery_shopping_queue (competitor_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'msq_updated_at'
      AND tgrelid = 'bmc_market_intel.mystery_shopping_queue'::regclass
  ) THEN
    CREATE TRIGGER msq_updated_at
      BEFORE UPDATE ON bmc_market_intel.mystery_shopping_queue
      FOR EACH ROW EXECUTE FUNCTION bmc_market_intel.set_updated_at();
  END IF;
END
$$;
