-- ═══════════════════════════════════════════════════════════════════════════
-- bmc_catalog schema — Products Module (Fase 0 init)
-- ───────────────────────────────────────────────────────────────────────────
-- Project: Calculadora-BMC
-- Purpose: canonical product registry + platform listing links (Shopify /
-- MercadoLibre / calculadora) + price-update engine state (rules, changesets,
-- push runs).
--
-- IMPORTANT (Fase 1 — híbrido por etapas):
--   Prices remain canonical in the MATRIZ Google Sheet. This schema holds
--   ONLY links, enrichment (descriptions/images/platform fields) and engine
--   state. Price columns land in Fase 2 (separate migration).
--
-- Replaces .runtime/product-links.json (ephemeral on Cloud Run — links were
-- silently lost on every deploy).
--
-- Schema isolation: all tables under `bmc_catalog` (no collision with
-- identity/clientes/bmc_price_monitor). Matching joins against
-- bmc_price_monitor.shopify_variants / ml_listings at query time (no FKs
-- across schemas — those tables are rebuilt by the daily ETL).
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create schema if not exists bmc_catalog;

-- Auto-touch helper used by triggers on tables with updated_at column.
create or replace function bmc_catalog.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. products — canonical registry (one row per business product)
-- ───────────────────────────────────────────────────────────────────────────
create table bmc_catalog.products (
  id            uuid primary key default gen_random_uuid(),
  sku           text unique,                -- MATRIZ col D (canonical business key when present)
  codigo_stock  text,                       -- Stock sheet CODIGO (replaces product-links.json value)
  calc_path     text,                       -- constants.js path, e.g. PANELS_TECHO.ISOROOF_3G.esp.50
  nombre        text,
  descripcion   text,                       -- canonical base description (Fase 1C)
  categoria     text,                       -- catalog.json category keys (paneles, fijaciones, ...)
  family        text,                       -- ISODEC, ISOWALL, ISOROOF... (pricing-rule scope)
  tags          text[] not null default '{}',
  attrs         jsonb not null default '{}'::jsonb,  -- espesor_mm, nucleo, ancho_util_m, color...
  status        text not null default 'active'
                check (status in ('active','draft','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text
);

create index products_codigo_stock_idx on bmc_catalog.products (codigo_stock)
  where codigo_stock is not null;
create index products_family_idx on bmc_catalog.products (family);

create trigger products_touch_updated_at
  before update on bmc_catalog.products
  for each row execute function bmc_catalog.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 2. product_platform_listings — per-platform mapping + enrichment
-- ───────────────────────────────────────────────────────────────────────────
create table bmc_catalog.product_platform_listings (
  id                   bigserial primary key,
  product_id           uuid not null references bmc_catalog.products(id) on delete cascade,
  platform             text not null
                       check (platform in ('shopify','mercadolibre','calculadora')),
  external_id          text not null,       -- Shopify product GID | MLU item id | calc path
  variant_external_id  text,                -- Shopify variant id when product maps to one variant
  handle               text,                -- Shopify handle
  url                  text,
  title_override       text,
  description_override text,
  images               jsonb not null default '[]'::jsonb,   -- [{url, alt, position}]
  platform_fields      jsonb not null default '{}'::jsonb,   -- ML: category_id, listing_type... | Shopify: tags, vendor, seo...
  price_current        numeric(12,2),       -- last observed price on platform (drift detection)
  currency             text not null default 'USD',
  sync_enabled         boolean not null default false,       -- gate for the update engine
  match_source         text
                       check (match_source in ('auto-sku','auto-fuzzy','manual')),
  last_seen_at         timestamptz,
  created_at           timestamptz not null default now()
);

create unique index ppl_platform_external_uq
  on bmc_catalog.product_platform_listings (platform, external_id, coalesce(variant_external_id, ''));
create index ppl_product_idx on bmc_catalog.product_platform_listings (product_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. pricing_rules — per-platform/segment rules (append-only versioning)
--    Resolution order: sku override > family rule > platform default > base.
-- ───────────────────────────────────────────────────────────────────────────
create table bmc_catalog.pricing_rules (
  rule_id       uuid primary key default gen_random_uuid(),
  scope_type    text not null check (scope_type in ('platform','family','sku')),
  scope_value   text,                       -- null for platform scope; family name; sku
  platform      text not null check (platform in ('local','web','shopify','ml')),
  rule_type     text not null check (rule_type in ('pct','abs_delta','abs_override')),
  value         numeric(12,4) not null,
  rounding      text not null default 'none',
  active        boolean not null default true,
  superseded_by uuid references bmc_catalog.pricing_rules(rule_id),
  note          text,
  created_by    text,
  created_at    timestamptz not null default now()
);

create unique index pricing_rules_active_uq
  on bmc_catalog.pricing_rules (platform, scope_type, coalesce(scope_value, ''))
  where active;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. changesets + changeset_items — every update flows through ONE pipeline:
--    draft → simulated → applying → applied | partial | cancelled
-- ───────────────────────────────────────────────────────────────────────────
create table bmc_catalog.changesets (
  changeset_id    uuid primary key default gen_random_uuid(),
  operation       text not null
                  check (operation in ('individual','bulk_set','pct_adjust','csv_import','rules_apply')),
  status          text not null default 'draft'
                  check (status in ('draft','simulated','applying','applied','partial','cancelled')),
  params          jsonb not null default '{}'::jsonb,  -- scope, pct, platforms, rules snapshot
  guard_overrides jsonb not null default '{}'::jsonb,  -- {maxPct:true, belowCost:["SKU1"]}
  created_by      text,
  created_at      timestamptz not null default now(),
  simulated_at    timestamptz,
  applied_at      timestamptz
);

create table bmc_catalog.changeset_items (
  item_id       bigserial primary key,
  changeset_id  uuid not null references bmc_catalog.changesets(changeset_id) on delete cascade,
  sku           text not null,
  platform      text not null,
  target_ref    text,                       -- calc path | shopify variant gid | MLU id
  current_value numeric(12,2),              -- snapshot at simulate
  new_value     numeric(12,2) not null,
  currency      text not null default 'USD',  -- 'UYU' for ml
  pct_change    numeric(8,2),
  guard_flags   jsonb not null default '{}'::jsonb,  -- {over_max_pct, below_cost, missing_target}
  unique (changeset_id, sku, platform)
);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. push_runs + push_run_items — one run per platform, per-item status,
--    resumable (resume re-runs only pending/failed, incrementing attempt).
-- ───────────────────────────────────────────────────────────────────────────
create table bmc_catalog.push_runs (
  run_id       uuid primary key default gen_random_uuid(),
  changeset_id uuid not null references bmc_catalog.changesets(changeset_id),
  platform     text not null,
  status       text not null default 'pending'
               check (status in ('pending','running','partial','completed','failed','cancelled')),
  dry_run      boolean not null default false,
  totals       jsonb not null default '{}'::jsonb,
  started_at   timestamptz,
  finished_at  timestamptz,
  created_by   text,
  created_at   timestamptz not null default now()
);

create table bmc_catalog.push_run_items (
  run_item_id       bigserial primary key,
  run_id            uuid not null references bmc_catalog.push_runs(run_id) on delete cascade,
  changeset_item_id bigint references bmc_catalog.changeset_items(item_id),
  sku               text not null,
  target_ref        text,
  attempt           int not null default 0,
  status            text not null default 'pending'
                    check (status in ('pending','ok','failed','skipped')),
  error             text,
  response          jsonb,
  pushed_at         timestamptz
);

create index push_run_items_resume_idx on bmc_catalog.push_run_items (run_id, status);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — same posture as bmc_price_monitor: enabled, no anon policies.
-- Access is server-side only via the service connection (requireUser gating
-- happens at the Express layer).
-- ───────────────────────────────────────────────────────────────────────────
alter table bmc_catalog.products                  enable row level security;
alter table bmc_catalog.product_platform_listings enable row level security;
alter table bmc_catalog.pricing_rules             enable row level security;
alter table bmc_catalog.changesets                enable row level security;
alter table bmc_catalog.changeset_items           enable row level security;
alter table bmc_catalog.push_runs                 enable row level security;
alter table bmc_catalog.push_run_items            enable row level security;
