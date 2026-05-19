create table if not exists tk_projects (
  project_id        uuid primary key default gen_random_uuid(),
  client_id         uuid not null references tk_clients(client_id) on delete restrict,
  name              text not null,
  color_hex         text not null default '#0071e3',
  billable_default  boolean not null default true,
  hourly_rate_usd   numeric(10,2) not null default 0,
  rounding_minutes  integer not null default 15
    check (rounding_minutes in (1, 5, 15, 30, 60)),
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists tk_projects_client_idx on tk_projects (client_id);
create unique index if not exists tk_projects_client_name_idx
  on tk_projects (client_id, lower(name)) where archived_at is null;
