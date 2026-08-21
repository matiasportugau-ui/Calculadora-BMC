-- Customer purchase observability (tokenized public track links)
create table if not exists customer_track_tokens (
  token_id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  trip_id uuid null references trips (trip_id) on delete set null,
  stop_id uuid null,
  quote_ref text null,
  public_snapshot jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists customer_track_tokens_hash_idx
  on customer_track_tokens (token_hash);

create index if not exists customer_track_tokens_trip_idx
  on customer_track_tokens (trip_id);
