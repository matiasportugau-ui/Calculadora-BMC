-- Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-19
-- Migration: 009 — Extend competitors with strategic metadata
-- Source: docs/team/projects/BMC-competitive-brief-2026-05-19.md +
--         data/market-intel/competitive-matrix-2026-05-19.csv
--
-- All ADD COLUMN use IF NOT EXISTS for idempotency.
-- The merged upsertCompetitor() in server/lib/marketIntel/etl/deduplication.js
-- only sets name/website_url/notes on UPDATE — these new columns survive
-- automatic ETL discovery and stay as human-curated metadata.

-- ─── 1. Type enum extension via CHECK ────────────────────────────────
ALTER TABLE bmc_market_intel.competitors
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS tier INT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS positioning TEXT,
  ADD COLUMN IF NOT EXISTS target_audience TEXT,
  ADD COLUMN IF NOT EXISTS threat_score INT,
  ADD COLUMN IF NOT EXISTS opportunity_score INT,
  ADD COLUMN IF NOT EXISTS has_ecommerce BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_pir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_bim BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_calculator BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS certifications TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS ig_handle TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;

-- ─── 2. CHECK constraints (idempotent via pg_constraint lookup) ──────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'competitors_type_check'
      AND conrelid = 'bmc_market_intel.competitors'::regclass
  ) THEN
    ALTER TABLE bmc_market_intel.competitors
      ADD CONSTRAINT competitors_type_check
      CHECK (type IS NULL OR type IN (
        'fabricante','importador','distribuidor','instalador',
        'reseller','mixto','marketplace'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'competitors_tier_check'
      AND conrelid = 'bmc_market_intel.competitors'::regclass
  ) THEN
    ALTER TABLE bmc_market_intel.competitors
      ADD CONSTRAINT competitors_tier_check
      CHECK (tier IS NULL OR (tier BETWEEN 1 AND 5));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'competitors_threat_score_check'
      AND conrelid = 'bmc_market_intel.competitors'::regclass
  ) THEN
    ALTER TABLE bmc_market_intel.competitors
      ADD CONSTRAINT competitors_threat_score_check
      CHECK (threat_score IS NULL OR (threat_score BETWEEN 0 AND 5));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'competitors_opportunity_score_check'
      AND conrelid = 'bmc_market_intel.competitors'::regclass
  ) THEN
    ALTER TABLE bmc_market_intel.competitors
      ADD CONSTRAINT competitors_opportunity_score_check
      CHECK (opportunity_score IS NULL OR (opportunity_score BETWEEN 0 AND 5));
  END IF;
END
$$;

-- ─── 3. Indexes on filterable strategic columns ──────────────────────
CREATE INDEX IF NOT EXISTS competitors_tier_idx
  ON bmc_market_intel.competitors (tier) WHERE tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS competitors_type_idx
  ON bmc_market_intel.competitors (type) WHERE type IS NOT NULL;

CREATE INDEX IF NOT EXISTS competitors_threat_score_idx
  ON bmc_market_intel.competitors (threat_score DESC NULLS LAST);

-- ─── 4. Convenience view for the dashboard's "high-priority" panel ───
CREATE OR REPLACE VIEW bmc_market_intel.v_competitors_by_priority AS
  SELECT
    id,
    name,
    domain,
    tier,
    type,
    tagline,
    positioning,
    threat_score,
    opportunity_score,
    has_ecommerce,
    has_pir,
    has_bim,
    has_calculator,
    certifications,
    ig_handle,
    whatsapp_number,
    is_active,
    created_at,
    updated_at
  FROM bmc_market_intel.competitors
  WHERE is_active = TRUE
  ORDER BY
    threat_score DESC NULLS LAST,
    tier ASC NULLS LAST,
    name ASC;

COMMENT ON COLUMN bmc_market_intel.competitors.tier IS '1=critical 2=secondary 3=indirect 4=watchlist 5=marketplace_bulk';
COMMENT ON COLUMN bmc_market_intel.competitors.threat_score IS '0-5 — risk this competitor poses to BMC';
COMMENT ON COLUMN bmc_market_intel.competitors.opportunity_score IS '0-5 — opportunity BMC has to displace them';
COMMENT ON COLUMN bmc_market_intel.competitors.metadata IS 'JSONB bucket: garantia, tono, foco_servicios[], blog_topics[], precio_minimo_usd_m2, etc.';
