-- EXPORT_SEAL
create table if not exists trip_events (
  event_id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (trip_id) on delete cascade,
  stop_id uuid null,
  event_type text not null,
  actor_type text not null,
  actor_id uuid null,
  idempotency_key text not null,
  at_client_ms bigint null,
  at_server timestamptz not null default now(),
  geo_lat double precision null,
  geo_lng double precision null,
  payload jsonb not null default '{}'::jsonb
);

create unique index if not exists trip_events_trip_id_idem_uq
  on trip_events (trip_id, idempotency_key);

create index if not exists trip_events_trip_id_server_time_idx
  on trip_events (trip_id, at_server desc);
