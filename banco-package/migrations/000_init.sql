-- Banco (METALOG) — libro de movimientos bancarios. Forward-only.
-- pgcrypto provides gen_random_uuid(); already created by identity/traktime
-- migrations, idempotent here. Money columns are numeric(14,2); a movement
-- always has débito o crédito (never ninguno) — enforced by CHECK.
-- Dedup: unique (account_id, dedup_hash); the hash incluye un índice de
-- ocurrencia para tolerar movimientos idénticos legítimos el mismo día y a la
-- vez hacer idempotente la re-importación del mismo extracto (o rangos
-- de fechas solapados entre extractos).

create extension if not exists pgcrypto;

create table if not exists banco_accounts (
  account_id uuid primary key default gen_random_uuid(),
  bank text not null default 'BROU',
  name text not null,
  account_number text,
  currency text not null default 'UYU',
  entity text not null default 'metalog',
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists banco_import_batches (
  batch_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references banco_accounts(account_id),
  filename text,
  rows_total integer not null default 0,
  rows_imported integer not null default 0,
  rows_duplicated integer not null default 0,
  rows_errored integer not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists banco_movements (
  movement_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references banco_accounts(account_id),
  batch_id uuid references banco_import_batches(batch_id),
  fecha date not null,
  descripcion text not null,
  numero_documento text,
  asunto text,
  dependencia text,
  debito numeric(14,2),
  credito numeric(14,2),
  categoria text,
  entidad text,
  notas text,
  dedup_hash text not null,
  created_at timestamptz not null default now(),
  constraint banco_movements_importe check (debito is not null or credito is not null),
  constraint banco_movements_entidad check (
    entidad is null or entidad in ('bmc', 'expreso_este', 'personal', 'mixta')
  ),
  constraint banco_movements_dedup unique (account_id, dedup_hash)
);

create index if not exists banco_movements_fecha_idx
  on banco_movements (account_id, fecha desc);
create index if not exists banco_movements_categoria_idx
  on banco_movements (categoria) where categoria is not null;
create index if not exists banco_movements_entidad_idx
  on banco_movements (entidad) where entidad is not null;

-- Reglas de clasificación automática: substring case/acentos-insensible sobre
-- descripción + asunto. Se aplican al importar y bajo demanda
-- (POST /api/banco/rules/apply). Sin seeds: la taxonomía la define el operador
-- (ver planilla Proveedores — BMC / Expreso Este / Personal).
create table if not exists banco_rules (
  rule_id uuid primary key default gen_random_uuid(),
  pattern text not null,
  categoria text,
  entidad text,
  priority integer not null default 100,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint banco_rules_entidad check (
    entidad is null or entidad in ('bmc', 'expreso_este', 'personal', 'mixta')
  ),
  constraint banco_rules_efecto check (categoria is not null or entidad is not null)
);
