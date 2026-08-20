-- Eval-phase tenant agent transcripts + token/cost estimates (BMC admin only).
-- Additive / idempotent. Do not mix slugs.

create table if not exists identity.tenant_agent_conversations (
  conversation_id     uuid primary key,
  tenant_slug         text not null,
  agent_name          text not null,
  user_id             uuid,
  user_email          text,
  provider            text,
  model               text,
  started_at          timestamptz not null default now(),
  last_at             timestamptz not null default now(),
  turn_count          integer not null default 0,
  input_tokens        bigint not null default 0,
  output_tokens       bigint not null default 0,
  estimated_cost_usd  numeric(12,6) not null default 0,
  constraint tenant_agent_conversations_slug_check
    check (tenant_slug in ('bc', 'paneleslam', 'smartbuilding'))
);

create index if not exists tenant_agent_conversations_slug_last_idx
  on identity.tenant_agent_conversations (tenant_slug, last_at desc);

create table if not exists identity.tenant_agent_turns (
  turn_id             bigserial primary key,
  conversation_id     uuid not null
    references identity.tenant_agent_conversations(conversation_id) on delete cascade,
  turn_index          integer not null,
  role                text not null,
  content             text not null default '',
  provider            text,
  model               text,
  input_tokens        integer not null default 0,
  output_tokens       integer not null default 0,
  estimated_cost_usd  numeric(12,6) not null default 0,
  latency_ms          integer,
  at                  timestamptz not null default now(),
  constraint tenant_agent_turns_role_check check (role in ('user', 'assistant')),
  constraint tenant_agent_turns_unique unique (conversation_id, turn_index)
);

create index if not exists tenant_agent_turns_conv_idx
  on identity.tenant_agent_turns (conversation_id, turn_index);

comment on table identity.tenant_agent_conversations is
  'Eval: full tenant chat sessions (JenIA/MonkIA/Basuuuu IA). BMC admin only.';
comment on table identity.tenant_agent_turns is
  'Eval: full visible transcript turns + per-turn token/cost estimates.';
