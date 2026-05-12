-- WA Cockpit — F4: follow-ups (recordatorios programados por chat)

create table if not exists wa_followups (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null references wa_conversations (chat_id) on delete cascade,
  due_at timestamptz not null,
  kind text not null,                       -- remind_24h | remind_48h | manual | quoted_no_reply
  status text not null default 'pending',   -- pending | done | cancelled
  created_at timestamptz not null default now(),
  done_at timestamptz,
  note text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists wa_followups_due_idx on wa_followups (status, due_at) where status = 'pending';
create index if not exists wa_followups_chat_idx on wa_followups (chat_id, due_at desc);
