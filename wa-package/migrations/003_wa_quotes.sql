-- WA Cockpit — F3: quotes generated from chat (auto by AI or manual by op)

create table if not exists wa_quotes (
  quote_id uuid primary key default gen_random_uuid(),
  chat_id text not null references wa_conversations (chat_id) on delete cascade,
  trigger_msg_id text references wa_messages (msg_id) on delete set null,
  generated_at timestamptz not null default now(),
  generated_by_ai boolean not null default false,
  -- detected/asked params (jsonb so we don't need a migration each time)
  params jsonb not null default '{}'::jsonb,
  -- calc result snapshot (USD totals + bom summary)
  total_usd numeric,
  total_iva_usd numeric,
  bom_summary jsonb,
  -- link público al PDF / preview (col AH del Sheet)
  link text,
  status text not null default 'draft',  -- draft|sent|won|lost|stale
  sheet_row int,                          -- fila CRM_Operativo donde se grabó (col AH)
  meta jsonb not null default '{}'::jsonb
);

create index if not exists wa_quotes_chat_id_idx on wa_quotes (chat_id, generated_at desc);
create index if not exists wa_quotes_status_idx on wa_quotes (status);
create index if not exists wa_quotes_sheet_row_idx on wa_quotes (sheet_row) where sheet_row is not null;
