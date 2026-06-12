-- Panelin BMC Platform v1 — Initial price lists seed + example data
-- Safe to re-run (idempotent upserts).

-- Price lists (core for BMC)
insert into price_lists (code, name, margin_pct, active)
values
  ('venta_local', 'Venta Local (BMC directo)', 35, true),
  ('venta_web', 'Venta Web / Shopify (público)', 25, true)
on conflict (code) do update set
  name = excluded.name,
  margin_pct = excluded.margin_pct,
  active = excluded.active;

-- Optional: a couple of example thresholds (commented to avoid noise on fresh DB)
-- You can set real thresholds later via API or panelin_set_stock_threshold()

-- Example: uncomment if you want demo data on first run (will be skipped if products don't exist yet)
-- insert into stock_thresholds (sku, deposito, min_qty)
-- values ('PANEL-40-10', 'principal', 20)
-- on conflict do nothing;
