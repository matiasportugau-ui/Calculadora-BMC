-- EXPORT_SEAL
create table if not exists outbox_notifications (
  notification_id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (trip_id) on delete cascade,
  driver_id uuid not null,
  channel text not null,
  to_e164 text not null,
  payload jsonb not null,
  status text not null default 'pending',
  attempt_count int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error_code text null,
  last_error jsonb null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null
);

create index if not exists outbox_notifications_pending_idx
  on outbox_notifications (status, next_attempt_at);
