-- EXPORT_SEAL
create table if not exists driver_sessions (
  session_id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (trip_id) on delete cascade,
  driver_id uuid not null,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists driver_sessions_trip_driver_idx
  on driver_sessions (trip_id, driver_id);

create index if not exists driver_sessions_token_hash_idx
  on driver_sessions (token_hash);
