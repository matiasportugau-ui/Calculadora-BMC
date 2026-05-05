-- WA Cockpit — F1: messages table (idempotent by msg_id)

create table if not exists wa_messages (
  msg_id text primary key,
  chat_id text not null references wa_conversations (chat_id) on delete cascade,
  ts timestamptz not null,
  direction text not null check (direction in ('in', 'out')),
  type text not null default 'text',
  text text,
  reply_to text,
  source text not null default 'wa_web',
  status text,
  raw jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  enriched_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wa_messages_chat_ts_idx on wa_messages (chat_id, ts desc);
create index if not exists wa_messages_enriched_idx on wa_messages (enriched_at) where enriched_at is null;
create index if not exists wa_messages_direction_ts_idx on wa_messages (direction, ts desc);
