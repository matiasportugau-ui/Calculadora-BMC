-- WA Cockpit — F2: AI suggestions per chat (3 options: corta / técnica / cierre)

create table if not exists wa_suggestions (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null references wa_conversations (chat_id) on delete cascade,
  trigger_msg_id text references wa_messages (msg_id) on delete set null,
  generated_at timestamptz not null default now(),
  intent text,
  options jsonb not null default '[]'::jsonb,
  -- options shape: [{ tone: "corta"|"tecnica"|"cierre", text: "...", confidence: 0..1 }]
  chosen_idx int,
  chosen_at timestamptz,
  sent_msg_id text,
  provider text,
  model text,
  latency_ms int,
  error text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists wa_suggestions_chat_id_idx on wa_suggestions (chat_id, generated_at desc);
create index if not exists wa_suggestions_chosen_idx on wa_suggestions (chosen_idx) where chosen_idx is not null;
create index if not exists wa_suggestions_pending_idx on wa_suggestions (generated_at desc) where chosen_idx is null;
