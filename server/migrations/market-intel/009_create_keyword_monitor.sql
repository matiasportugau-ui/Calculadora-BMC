-- Module: market-intelligence | Owner: bmc-dev | Created: 2026-07-04
-- Migration: 009 — Keyword monitor (tracked terms + SERP snapshots)

CREATE TABLE IF NOT EXISTS bmc_market_intel.tracked_keywords (
  id              TEXT PRIMARY KEY,
  keyword         TEXT NOT NULL,
  cluster         TEXT,
  family          TEXT,
  intent          TEXT CHECK (intent IN ('informational','commercial','transactional','navigational')),
  priority        TEXT CHECK (priority IN ('P1','P2','P3','P4')),
  market          TEXT NOT NULL DEFAULT 'uy',
  language        TEXT NOT NULL DEFAULT 'es',
  on_site_gap     BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS tracked_keywords_keyword_market_uq
  ON bmc_market_intel.tracked_keywords (keyword, market);

CREATE TABLE IF NOT EXISTS bmc_market_intel.keyword_snapshots (
  id                    BIGSERIAL PRIMARY KEY,
  keyword_id            TEXT NOT NULL REFERENCES bmc_market_intel.tracked_keywords(id) ON DELETE CASCADE,
  captured_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  autocomplete_count    INT,
  volume_proxy          TEXT CHECK (volume_proxy IN ('high','medium','low','unknown')),
  difficulty            TEXT CHECK (difficulty IN ('high','medium','low','unknown')),
  bmc_serp_position     INT,
  top_competitor_domain TEXT,
  serp_domains          JSONB,
  metadata              JSONB
);

CREATE INDEX IF NOT EXISTS keyword_snapshots_kw_captured
  ON bmc_market_intel.keyword_snapshots (keyword_id, captured_at DESC);

CREATE OR REPLACE VIEW bmc_market_intel.v_keyword_monitor_latest AS
SELECT DISTINCT ON (tk.id)
  tk.id,
  tk.keyword,
  tk.cluster,
  tk.family,
  tk.intent,
  tk.priority,
  tk.market,
  tk.on_site_gap,
  tk.is_active,
  ks.captured_at,
  ks.autocomplete_count,
  ks.volume_proxy,
  ks.difficulty,
  ks.bmc_serp_position,
  ks.top_competitor_domain,
  ks.serp_domains
FROM bmc_market_intel.tracked_keywords tk
LEFT JOIN bmc_market_intel.keyword_snapshots ks ON ks.keyword_id = tk.id
WHERE tk.is_active = TRUE
ORDER BY tk.id, ks.captured_at DESC NULLS LAST;

CREATE OR REPLACE VIEW bmc_market_intel.v_last_keyword_refresh AS
SELECT
  MAX(captured_at) AS last_refresh_at,
  COUNT(DISTINCT keyword_id) AS keywords_captured
FROM bmc_market_intel.keyword_snapshots
WHERE captured_at >= NOW() - INTERVAL '7 days';