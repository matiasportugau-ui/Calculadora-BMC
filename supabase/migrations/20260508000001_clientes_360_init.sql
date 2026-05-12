-- ═══════════════════════════════════════════════════════════════════════════
-- clientes schema — Panel de Clientes 360 (Phase 1 init)
-- ───────────────────────────────────────────────────────────────────────────
-- Project: Calculadora-BMC
-- Purpose: unified customer view across channels (calculadora, wa, ml, shopify,
-- sheets, email, fb, ig, calls, visits) + scoring + automation + agent jobs.
--
-- Companion: docs/clientes-360/FEATURE-BRIEF-v2.md (sec 4.2)
-- Mapping:   docs/clientes-360/EXISTING-CRM-MAPPING.md
--
-- Schema isolation:
--   - All tables under `clientes` schema (no collision with identity/wa/bmc_*).
--   - clientes.customer_quotes references identity.quotes via FK (logical).
--   - clientes.customer_followups assigned_to_user_id FKs identity.users.
--   - clientes.customer_aliases.created_by FKs identity.users.
--
-- Apply order: AFTER 20260601000001_identity_init.sql (FKs require identity).
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create schema if not exists clientes;

-- Auto-touch helper used by triggers on tables with updated_at column.
create or replace function clientes.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- customers — master record (1 per resolved person/business)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists clientes.customers (
  id                      uuid primary key default uuid_generate_v4(),
  display_name            text not null,
  rut                     text,                          -- digits only, normalized
  primary_phone_e164      text,                          -- E.164 without '+'
  primary_email           text,                          -- lowercased + trimmed
  channels                text[] not null default '{}',  -- active channels
  first_seen_at           timestamptz not null default now(),
  last_contact_at         timestamptz,
  notes                   text,
  metadata                jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists customers_phone_idx        on clientes.customers (primary_phone_e164) where primary_phone_e164 is not null;
create index if not exists customers_email_idx        on clientes.customers (primary_email)      where primary_email is not null;
create index if not exists customers_rut_idx          on clientes.customers (rut)                where rut is not null;
create index if not exists customers_last_contact_idx on clientes.customers (last_contact_at desc nulls last);

drop trigger if exists customers_touch on clientes.customers;
create trigger customers_touch before update on clientes.customers
  for each row execute function clientes.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- customer_identities — 1:N external IDs per customer per channel
-- (replaces v1's flat external_ids jsonb)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists clientes.customer_identities (
  id          uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references clientes.customers(id) on delete cascade,
  channel     text not null,                     -- 'sheets'|'calculadora'|'identity'|'ml'|'shopify'|'wa'|'email'
  external_id text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (channel, external_id)
);

create index if not exists customer_identities_customer_idx on clientes.customer_identities (customer_id);

-- ───────────────────────────────────────────────────────────────────────────
-- customer_field_provenance — audit of which source provided which field
-- (resolves "who won" when sources conflict; gap of v1 brief)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists clientes.customer_field_provenance (
  customer_id    uuid not null references clientes.customers(id) on delete cascade,
  field          text not null,                  -- 'display_name'|'rut'|'primary_phone_e164'|'primary_email'|...
  source_channel text not null,
  source_ref     text,
  source_value   text,
  observed_at    timestamptz not null default now(),
  primary key (customer_id, field, source_channel, observed_at)
);

create index if not exists customer_field_prov_customer_idx on clientes.customer_field_provenance (customer_id, field);

-- ───────────────────────────────────────────────────────────────────────────
-- customer_events — unified timeline (partitioned by month)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists clientes.customer_events (
  id          uuid not null default uuid_generate_v4(),
  customer_id uuid not null references clientes.customers(id) on delete cascade,
  channel     text not null,                     -- 'wa'|'calculadora'|'ml'|'shopify'|'email'|'fb'|'ig'|'call'|'visit'
  event_type  text not null,                     -- 'message'|'quote'|'purchase'|'visit'|'call'|'login'|'status_change'|'sla_breach'
  payload     jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  source_ref  text not null,                     -- ingestor must provide a stable per-channel ref (deterministic when source has no native ID); NOT NULL so UNIQUE actually enforces idempotency (Postgres allows multiple NULLs in UNIQUE otherwise)
  ingested_at timestamptz not null default now(),
  primary key (id, occurred_at),
  unique (channel, source_ref, occurred_at)      -- includes occurred_at because partition key must be in unique
)
partition by range (occurred_at);

create index if not exists customer_events_customer_idx on clientes.customer_events (customer_id, occurred_at desc);
create index if not exists customer_events_channel_idx  on clientes.customer_events (channel, occurred_at desc);

-- Bootstrap partitions: previous, current, next month so live writes land safely.
-- agent-partition-rollover (Cloud Run Job) creates future ones monthly.
create table if not exists clientes.customer_events_2026_04 partition of clientes.customer_events
  for values from ('2026-04-01') to ('2026-05-01');
create table if not exists clientes.customer_events_2026_05 partition of clientes.customer_events
  for values from ('2026-05-01') to ('2026-06-01');
create table if not exists clientes.customer_events_2026_06 partition of clientes.customer_events
  for values from ('2026-06-01') to ('2026-07-01');

-- ───────────────────────────────────────────────────────────────────────────
-- customer_quotes — link to identity.quotes + commercial status
-- (NO duplicates pdf_url/wizard_payload; those live in identity.quotes)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists clientes.customer_quotes (
  customer_id  uuid not null references clientes.customers(id) on delete cascade,
  quote_id     text not null,                    -- logical FK to identity.quotes.quote_id
  scenario     text not null,                    -- solo_techo|techo_fachada|solo_fachada|camara_frig
  total_amount numeric(12,2) not null,
  currency     text not null default 'USD',
  status       text not null default 'pending',  -- pending|won|lost|expired
  created_at   timestamptz not null,
  closed_at    timestamptz,
  primary key (customer_id, quote_id)
);

create index if not exists customer_quotes_status_idx on clientes.customer_quotes (status, created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- customer_purchases — orders from Shopify, ML, or direct
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists clientes.customer_purchases (
  id           uuid primary key default uuid_generate_v4(),
  customer_id  uuid not null references clientes.customers(id) on delete cascade,
  channel      text not null,                    -- 'shopify'|'ml'|'direct'
  order_ref    text not null,
  products     jsonb not null default '[]'::jsonb,
  total_amount numeric(12,2) not null,
  currency     text not null default 'USD',
  occurred_at  timestamptz not null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (channel, order_ref)
);

create index if not exists customer_purchases_customer_idx on clientes.customer_purchases (customer_id, occurred_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- customer_scores — denormalized scoring snapshot (Phase 1: 5 factors)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists clientes.customer_scores (
  customer_id        uuid primary key references clientes.customers(id) on delete cascade,
  -- Phase 1 factors (5):
  volume_score       smallint,                   -- 0-100
  recency_score      smallint,
  frequency_score    smallint,
  conversion_score   smallint,
  tenure_score       smallint,
  -- Phase 2 factors (3):
  count_score        smallint,
  expansion_score    smallint,
  risk_inverse_score smallint,
  -- Aggregate:
  global_score       smallint not null default 0, -- 0-100, weighted average
  -- Rankings (positions, 1-based):
  rank_volume        int,
  rank_frequency     int,
  rank_count         int,
  rank_products      int,
  rank_tenure        int,
  rank_active_years  int,
  rank_global        int,
  computed_at        timestamptz not null default now()
);

create index if not exists customer_scores_global_idx   on clientes.customer_scores (global_score desc);
create index if not exists customer_scores_computed_idx on clientes.customer_scores (computed_at);

-- ───────────────────────────────────────────────────────────────────────────
-- customer_followups — replaces .followup/store.json
-- (legacy followups.js route migrates here; see docs/clientes-360 sec 9.5)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists clientes.customer_followups (
  id                  uuid primary key default uuid_generate_v4(),
  customer_id         uuid references clientes.customers(id) on delete cascade,
  due_date            date not null,
  reason              text not null,
  detail              text,
  tags                text[] not null default '{}',
  rule_triggered      text,                      -- automation_rules.id; NULL when manual
  status              text not null default 'pending', -- pending|done|dismissed
  assigned_to_user_id uuid references identity.users(user_id),
  legacy_id           text,                      -- followUpStore.json items[].id (for migration audit)
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index if not exists customer_followups_due_idx       on clientes.customer_followups (status, due_date) where status = 'pending';
create index if not exists customer_followups_assigned_idx  on clientes.customer_followups (assigned_to_user_id, due_date);
create index if not exists customer_followups_customer_idx  on clientes.customer_followups (customer_id, due_date);

-- ───────────────────────────────────────────────────────────────────────────
-- automation_rules — DSL JSON evaluated by agent-automation
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists clientes.automation_rules (
  id          text primary key,                  -- 'vip-no-compra-90d', etc.
  name        text not null,
  enabled     boolean not null default true,
  when_dsl    jsonb not null,                    -- {"global_score":">= 80","days_since_last_purchase":">= 90"}
  then_dsl    jsonb not null,                    -- {"create_followup":{...}}
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists automation_rules_touch on clientes.automation_rules;
create trigger automation_rules_touch before update on clientes.automation_rules
  for each row execute function clientes.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- customer_aliases — manual override of agent-resolver matches
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists clientes.customer_aliases (
  id          uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references clientes.customers(id) on delete cascade,
  channel     text not null,
  external_id text not null,
  created_by  uuid references identity.users(user_id),
  reason      text,                              -- 'manual_merge'|'split_correction'|'manual_review'
  created_at  timestamptz not null default now(),
  unique (channel, external_id)
);

create index if not exists customer_aliases_customer_idx on clientes.customer_aliases (customer_id);

-- ───────────────────────────────────────────────────────────────────────────
-- agent_jobs — internal queue for ETL / resolver / scoring agents
-- (uses Postgres advisory locks pattern, no Cloud Tasks dependency)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists clientes.agent_jobs (
  id             uuid primary key default uuid_generate_v4(),
  agent          text not null,                  -- 'sync-sheets'|'resolver'|'scoring'|...
  payload        jsonb not null default '{}'::jsonb,
  status         text not null default 'queued', -- queued|running|done|failed
  attempts       int not null default 0,
  max_attempts   int not null default 3,
  scheduled_for  timestamptz not null default now(),
  locked_by      text,                           -- pod/run id holding the lock
  locked_until   timestamptz,
  error          text,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);

create index if not exists agent_jobs_pending_idx
  on clientes.agent_jobs (scheduled_for) where status = 'queued';
create index if not exists agent_jobs_agent_idx
  on clientes.agent_jobs (agent, status);

-- ───────────────────────────────────────────────────────────────────────────
-- agent_runs — telemetry / debugging of agent executions
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists clientes.agent_runs (
  id          uuid primary key default uuid_generate_v4(),
  agent       text not null,
  job_id      uuid references clientes.agent_jobs(id),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running',   -- running|ok|error
  error       text,
  metrics     jsonb not null default '{}'::jsonb -- {events_ingested, customers_resolved, ...}
);

create index if not exists agent_runs_recent_idx on clientes.agent_runs (agent, started_at desc);
create index if not exists agent_runs_status_idx on clientes.agent_runs (status, started_at desc) where status = 'error';

-- ═══════════════════════════════════════════════════════════════════════════
-- End of 20260508000001_clientes_360_init.sql
-- ═══════════════════════════════════════════════════════════════════════════
