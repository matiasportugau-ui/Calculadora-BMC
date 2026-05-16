-- One running entry per user enforced via partial unique index. The
-- invoice_line_id column is referenced before the table exists (Sprint 3
-- migration 008 creates tk_invoice_lines). We store it as a plain uuid here
-- and add the FK in migration 008 — Postgres tolerates this because the
-- column type matches the future PK.
create table if not exists tk_entries (
  entry_id          uuid primary key default gen_random_uuid(),
  user_id           uuid not null,
  project_id        uuid not null references tk_projects(project_id) on delete restrict,
  task_id           uuid references tk_tasks(task_id) on delete set null,
  description       text not null default '',
  started_at        timestamptz not null,
  stopped_at        timestamptz,
  duration_seconds  integer generated always as (
    case when stopped_at is null then null
         else greatest(0, extract(epoch from (stopped_at - started_at))::integer)
    end
  ) stored,
  billable          boolean not null default true,
  tags              text[] not null default '{}',
  invoice_line_id   uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists tk_entries_user_started_idx on tk_entries (user_id, started_at desc);
create index if not exists tk_entries_project_started_idx on tk_entries (project_id, started_at desc);
create index if not exists tk_entries_unbilled_idx
  on tk_entries (project_id, started_at) where invoice_line_id is null and billable;

-- At most one running (stopped_at is null) entry per user.
create unique index if not exists tk_entries_one_running_per_user_idx
  on tk_entries (user_id) where stopped_at is null;
