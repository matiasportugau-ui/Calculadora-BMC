create table if not exists tk_clients (
  client_id   uuid primary key default gen_random_uuid(),
  name        text not null,
  rut         text,
  email       text,
  address     text,
  notes       text,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists tk_clients_name_active_idx
  on tk_clients (lower(name)) where archived_at is null;
