-- WA Cockpit — F5: heartbeat de extensión por operador

create table if not exists wa_heartbeats (
  operator_id text not null,
  last_seen_at timestamptz not null default now(),
  version text,
  last_msg_seen text,
  meta jsonb not null default '{}'::jsonb,
  primary key (operator_id)
);

create index if not exists wa_heartbeats_last_seen_idx on wa_heartbeats (last_seen_at desc);
