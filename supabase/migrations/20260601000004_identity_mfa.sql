-- ═══════════════════════════════════════════════════════════════════════════
-- identity — TOTP MFA tables and per-user mfa_required flag
-- ───────────────────────────────────────────────────────────────────────────
-- Project: Calculadora-BMC
-- Purpose: introduce the persistence layer for time-based one-time-password
-- (TOTP) MFA. This migration only creates the tables and a per-user flag; it
-- does NOT enable enforcement (no backfill of mfa_required). Enforcement is
-- opt-in per user via /auth/mfa/enroll → /auth/mfa/verify, and a later
-- migration will flip mfa_required on selected users once the challenge UI
-- ships, so this migration alone cannot lock anyone out.
--
-- Schema:
--   identity.mfa_secrets       — one row per enrolled user
--     user_id              pk, fk → identity.users(user_id) on delete cascade
--     totp_secret_encrypted bytea not null  (AES-256-GCM via MFA_KEK)
--     enabled_at           null until POST /auth/mfa/verify completes once
--     last_used_at         updated on every successful verify
--     created_at, updated_at  housekeeping
--
--   identity.users.mfa_required  boolean default false
--     true → server-side login flow requires a verified MFA challenge before
--     minting a full access JWT (integration ships in a follow-up PR).
--
-- Idempotency: every DDL uses `if not exists`; column add uses `add column if
-- not exists`; safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

create table if not exists identity.mfa_secrets (
  user_id              uuid primary key references identity.users(user_id) on delete cascade,
  totp_secret_encrypted bytea not null,
  enabled_at           timestamptz,
  last_used_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists mfa_secrets_enabled_idx
  on identity.mfa_secrets(enabled_at)
  where enabled_at is not null;

drop trigger if exists mfa_secrets_touch on identity.mfa_secrets;
create trigger mfa_secrets_touch before update on identity.mfa_secrets
  for each row execute function identity.touch_updated_at();

alter table identity.users
  add column if not exists mfa_required boolean not null default false;

create index if not exists users_mfa_required_idx
  on identity.users(mfa_required)
  where mfa_required = true;

-- RLS: same defensive posture as the rest of the identity schema.
alter table identity.mfa_secrets enable row level security;
drop policy if exists "service_role_all_mfa_secrets" on identity.mfa_secrets;
create policy "service_role_all_mfa_secrets" on identity.mfa_secrets
  for all to service_role using (true) with check (true);
