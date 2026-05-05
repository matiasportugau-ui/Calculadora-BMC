-- WA Cockpit — F1: conversations table
-- Source of truth for runtime/operativo (Postgres). CRM_Operativo Sheet remains commercial truth.

create extension if not exists pgcrypto;

create table if not exists wa_conversations (
  chat_id text primary key,
  phone text,
  contact_name text,
  last_msg_at timestamptz,
  last_msg_in_at timestamptz,
  last_msg_out_at timestamptz,
  status text not null default 'new',
  intent_last text,
  owner_op text,
  lead_sheet_row int,
  unread_count int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wa_conversations_status_idx on wa_conversations (status);
create index if not exists wa_conversations_phone_idx on wa_conversations (phone);
create index if not exists wa_conversations_last_msg_at_idx on wa_conversations (last_msg_at desc nulls last);
