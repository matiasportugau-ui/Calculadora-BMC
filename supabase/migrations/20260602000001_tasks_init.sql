-- Migration: 20260602000001_tasks_init.sql
-- Tareas (Tasks) module schema initialization
-- Date: 2026-06-02 (intentionally after 20260601000004 so FK to identity.users resolves)
--
-- NOTE: Earlier draft of this file used MySQL-style inline `COMMENT 'text'` clauses
-- and an INSERT into identity.modules with wrong column names (slug/label/enabled
-- instead of module/display_name/category). Both bugs caused apply to fail on
-- Supabase. Corrected 2026-05-18.

-- Create tasks schema namespace
CREATE SCHEMA IF NOT EXISTS tasks;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- table: task_lists
-- Mirrors Google Tasks task lists; synced via polling
CREATE TABLE tasks.task_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  google_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);

COMMENT ON COLUMN tasks.task_lists.google_id IS 'Google Tasks list ID (immutable)';
COMMENT ON COLUMN tasks.task_lists.synced_at IS 'Last sync timestamp from Google API';

CREATE INDEX idx_task_lists_user_id ON tasks.task_lists(user_id);
CREATE INDEX idx_task_lists_updated_at ON tasks.task_lists(updated_at);
CREATE INDEX idx_task_lists_synced_at ON tasks.task_lists(synced_at);

-- table: tasks
-- Individual tasks within lists; synced via polling
CREATE TABLE tasks.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES tasks.task_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  google_id TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  due DATE,
  status TEXT NOT NULL DEFAULT 'needsAction' CHECK (status IN ('needsAction', 'completed')),
  parent_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE
);

COMMENT ON COLUMN tasks.tasks.google_id IS 'Google Tasks task ID';
COMMENT ON COLUMN tasks.tasks.due IS 'ISO 8601 date (no time; Google Tasks constraint)';
COMMENT ON COLUMN tasks.tasks.parent_id IS 'Recursive: parent task within same list (Google Tasks subtasks)';
COMMENT ON COLUMN tasks.tasks.synced_at IS 'Last sync timestamp from Google API';
COMMENT ON COLUMN tasks.tasks.is_deleted IS 'Soft-delete marker for conflict resolution';

CREATE UNIQUE INDEX idx_tasks_google_id ON tasks.tasks(list_id, google_id) WHERE NOT is_deleted;
CREATE INDEX idx_tasks_user_id ON tasks.tasks(user_id);
CREATE INDEX idx_tasks_list_id ON tasks.tasks(list_id);
CREATE INDEX idx_tasks_updated_at ON tasks.tasks(updated_at);
CREATE INDEX idx_tasks_synced_at ON tasks.tasks(synced_at);
CREATE INDEX idx_tasks_status ON tasks.tasks(status);
CREATE INDEX idx_tasks_parent_id ON tasks.tasks(parent_id);

-- table: oauth_tokens
-- Encrypted Google OAuth access_token + refresh_token per user
CREATE TABLE tasks.oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES identity.users(user_id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL DEFAULT 'https://www.googleapis.com/auth/tasks',
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN tasks.oauth_tokens.access_token_encrypted IS 'pgp_sym_encrypt(token, encryption_key)';
COMMENT ON COLUMN tasks.oauth_tokens.refresh_token_encrypted IS 'pgp_sym_encrypt(token, encryption_key); nullable if online-only';
COMMENT ON COLUMN tasks.oauth_tokens.scope IS 'OAuth scope granted';
COMMENT ON COLUMN tasks.oauth_tokens.revoked_at IS 'Timestamp of revocation; NULL = active';

CREATE INDEX idx_oauth_tokens_user_id ON tasks.oauth_tokens(user_id);
CREATE INDEX idx_oauth_tokens_revoked_at ON tasks.oauth_tokens(revoked_at);

-- table: oauth_state
-- PKCE challenge/verifier and state nonce for OAuth flow (short-lived, ~5min TTL)
CREATE TABLE tasks.oauth_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  state_nonce TEXT NOT NULL UNIQUE,
  challenge TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);

COMMENT ON COLUMN tasks.oauth_state.state_nonce IS 'PKCE state parameter; regenerated per flow';
COMMENT ON COLUMN tasks.oauth_state.challenge IS 'Base64url(SHA256(verifier))';

