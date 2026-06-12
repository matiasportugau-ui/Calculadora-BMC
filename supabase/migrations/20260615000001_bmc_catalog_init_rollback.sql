-- ═══════════════════════════════════════════════════════════════════════════
-- 20260615000001_bmc_catalog_init_rollback.sql — emergency rollback
-- ───────────────────────────────────────────────────────────────────────────
-- Removes the entire `bmc_catalog` schema. No other schema is touched
-- (bmc_catalog has no FKs into identity/clientes/bmc_price_monitor).
--
-- PRE-FLIGHT (defensive — preserve human-curated data):
--   products.codigo_stock holds the SKU↔CODIGO links that used to live in
--   .runtime/product-links.json, and product_platform_listings.match_source
--   = 'manual' rows are operator-confirmed matches. Export both to CSV
--   before dropping — they are expensive to rebuild by hand.
--
-- USAGE:
--   1. Connect with psql.
--   2. Run section 1 (export) and verify the CSVs landed.
--   3. Run section 2 (drop).

-- ── Section 1: export (psql \copy — adjust output paths) ───────────────────
-- \copy (select sku, codigo_stock, calc_path from bmc_catalog.products where codigo_stock is not null) to 'bmc_catalog_links_backup.csv' csv header
-- \copy (select p.sku, l.platform, l.external_id, l.variant_external_id, l.handle, l.match_source from bmc_catalog.product_platform_listings l join bmc_catalog.products p on p.id = l.product_id) to 'bmc_catalog_listings_backup.csv' csv header

-- ── Section 2: drop ─────────────────────────────────────────────────────────
drop schema if exists bmc_catalog cascade;
delete from catalog_schema_migrations where name = '20260615000001_bmc_catalog_init.sql';
