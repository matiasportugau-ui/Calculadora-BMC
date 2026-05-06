-- ═══════════════════════════════════════════════════════════════════════════
-- identity schema — Comprador identity, RBAC, sessions, quotes, CRM personal
-- ───────────────────────────────────────────────────────────────────────────
-- Project: Calculadora-BMC (htnwozvopveibwppyjhg)
-- Purpose: end-user identity (Google OAuth) + RBAC + per-user quote history +
-- Wolfboard module grants + access requests + special-quote requests +
-- in-app notifications + CRM personal Plus + audit log.
--
-- Companion runbook: docs/master-plans/user-identity-execution-runbook.md
-- Master plan:        docs/master-plans/user-identity-master-plan.md
--
-- All tables live under the `identity` schema so they don't collide with the
-- `bmc_price_monitor` and `wa_*` subsystems already in this Supabase project.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";
create extension if not exists citext;

create schema if not exists identity;

-- Auto-touch helper used by triggers on tables with updated_at column
create or replace function identity.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- users — Comprador / operator / admin / superadmin
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.users (
  user_id              uuid primary key default uuid_generate_v4(),
  google_sub           text unique,
  email                citext unique not null,
  email_verified       boolean not null default false,
  name                 text,
  picture_url          text,
  avatar_preset        text,                          -- 'comercial'|'residencial'|'constructor'|'barraca'|null
  user_type            text,                          -- free-form: 'comprador'|'instalador'|'arquitecto'|...
  plan_tier            text not null default 'base',  -- 'base'|'plus'
  status               text not null default 'active',-- 'active'|'suspended'|'deleted'
  consent_terms_at     timestamptz,
  consent_marketing_at timestamptz,
  jwt_revoked_at       timestamptz,                   -- bump to invalidate all access JWTs
  last_login_at        timestamptz,
  last_active_at       timestamptz,
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists users_google_sub_idx on identity.users(google_sub);
create index if not exists users_email_idx      on identity.users(email);
create index if not exists users_plan_tier_idx  on identity.users(plan_tier);

drop trigger if exists users_touch on identity.users;
create trigger users_touch before update on identity.users
  for each row execute function identity.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- sessions — refresh-token rotation with reuse detection
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.sessions (
  session_id              uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references identity.users(user_id) on delete cascade,
  refresh_token_hash      text not null,                -- sha256(refreshToken)
  refresh_expires_at      timestamptz not null,
  ip                      text,
  user_agent              text,
  rotated_from_session_id uuid references identity.sessions(session_id) on delete set null,
  revoked_at              timestamptz,                  -- non-null = invalid
  created_at              timestamptz not null default now()
);

create index if not exists sessions_user_active_idx
  on identity.sessions(user_id, refresh_expires_at)
  where revoked_at is null;

create index if not exists sessions_hash_idx on identity.sessions(refresh_token_hash);

-- ───────────────────────────────────────────────────────────────────────────
-- modules — catalog of Wolfboard modules a user can have access to
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.modules (
  module       text primary key,
  display_name text not null,
  category     text,
  created_at   timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- role_grants — coarse role per user (multiple roles allowed)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.role_grants (
  user_id    uuid not null references identity.users(user_id) on delete cascade,
  role       text not null,                   -- 'comprador'|'operator'|'admin'|'superadmin'
  granted_by uuid references identity.users(user_id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists role_grants_role_idx on identity.role_grants(role);

-- ───────────────────────────────────────────────────────────────────────────
-- module_grants — fine-grained per-module level (overrides role defaults)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.module_grants (
  user_id    uuid not null references identity.users(user_id) on delete cascade,
  module     text not null references identity.modules(module) on delete cascade,
  level      text not null default 'read',    -- 'none'|'read'|'write'|'admin'
  granted_by uuid references identity.users(user_id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, module)
);

-- ───────────────────────────────────────────────────────────────────────────
-- access_requests — user requests access to a module (greyed card → ticket)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.access_requests (
  request_id   uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references identity.users(user_id) on delete cascade,
  module       text not null references identity.modules(module) on delete cascade,
  status       text not null default 'pending',  -- 'pending'|'granted'|'denied'
  resolved_by  uuid references identity.users(user_id) on delete set null,
  resolved_at  timestamptz,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists access_requests_pending_idx
  on identity.access_requests(created_at desc)
  where status = 'pending';

-- ───────────────────────────────────────────────────────────────────────────
-- quotes — per-user quote history (replaces in-memory quotationRegistry)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.quotes (
  quote_id         uuid primary key default uuid_generate_v4(),
  user_id          uuid references identity.users(user_id) on delete set null,
  client_quote_id  text,                                     -- anonymous → user merge key
  payload          jsonb not null,
  total_usd        numeric(12,2),
  total_uyu        numeric(14,2),
  pdf_id           text,
  pdf_url          text,
  gcs_uri          text,
  drive_file_id    text,
  wizard_step      int,
  status           text not null default 'draft',           -- 'draft'|'completed'|'exported'|'deleted'
  sheet_synced_at  timestamptz,
  sheet_row_id     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists quotes_user_recent_idx
  on identity.quotes(user_id, created_at desc)
  where status <> 'deleted';

create index if not exists quotes_client_idx on identity.quotes(client_quote_id);

create index if not exists quotes_unsynced_idx
  on identity.quotes(created_at)
  where sheet_synced_at is null and status = 'completed';

drop trigger if exists quotes_touch on identity.quotes;
create trigger quotes_touch before update on identity.quotes
  for each row execute function identity.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- quote_events — append-only audit per quote
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.quote_events (
  event_id       bigserial primary key,
  quote_id       uuid not null references identity.quotes(quote_id) on delete cascade,
  kind           text not null,                          -- 'created'|'updated'|'completed'|'exported_csv'|'exported_pdf'|'sheet_pushed'|'deleted'
  actor_user_id  uuid references identity.users(user_id) on delete set null,
  payload        jsonb not null default '{}'::jsonb,
  at             timestamptz not null default now()
);

create index if not exists quote_events_quote_idx
  on identity.quote_events(quote_id, at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- special_quote_requests — total_usd > 8500 follow-up tickets
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.special_quote_requests (
  request_id   uuid primary key default uuid_generate_v4(),
  quote_id     uuid not null references identity.quotes(quote_id) on delete cascade,
  user_id      uuid not null references identity.users(user_id) on delete cascade,
  notes        text,
  status       text not null default 'open',              -- 'open'|'in_progress'|'closed'
  resolved_by  uuid references identity.users(user_id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists special_quote_open_idx
  on identity.special_quote_requests(created_at desc)
  where status <> 'closed';

-- ───────────────────────────────────────────────────────────────────────────
-- notifications — in-app inbox per user
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.notifications (
  notification_id  uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references identity.users(user_id) on delete cascade,
  kind             text not null,                          -- 'access_request'|'special_quote'|'system'|'promo'|'sync_failure'
  title            text not null,
  body             text,
  payload          jsonb not null default '{}'::jsonb,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists notifications_unread_idx
  on identity.notifications(user_id, created_at desc)
  where read_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- crm_personal_contacts — Plus tier only (UI greys for base)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.crm_personal_contacts (
  contact_id   uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references identity.users(user_id) on delete cascade,
  display_name text not null,
  email        citext,
  phone        text,
  company      text,
  notes        text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists crm_contacts_user_idx
  on identity.crm_personal_contacts(user_id, created_at desc);

drop trigger if exists crm_contacts_touch on identity.crm_personal_contacts;
create trigger crm_contacts_touch before update on identity.crm_personal_contacts
  for each row execute function identity.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- crm_personal_leads — Plus tier opportunity pipeline
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.crm_personal_leads (
  lead_id      uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references identity.users(user_id) on delete cascade,
  contact_id   uuid references identity.crm_personal_contacts(contact_id) on delete set null,
  quote_id     uuid references identity.quotes(quote_id) on delete set null,
  title        text not null,
  stage        text not null default 'new',     -- 'new'|'qualified'|'proposal'|'won'|'lost'
  value_usd    numeric(12,2),
  notes        text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists crm_leads_user_stage_idx
  on identity.crm_personal_leads(user_id, stage);

drop trigger if exists crm_leads_touch on identity.crm_personal_leads;
create trigger crm_leads_touch before update on identity.crm_personal_leads
  for each row execute function identity.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- audit_log — security/admin actions audit trail
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists identity.audit_log (
  audit_id      bigserial primary key,
  actor_user_id uuid references identity.users(user_id) on delete set null,
  actor_kind    text not null default 'user',         -- 'user'|'service'|'system'
  action        text not null,                        -- 'login'|'logout'|'token_reuse_detected'|'role_grant'|'sync_run'|...
  resource      text,                                 -- 'users'|'quotes'|'sheets:base_clientes'|...
  resource_id   text,
  ip            text,
  user_agent    text,
  payload       jsonb not null default '{}'::jsonb,
  at            timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on identity.audit_log(actor_user_id, at desc);
create index if not exists audit_log_action_idx on identity.audit_log(action, at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ───────────────────────────────────────────────────────────────────────────
-- Comprador identity is enforced at the API tier (identityAuth.requireUser).
-- RLS is enabled defensively: service_role full access; authenticated has no
-- direct access (clients hit our REST API, never the DB directly).
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'users','sessions','modules','role_grants','module_grants',
      'access_requests','quotes','quote_events','special_quote_requests',
      'notifications','crm_personal_contacts','crm_personal_leads','audit_log'])
  loop
    execute format('alter table identity.%I enable row level security', t);
    execute format(
      'drop policy if exists "service_role_all_%I" on identity.%I', t, t);
    execute format(
      'create policy "service_role_all_%I" on identity.%I
         for all to service_role using (true) with check (true)', t, t);
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Seed: module catalog (8 known Wolfboard modules)
-- ───────────────────────────────────────────────────────────────────────────
insert into identity.modules (module, display_name, category) values
  ('calc',         'Calculadora Panelin',  'core'),
  ('wa',           'WhatsApp Cockpit',     'comms'),
  ('ml',           'Mercado Libre',        'sales'),
  ('admin',        'Administración',       'admin'),
  ('plan-import',  'Plan Import (AI)',     'tools'),
  ('agent-admin',  'Agent Admin',          'tools'),
  ('canales',      'Canales',              'comms'),
  ('crm-personal', 'CRM Personal (Plus)',  'crm')
on conflict (module) do nothing;
