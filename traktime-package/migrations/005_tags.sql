create table if not exists tk_tags (
  tag_id     uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color_hex  text not null default '#8e8e93',
  created_at timestamptz not null default now()
);
