-- ═══════════════════════════════════════════════════════════════════════════
-- bmc_price_monitor schema — initial migration
-- ───────────────────────────────────────────────────────────────────────────
-- Project: Calculadora-BMC (htnwozvopveibwppyjhg)
-- Purpose: store snapshots of BMC's Shopify catalog, MLU own listings, MLU
-- competitor results, price alerts, exchange rate, and ETL observability.
--
-- All tables live under the `bmc_price_monitor` schema so they don't collide
-- with future features in the same Supabase project.
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists bmc_price_monitor;

-- Auto-touch helper used by triggers
create or replace function bmc_price_monitor.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Shopify products / variants snapshot (BMC web — USD)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists bmc_price_monitor.shopify_products (
  id              bigint primary key,                  -- Shopify product_id
  handle          text   not null,
  title           text   not null,
  product_type    text,
  vendor          text,
  tags            text[],
  price_min_usd   numeric(12,2),
  price_max_usd   numeric(12,2),
  variants_count  int    default 0,
  available       boolean default true,
  url             text,
  raw             jsonb,
  scraped_at      timestamptz not null default now()
);

create table if not exists bmc_price_monitor.shopify_variants (
  id                    bigint primary key,             -- Shopify variant_id
  product_id            bigint not null
                         references bmc_price_monitor.shopify_products(id)
                         on delete cascade,
  title                 text,
  sku                   text,
  price_usd             numeric(12,2),
  compare_at_price_usd  numeric(12,2),
  available             boolean default true,
  scraped_at            timestamptz not null default now()
);