CREATE INDEX idx_oauth_state_state_nonce ON tasks.oauth_state(state_nonce);
CREATE INDEX idx_oauth_state_user_id ON tasks.oauth_state(user_id);
CREATE INDEX idx_oauth_state_expires_at ON tasks.oauth_state(expires_at);

-- table: sync_log
-- Audit trail for polling cycles, errors, and token refreshes
CREATE TABLE tasks.sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  cycle_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sync_started', 'sync_completed', 'sync_failed',
    'conflict_detected', 'token_refreshed', 'token_revoked',
    'rate_limit_hit', 'task_created', 'task_updated', 'task_deleted'
  )),
  details JSONB,
  http_status_code INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN tasks.sync_log.cycle_id IS 'Unique ID for this polling cycle (Cloud Scheduler job ID)';
COMMENT ON COLUMN tasks.sync_log.details IS 'Error message, conflict details, or operation metadata';
COMMENT ON COLUMN tasks.sync_log.http_status_code IS 'HTTP status from Google API (429, 401, 500, etc)';

CREATE INDEX idx_sync_log_user_id ON tasks.sync_log(user_id);
CREATE INDEX idx_sync_log_cycle_id ON tasks.sync_log(cycle_id);
CREATE INDEX idx_sync_log_event_type ON tasks.sync_log(event_type);
CREATE INDEX idx_sync_log_created_at ON tasks.sync_log(created_at);

-- table: sync_conflicts
-- Conflict detection and resolution tracking (soft-delete vs Google API version mismatch)
CREATE TABLE tasks.sync_conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks.tasks(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES tasks.task_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN (
    'soft_delete_mismatch',
    'update_timestamp_mismatch',
    'concurrent_edit'
  )),
  hub_version JSONB NOT NULL,
  google_version JSONB NOT NULL,
  resolution TEXT,
  resolved_by UUID REFERENCES identity.users(user_id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

COMMENT ON COLUMN tasks.sync_conflicts.hub_version IS 'Last known HUB state (title, notes, due, status)';
COMMENT ON COLUMN tasks.sync_conflicts.google_version IS 'Latest Google API state';
COMMENT ON COLUMN tasks.sync_conflicts.resolution IS 'take_google|take_hub|manual; NULL = unresolved';
COMMENT ON COLUMN tasks.sync_conflicts.resolved_by IS 'User who resolved (manual picker)';
COMMENT ON COLUMN tasks.sync_conflicts.resolved_at IS 'Resolution timestamp';
COMMENT ON COLUMN tasks.sync_conflicts.expires_at IS '7-day TTL for cleanup';

CREATE INDEX idx_sync_conflicts_user_id ON tasks.sync_conflicts(user_id);
CREATE INDEX idx_sync_conflicts_task_id ON tasks.sync_conflicts(task_id);
CREATE INDEX idx_sync_conflicts_list_id ON tasks.sync_conflicts(list_id);
CREATE INDEX idx_sync_conflicts_resolution ON tasks.sync_conflicts(resolution);
CREATE INDEX idx_sync_conflicts_created_at ON tasks.sync_conflicts(created_at);
CREATE INDEX idx_sync_conflicts_expires_at ON tasks.sync_conflicts(expires_at);

-- trigger: touch_updated_at (applied to all synced tables)
-- Maintains updated_at timestamp on every row modification
CREATE OR REPLACE FUNCTION tasks.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_lists_touch_updated_at BEFORE UPDATE ON tasks.task_lists
  FOR EACH ROW EXECUTE FUNCTION tasks.touch_updated_at();

CREATE TRIGGER trg_tasks_touch_updated_at BEFORE UPDATE ON tasks.tasks
  FOR EACH ROW EXECUTE FUNCTION tasks.touch_updated_at();

CREATE TRIGGER trg_oauth_tokens_touch_updated_at BEFORE UPDATE ON tasks.oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION tasks.touch_updated_at();

-- RLS Policies: service_role only (backend routes use service_role)
-- [No row-level policies needed; service_role bypasses RLS entirely]

-- Seed: Add "tareas" module to identity.modules
-- Matches actual schema (module, display_name, category, created_at)
INSERT INTO identity.modules (module, display_name, category, created_at)
VALUES ('tareas', 'Tareas (Tasks)', 'productivity', now())
ON CONFLICT (module) DO NOTHING;
