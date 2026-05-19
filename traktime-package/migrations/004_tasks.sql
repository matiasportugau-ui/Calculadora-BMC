create table if not exists tk_tasks (
  task_id     uuid primary key default gen_random_uuid(),
  project_id  uuid not null references tk_projects(project_id) on delete cascade,
  name        text not null,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists tk_tasks_project_idx on tk_tasks (project_id);
