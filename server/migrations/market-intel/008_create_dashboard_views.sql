-- Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
-- Migration: 008 — Read-optimized views for dashboard
-- All dashboard queries MUST use these views — never inline heavy aggregations on page load.

-- ─── v_last_etl_run ───────────────────────────────────────────────
CREATE OR REPLACE VIEW bmc_market_intel.v_last_etl_run AS
  SELECT
    run_id,
    started_at,
    finished_at,
    status,
    competitors_attempted,
    competitors_succeeded,
    errors
  FROM bmc_market_intel.etl_runs
  ORDER BY started_at DESC
  LIMIT 1;

-- ─── v_alert_counts ───────────────────────────────────────────────
CREATE OR REPLACE VIEW bmc_market_intel.v_alert_counts AS
  SELECT
    COUNT(*) FILTER (WHERE level = 'info')     AS info_count,
    COUNT(*) FILTER (WHERE level = 'warning')  AS warning_count,
    COUNT(*) FILTER (WHERE level = 'critical') AS critical_count
  FROM bmc_market_intel.alerts
  WHERE created_at >= NOW() - INTERVAL '24 hours';

-- ─── v_top_competitors_by_delta ────────────────────────────────────
CREATE OR REPLACE VIEW bmc_market_intel.v_top_competitors_by_delta AS
  WITH ranked AS (
    SELECT
      ph.competitor_id,
      ph.sku_id,
      ph.price,
      ph.scraped_at,
      FIRST_VALUE(ph.price) OVER w AS first_price,
      LAST_VALUE(ph.price)  OVER w AS last_price,
      COUNT(*) OVER (PARTITION BY ph.competitor_id, ph.sku_id) AS data_points
    FROM bmc_market_intel.price_history ph
    WHERE ph.scraped_at >= NOW() - INTERVAL '7 days'
    WINDOW w AS (
      PARTITION BY ph.competitor_id, ph.sku_id
      ORDER BY ph.scraped_at
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    )
  ),
  deltas AS (
    SELECT DISTINCT
      r.competitor_id,
      r.sku_id,
      r.first_price,
      r.last_price,
      r.data_points,
      CASE
        WHEN r.first_price = 0 THEN NULL
        ELSE ROUND(((r.last_price - r.first_price) / r.first_price * 100)::NUMERIC, 2)
      END AS pct_change,
      MAX(r.scraped_at) OVER (PARTITION BY r.competitor_id, r.sku_id) AS last_seen
    FROM ranked r
    WHERE r.data_points >= 2
  )
  SELECT
    d.competitor_id,
    c.name  AS competitor_name,
    c.domain,
    d.sku_id,
    s.name  AS sku_name,
    d.first_price AS price_before,
    d.last_price  AS price_after,
    d.pct_change,
    d.data_points,
    d.last_seen
  FROM deltas d
  JOIN bmc_market_intel.competitors c ON c.id = d.competitor_id
  JOIN bmc_market_intel.skus         s ON s.id = d.sku_id
  WHERE d.pct_change IS NOT NULL
  ORDER BY ABS(d.pct_change) DESC
  LIMIT 10;

-- ─── v_pending_mystery_shopping ───────────────────────────────────
CREATE OR REPLACE VIEW bmc_market_intel.v_pending_mystery_shopping AS
  SELECT
    msq.id,
    msq.competitor_id,
    c.name    AS competitor_name,
    c.domain,
    msq.reason,
    msq.status,
    msq.notes,
    msq.created_at
  FROM bmc_market_intel.mystery_shopping_queue msq
  JOIN bmc_market_intel.competitors c ON c.id = msq.competitor_id
  WHERE msq.status = 'pending'
  ORDER BY msq.created_at DESC;

-- ─── Materialized view: daily price summary ───────────────────────
-- Refreshed by the ETL runner after each successful run.
CREATE MATERIALIZED VIEW IF NOT EXISTS bmc_market_intel.mv_daily_price_summary AS
  SELECT
    DATE_TRUNC('day', ph.scraped_at AT TIME ZONE 'UTC') AS day,
    ph.competitor_id,
    ph.sku_id,
    MIN(ph.price)  AS price_min,
    MAX(ph.price)  AS price_max,
    AVG(ph.price)  AS price_avg,
    COUNT(*)       AS sample_count
  FROM bmc_market_intel.price_history ph
  GROUP BY 1, 2, 3
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_daily_price_summary_uq
  ON bmc_market_intel.mv_daily_price_summary (day, competitor_id, sku_id);

REFRESH MATERIALIZED VIEW bmc_market_intel.mv_daily_price_summary;