create index if not exists shopify_variants_product_idx
  on bmc_price_monitor.shopify_variants(product_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Own MercadoLibre Uruguay listings (UYU)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists bmc_price_monitor.ml_listings (
  id                   text primary key,               -- MLU item_id (ej. MLU111)
  title                text not null,
  price                numeric(12,2) not null,
  currency_id          text not null default 'UYU',
  condition            text,
  permalink            text,
  thumbnail            text,
  status               text,
  available_quantity   int,
  sold_quantity        int,
  raw                  jsonb,
  fetched_at           timestamptz not null default now()
);

create index if not exists ml_listings_status_idx
  on bmc_price_monitor.ml_listings(status);

-- ───────────────────────────────────────────────────────────────────────────
-- Keyword mapping: cada producto Shopify mapea a una keyword editable
-- que el ETL usa para buscar competencia en MLU.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists bmc_price_monitor.search_keywords (
  shopify_product_id bigint primary key
                     references bmc_price_monitor.shopify_products(id)
                     on delete cascade,
  keyword            text   not null,
  enabled            boolean not null default true,
  updated_at         timestamptz not null default now(),
  updated_by         text
);

drop trigger if exists search_keywords_touch
  on bmc_price_monitor.search_keywords;
create trigger search_keywords_touch
before update on bmc_price_monitor.search_keywords
for each row execute function bmc_price_monitor.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- Resultados de competencia en MLU por producto.
-- Cada corrida agrega un set de filas nuevas con scraped_at; queries usan
-- la corrida más reciente vía MAX(scraped_at) o filtran por etl_run_id.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists bmc_price_monitor.ml_competitors (
  id                   bigserial primary key,
  shopify_product_id   bigint not null
                        references bmc_price_monitor.shopify_products(id)
                        on delete cascade,
  ml_item_id           text   not null,
  ml_title             text,
  ml_price             numeric(12,2),
  ml_currency_id       text   default 'UYU',
  ml_condition         text,
  ml_permalink         text,
  ml_thumbnail         text,
  ml_seller_id         bigint,
  ml_seller_nickname   text,
  ml_position          int,                  -- posición en el SERP de MLU
  ml_sold_quantity     int,
  ml_available_qty     int,
  shipping_free        boolean default false,
  raw                  jsonb,
  etl_run_id           bigint,
  scraped_at           timestamptz not null default now()
);

create index if not exists ml_competitors_product_idx
  on bmc_price_monitor.ml_competitors(shopify_product_id, scraped_at desc);

create index if not exists ml_competitors_run_idx
  on bmc_price_monitor.ml_competitors(etl_run_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Tipo de cambio USD → UYU (singleton). El ETL lo refresca desde BCU.
-- Si manual_override=true, el ETL respeta el valor manual.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists bmc_price_monitor.fx_settings (
  id                int primary key default 1,
  source            text not null default 'BCU',     -- 'BCU' | 'manual' | 'dolarya'
  uyu_per_usd       numeric(10,4) not null,
  fetched_at        timestamptz not null default now(),
  manual_override   boolean not null default false,
  notes             text,
  constraint fx_singleton check (id = 1)
);

-- ───────────────────────────────────────────────────────────────────────────
-- Alertas detectadas (log histórico). Se generan en cada corrida.
-- Una alerta queda 'open' hasta que el usuario la resuelve manualmente.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists bmc_price_monitor.price_alerts (
  id                   bigserial primary key,
  shopify_product_id   bigint not null
                        references bmc_price_monitor.shopify_products(id)
                        on delete cascade,
  alert_type           text   not null,                -- 'over_market' | 'under_market' | 'no_competitors' | 'stale_data'
  shopify_price_usd    numeric(12,2),
  shopify_price_uyu    numeric(12,2),                  -- convertido con fx_used
  ml_median_uyu        numeric(12,2),
  ml_min_uyu           numeric(12,2),
  ml_max_uyu           numeric(12,2),
  ml_competitor_count  int,
  diff_pct             numeric(8,4),                   -- (shopify_uyu - ml_median) / ml_median * 100
  threshold_pct        numeric(8,4) not null default 5.0,
  fx_used              numeric(10,4),
  etl_run_id           bigint,
  detected_at          timestamptz not null default now(),
  resolved_at          timestamptz,
  resolved_note        text
);

create index if not exists price_alerts_unresolved_idx
  on bmc_price_monitor.price_alerts(detected_at desc)
  where resolved_at is null;

create index if not exists price_alerts_product_idx
  on bmc_price_monitor.price_alerts(shopify_product_id, detected_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- ETL runs — observabilidad histórica de cada corrida del scheduled task.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists bmc_price_monitor.etl_runs (
  id                          bigserial primary key,
  started_at                  timestamptz not null default now(),
  finished_at                 timestamptz,
  status                      text not null default 'running',  -- 'running' | 'success' | 'failed' | 'partial'
  shopify_products_synced     int default 0,
  ml_listings_synced          int default 0,
  ml_searches_run             int default 0,
  ml_competitors_synced       int default 0,
  alerts_generated            int default 0,
  fx_uyu_per_usd              numeric(10,4),
  duration_ms                 bigint,
  error_summary               text,
  details                     jsonb
);

create index if not exists etl_runs_status_idx
  on bmc_price_monitor.etl_runs(started_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ───────────────────────────────────────────────────────────────────────────
-- service_role: acceso total (lo usa el ETL en Cloud Run).
-- authenticated: read en todas + update solo en search_keywords.
-- anon: sin acceso (todo opt-in via JWT en el artefacto si correspondiera).
-- ═══════════════════════════════════════════════════════════════════════════

alter table bmc_price_monitor.shopify_products enable row level security;
alter table bmc_price_monitor.shopify_variants enable row level security;
alter table bmc_price_monitor.ml_listings      enable row level security;
alter table bmc_price_monitor.search_keywords  enable row level security;
alter table bmc_price_monitor.ml_competitors   enable row level security;
alter table bmc_price_monitor.fx_settings      enable row level security;
alter table bmc_price_monitor.price_alerts     enable row level security;
alter table bmc_price_monitor.etl_runs         enable row level security;

-- service_role full access (idempotente — drop+create)
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'shopify_products','shopify_variants','ml_listings','search_keywords',
      'ml_competitors','fx_settings','price_alerts','etl_runs'])
  loop
    execute format(
      'drop policy if exists "service_role_all_%I" on bmc_price_monitor.%I', t, t);
    execute format(
      'create policy "service_role_all_%I" on bmc_price_monitor.%I
         for all to service_role using (true) with check (true)', t, t);
  end loop;
end $$;

-- authenticated read en todas las tablas
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'shopify_products','shopify_variants','ml_listings','search_keywords',
      'ml_competitors','fx_settings','price_alerts','etl_runs'])
  loop
    execute format(
      'drop policy if exists "authenticated_read_%I" on bmc_price_monitor.%I', t, t);
    execute format(
      'create policy "authenticated_read_%I" on bmc_price_monitor.%I
         for select to authenticated using (true)', t, t);
  end loop;
end $$;

-- authenticated puede actualizar search_keywords (editor inline en el artefacto)
drop policy if exists "authenticated_update_search_keywords"
  on bmc_price_monitor.search_keywords;
create policy "authenticated_update_search_keywords"
  on bmc_price_monitor.search_keywords for update
  to authenticated using (true) with check (true);

-- ───────────────────────────────────────────────────────────────────────────
-- Seed: tipo de cambio inicial — el ETL lo sobreescribe en su primera corrida.
-- ───────────────────────────────────────────────────────────────────────────
insert into bmc_price_monitor.fx_settings (id, source, uyu_per_usd, manual_override, notes)
values (1, 'manual', 41.0000, true, 'Seed inicial — ETL lo refrescará desde BCU.')
on conflict (id) do nothing;
