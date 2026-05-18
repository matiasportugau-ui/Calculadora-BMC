-- ═══════════════════════════════════════════════════════════════════════════
-- identity schema — Tareas (Tasks) module
-- ───────────────────────────────────────────────────────────────────────────
-- Purpose: Google Tasks OAuth + sync + local task list storage + conflict mgmt
--
-- Companion docs: docs/hub-tasks-module/
--
-- Tables:
--   1. identity.tasks — local task list + item storage (synced from Google Tasks)
--   2. identity.sync_conflicts — CRD conflict log (for manual resolution)
--   3. identity.tasks_oauth_tokens — Google Tasks OAuth tokens + state
-- ═══════════════════════════════════════════════════════════════════════════

-- Tasks table: local representation of Google Tasks (lists + items)
create table if not exists identity.tasks (
  task_id                uuid primary key default uuid_generate_v4(),
  user_id                uuid not null references identity.users(user_id) on delete cascade,
  google_task_id         text,                          -- external Google Tasks ID (nullable for local-only items)
  google_list_id         text,                          -- parent list ID from Google Tasks
  parent_task_id         uuid references identity.tasks(task_id) on delete set null,
  title                  text not null,
  description            text,
  due_date               date,                          -- RFC 3339 date part
  completed_at           timestamptz,                   -- null = not completed
  status                 text not null default 'needsAction',  -- 'needsAction'|'completed'
  is_list                boolean not null default false, -- true = this is a list container
  position               integer,                       -- order within parent list
  etag                   text,                          -- Google Tasks ETag for optimistic concurrency
  sync_token             text,                          -- Google Tasks syncToken for incremental pull
  last_synced_at         timestamptz,
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on identity.tasks(user_id);
create index if not exists tasks_user_list_idx on identity.tasks(user_id, google_list_id);
create index if not exists tasks_updated_at_idx on identity.tasks(updated_at);
create index if not exists tasks_google_id_idx on identity.tasks(google_task_id);
create index if not exists tasks_parent_idx on identity.tasks(parent_task_id);

drop trigger if exists tasks_touch on identity.tasks;
create trigger tasks_touch before update on identity.tasks
  for each row execute function identity.touch_updated_at();

-- Sync conflict log: tracks concurrent modifications that need manual resolution
create table if not exists identity.sync_conflicts (
  conflict_id            uuid primary key default uuid_generate_v4(),
  user_id                uuid not null references identity.users(user_id) on delete cascade,
  task_id                uuid references identity.tasks(task_id) on delete cascade,
  google_task_id         text,
  local_version          jsonb,                         -- snapshot of local state
  remote_version         jsonb,                         -- snapshot of Google Tasks state
  conflict_type          text not null,                 -- 'deleted_locally_modified_remotely' | 'modified_both' | 'other'
  resolved_at            timestamptz,
  resolution_choice      text,                          -- 'keep_local' | 'keep_remote' | 'manual'
  resolved_by            uuid references identity.users(user_id) on delete set null,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists sync_conflicts_user_idx on identity.sync_conflicts(user_id);
create index if not exists sync_conflicts_task_idx on identity.sync_conflicts(task_id);
create index if not exists sync_conflicts_resolved_idx on identity.sync_conflicts(resolved_at);

drop trigger if exists sync_conflicts_touch on identity.sync_conflicts;
create trigger sync_conflicts_touch before update on identity.sync_conflicts
  for each row execute function identity.touch_updated_at();

-- OAuth tokens for Google Tasks API (separate from identity.sessions)
create table if not exists identity.tasks_oauth_tokens (
  token_id               uuid primary key default uuid_generate_v4(),
  user_id                uuid not null references identity.users(user_id) on delete cascade unique,
  access_token           text not null,                 -- encrypted in practice (not stored plain)
  refresh_token          text,                          -- may be null if offline_access not granted
  token_type             text not null default 'Bearer',
  expires_at             timestamptz not null,
  scope                  text,                          -- space-separated OAuth scopes granted
  state                  text,                          -- PKCE state value for auth flow
  code_verifier          text,                          -- PKCE code_verifier (store for exchange)
  provider               text not null default 'google', -- 'google' | future providers
  revoked_at             timestamptz,                   -- non-null = token revoked
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists tasks_oauth_user_idx on identity.tasks_oauth_tokens(user_id);
create index if not exists tasks_oauth_updated_idx on identity.tasks_oauth_tokens(updated_at);

drop trigger if exists tasks_oauth_touch on identity.tasks_oauth_tokens;
create trigger tasks_oauth_touch before update on identity.tasks_oauth_tokens
  for each row execute function identity.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- Seed: Add "tareas" module to identity.modules
-- ───────────────────────────────────────────────────────────────────────────
insert into identity.modules (module, display_name, category)
values ('tareas', 'Tareas', 'productivity')
on conflict(module) do nothing;
