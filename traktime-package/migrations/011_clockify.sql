-- Clockify read-only mirror (Fase 1).
--
-- Clockify is the time-capture engine; BMC consumes its data via the public
-- REST + Reports API and stores a decoupled mirror here. These tables are
-- intentionally separate from tk_* (no FKs into the identity/projects graph)
-- so operators without a BMC login still appear. IDs are Clockify strings.
-- Reconciliation into tk_* for invoicing happens in a later phase via the
-- nullable bmc_user_id link (resolved by email).

create table if not exists clockify_users (
  clockify_user_id  text primary key,
  email             text,
  name              text,
  status            text,
  -- best-effort link to identity.users(user_id) resolved by email; nullable.
  bmc_user_id       uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists clockify_users_email_idx on clockify_users (lower(email));

create table if not exists clockify_projects (
  clockify_project_id  text primary key,
  name                 text,
  client_name          text,
  color_hex            text,
  archived             boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists clockify_entries (
  clockify_entry_id    text primary key,
  clockify_user_id     text,
  clockify_project_id  text,
  description          text not null default '',
  started_at           timestamptz,
  stopped_at           timestamptz,           -- null = timer running
  duration_seconds     integer,
  billable             boolean not null default true,
  tags                 text[] not null default '{}',
  raw                  jsonb not null default '{}'::jsonb,
  synced_at            timestamptz not null default now()
);

create index if not exists clockify_entries_user_started_idx
  on clockify_entries (clockify_user_id, started_at desc);
create index if not exists clockify_entries_project_started_idx
  on clockify_entries (clockify_project_id, started_at desc);
create index if not exists clockify_entries_started_idx
  on clockify_entries (started_at desc);

-- Sync watermark / health, one row per resource ('users' | 'projects' | 'entries').
create table if not exists clockify_sync_state (
  resource     text primary key,
  cursor_ts    timestamptz,
  last_run_at  timestamptz,
  last_status  text,
  last_error   text
);
