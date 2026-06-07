-- user_id intentionally has NO FK to identity.users (cross-schema FKs are
-- clunky and the source of truth for user existence is requireUser()).
create table if not exists tk_project_members (
  project_id  uuid not null references tk_projects(project_id) on delete cascade,
  user_id     uuid not null,
  role        text not null default 'member' check (role in ('admin', 'member')),
  added_at    timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists tk_project_members_user_idx on tk_project_members (user_id);
