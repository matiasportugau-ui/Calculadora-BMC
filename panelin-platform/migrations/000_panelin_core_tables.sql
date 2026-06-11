-- Panelin BMC Platform v1 — Core tables
-- Fase 1: Product master, price lists, prices, stock snapshot, movements, invoices, webhooks DLQ, thresholds, alerts.
-- Idempotent, safe for re-runs.

create extension if not exists pgcrypto;

-- 1. Master de productos (SKU como llave natural)
create table if not exists products (
  sku text primary key,
  name text not null,
  description text,
  unit text not null default 'unid',
  category text,
  cost_usd numeric(12,2) not null default 0,
  active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_active_idx on products (active);
create index if not exists products_category_idx on products (category);

-- 2. Listas de precios (venta_local = BMC directo, venta_web = público/Shopify)
create table if not exists price_lists (
  id serial primary key,
  code text unique not null,           -- 'venta_local', 'venta_web'
  name text not null,
  margin_pct numeric(5,2) not null default 0,  -- margen sobre costo
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Precios efectivos por producto + lista (puede tener overrides y vigencia)
create table if not exists product_prices (
  sku text not null references products(sku) on delete cascade,
  price_list_id int not null references price_lists(id) on delete cascade,
  price_usd numeric(12,2) not null,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  source text not null default 'manual',   -- 'matriz', 'facturaexpress', 'manual', 'sync'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (sku, price_list_id)
);

create index if not exists product_prices_sku_idx on product_prices (sku);

-- 4. Stock actual por depósito (snapshot)
create table if not exists stock (
  sku text not null references products(sku) on delete cascade,
  deposito text not null default 'principal',
  qty numeric(12,2) not null default 0 check (qty >= 0),
  last_movement_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (sku, deposito)
);

create index if not exists stock_deposito_idx on stock (deposito);
create index if not exists stock_low_idx on stock (sku, deposito) where qty < 5;  -- ayuda para alertas rápidas

-- 5. Movimientos de stock (fuente de verdad para cambios)
create table if not exists stock_movements (
  id bigserial primary key,
  sku text not null references products(sku),
  deposito text not null default 'principal',
  delta numeric(12,2) not null,
  qty_after numeric(12,2),
  reason text,                    -- 'venta', 'compra', 'ajuste', 'devolucion', 'facturaexpress_webhook', 'manual'
  ref_type text,                  -- 'invoice', 'adjustment', 'order', etc.
  ref_id text,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists stock_movements_sku_created_idx on stock_movements (sku, created_at desc);
create index if not exists stock_movements_ref_idx on stock_movements (ref_type, ref_id);

-- 6. Facturas (sync desde FacturaExpress + internas)
create table if not exists invoices (
  id bigserial primary key,
  external_id text unique,        -- ID de FacturaExpress
  number text,
  date timestamptz,
  client_name text,
  client_rut text,
  total_usd numeric(12,2),
  currency text default 'USD',
  status text,
  items jsonb,
  raw jsonb,
  source text default 'facturaexpress',
  created_at timestamptz not null default now()
);

create index if not exists invoices_date_idx on invoices (date desc);

-- 7. DLQ para webhooks (reintentos y diagnóstico)
create table if not exists webhook_failures (
  id bigserial primary key,
  source text not null,           -- 'facturaexpress'
  event_type text,
  payload jsonb not null,
  error text,
  attempts int not null default 0,
  last_attempt timestamptz,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists webhook_failures_unresolved_idx on webhook_failures (resolved, created_at) where resolved = false;

-- 8. Umbrales de stock bajo por SKU + depósito
create table if not exists stock_thresholds (
  sku text not null references products(sku) on delete cascade,
  deposito text not null default 'principal',
  min_qty numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (sku, deposito)
);

-- 9. Alertas generadas (historial de stock bajo)
create table if not exists stock_alerts (
  id bigserial primary key,
  sku text not null,
  deposito text not null default 'principal',
  current_qty numeric(12,2),
  threshold numeric(12,2),
  severity text not null default 'low',   -- 'low', 'critical'
  acknowledged boolean not null default false,
  acknowledged_at timestamptz,
  acknowledged_by text,
  created_at timestamptz not null default now()
);

create index if not exists stock_alerts_open_idx on stock_alerts (acknowledged, created_at desc) where acknowledged = false;
create index if not exists stock_alerts_sku_idx on stock_alerts (sku, created_at desc);

-- Tabla de control de migraciones (la crea el runner, pero documentamos)
-- create table if not exists panelin_schema_migrations (name text primary key, applied_at timestamptz not null default now());
