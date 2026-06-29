-- 009_email_manager_multi.sql
-- Email Operations Manager — Phase 1: multi-account + multi-user core.
--
-- WHY: the Omni inbox is shared and single-account-blind. To run as a real email
-- manager across many BMC mailboxes and many operators we need three things the
-- schema lacks: (1) a registry of receiving email accounts, (2) teams + membership,
-- and (3) per-conversation account/owner/team columns. This migration is additive
-- and fully idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), so
-- it is safe to re-run and safe to apply to prod by hand (same as 008).
--
-- NOTE ON USER REFERENCES: users live in the `identity` schema keyed by
-- `identity.users.user_id` (UUID). We store that UUID in soft-reference columns
-- (UUID, no cross-schema FK) so this migration never fails if the identity schema
-- is provisioned separately or in another environment. Referential cleanup for
-- users is handled in application code, not the DB.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Teams ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS omni_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(64) UNIQUE,
  owner_user_id UUID,                       -- soft ref → identity.users.user_id
  properties JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS omni_team_members (
  team_id UUID NOT NULL REFERENCES omni_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,                     -- soft ref → identity.users.user_id
  role TEXT NOT NULL DEFAULT 'member',       -- 'owner' | 'admin' | 'member'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id),
  CONSTRAINT omni_team_members_role_valid CHECK (role IN ('owner', 'admin', 'member'))
);

CREATE INDEX IF NOT EXISTS omni_team_members_user_id ON omni_team_members(user_id);

-- 2) Email accounts (receiving mailboxes) --------------------------------------
CREATE TABLE IF NOT EXISTS omni_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  label VARCHAR(255),
  team_id UUID REFERENCES omni_teams(id) ON DELETE SET NULL,
  reply_transport VARCHAR(64) DEFAULT 'gmail',  -- 'gmail' | 'smtp:<casilla-id>'
  reply_from VARCHAR(255),                       -- address replies leave from (defaults to email)
  health VARCHAR(32) NOT NULL DEFAULT 'unknown', -- 'ok' | 'auth_error' | 'unknown'
  health_checked_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  properties JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT omni_email_accounts_email_not_empty CHECK (email ~ '^\S+@\S+$'),
  CONSTRAINT omni_email_accounts_health_valid CHECK (health IN ('ok', 'auth_error', 'unknown'))
);

CREATE INDEX IF NOT EXISTS omni_email_accounts_team_id ON omni_email_accounts(team_id) WHERE team_id IS NOT NULL;

-- 3) Per-conversation account / owner / team / lifecycle columns ---------------
ALTER TABLE omni_conversations ADD COLUMN IF NOT EXISTS receiving_account_id UUID REFERENCES omni_email_accounts(id) ON DELETE SET NULL;
ALTER TABLE omni_conversations ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID;      -- soft ref → identity.users.user_id
ALTER TABLE omni_conversations ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE omni_conversations ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES omni_teams(id) ON DELETE SET NULL;
ALTER TABLE omni_conversations ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE omni_conversations ADD COLUMN IF NOT EXISTS first_agent_reply_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS omni_conversations_assigned_to_user_id ON omni_conversations(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS omni_conversations_team_id ON omni_conversations(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS omni_conversations_receiving_account_id ON omni_conversations(receiving_account_id) WHERE receiving_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS omni_conversations_snoozed_until ON omni_conversations(snoozed_until) WHERE snoozed_until IS NOT NULL;

-- 4) Receiving account on conversations ----------------------------------------
-- Threads are already separated by the Gmail threadId in
-- adapters/emailIngest.js (channel_conversation_id = email:<threadId>), so dedup
-- needs no account awareness today. Instead, normalizer.js stamps
-- omni_conversations.receiving_account_id (added in step 3) best-effort after
-- commit, matching message metadata.account → omni_email_accounts.email. If
-- truly separate Gmail accounts are added later (threadIds could then collide
-- across accounts), fold the account into the idempotency key at that point.

-- 5) Seed the existing BMC mailboxes (idempotent) ------------------------------
-- The 8 Cloudflare-forwarded business boxes already ingesting into Omni.
INSERT INTO omni_email_accounts (email, label) VALUES
  ('ventas@bmcuruguay.com.uy',           'Ventas BMC'),
  ('info@bmcuruguay.com.uy',             'Info BMC'),
  ('administracion@bmcuruguay.com.uy',   'Administración BMC'),
  ('mportugau@bmcuruguay.com.uy',        'M. Portugau BMC'),
  ('ml@bmcuruguay.com.uy',               'MercadoLibre BMC'),
  ('info@expresoeste.com.uy',            'Info Expreso Este'),
  ('administracion@expresoeste.com.uy',  'Administración Expreso Este'),
  ('mportugau@expresoeste.com.uy',       'M. Portugau Expreso Este')
ON CONFLICT (email) DO NOTHING;

-- Track this migration (the omni_schema_migrations table exists from 001_core.sql).
INSERT INTO omni_schema_migrations (name) VALUES ('009_email_manager_multi.sql')
ON CONFLICT (name) DO NOTHING;
