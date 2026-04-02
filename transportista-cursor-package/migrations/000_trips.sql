-- EXPORT_SEAL — viajes (estado coarse en tabla + detalle en eventos)
create extension if not exists pgcrypto;

create table if not exists trips (
  trip_id uuid primary key default gen_random_uuid(),
  status text not null default 'draft',
  plan_snapshot jsonb not null default '{}'::jsonb,
  assigned_driver_id uuid null,
  assigned_phone_e164 text null,
  confirmed_at timestamptz null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_status_idx on trips (status);
