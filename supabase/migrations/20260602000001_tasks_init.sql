-- Migration: 20260602000001_tasks_init.sql
-- Tareas (Tasks) module schema initialization
-- Date: 2026-06-02 (intentionally after 20260601000004 so FK to identity.users resolves)

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
  google_id TEXT UNIQUE NOT NULL COMMENT 'Google Tasks list ID (immutable)',
  title TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ COMMENT 'Last sync timestamp from Google API'
);

CREATE INDEX idx_task_lists_user_id ON tasks.task_lists(user_id);
CREATE INDEX idx_task_lists_updated_at ON tasks.task_lists(updated_at);
CREATE INDEX idx_task_lists_synced_at ON tasks.task_lists(synced_at);

-- table: tasks
-- Individual tasks within lists; synced via polling
CREATE TABLE tasks.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES tasks.task_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  google_id TEXT NOT NULL COMMENT 'Google Tasks task ID',
  title TEXT NOT NULL,
  notes TEXT,
  due DATE COMMENT 'ISO 8601 date (no time; Google Tasks constraint)',
  status TEXT NOT NULL DEFAULT 'needsAction' CHECK (status IN ('needsAction', 'completed')),
  parent_id UUID COMMENT 'Recursive: parent task within same list (Google Tasks subtasks)',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ COMMENT 'Last sync timestamp from Google API',
  is_deleted BOOLEAN DEFAULT FALSE COMMENT 'Soft-delete marker for conflict resolution'
);

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
  access_token_encrypted TEXT NOT NULL COMMENT 'pgp_sym_encrypt(token, encryption_key)',
  refresh_token_encrypted TEXT COMMENT 'pgp_sym_encrypt(token, encryption_key); nullable if online-only',
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL DEFAULT 'https://www.googleapis.com/auth/tasks' COMMENT 'OAuth scope granted',
  revoked_at TIMESTAMPTZ COMMENT 'Timestamp of revocation; NULL = active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_tokens_user_id ON tasks.oauth_tokens(user_id);
CREATE INDEX idx_oauth_tokens_revoked_at ON tasks.oauth_tokens(revoked_at);

-- table: oauth_state
-- PKCE challenge/verifier and state nonce for OAuth flow (short-lived, ~5min TTL)
CREATE TABLE tasks.oauth_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  state_nonce TEXT NOT NULL UNIQUE COMMENT 'PKCE state parameter; regenerated per flow',
  challenge TEXT NOT NULL COMMENT 'Base64url(SHA256(verifier))',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);

CREATE INDEX idx_oauth_state_state_nonce ON tasks.oauth_state(state_nonce);
CREATE INDEX idx_oauth_state_user_id ON tasks.oauth_state(user_id);
CREATE INDEX idx_oauth_state_expires_at ON tasks.oauth_state(expires_at);

-- table: sync_log
-- Audit trail for polling cycles, errors, and token refreshes
CREATE TABLE tasks.sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  cycle_id TEXT NOT NULL COMMENT 'Unique ID for this polling cycle (Cloud Scheduler job ID)',
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sync_started', 'sync_completed', 'sync_failed',
    'conflict_detected', 'token_refreshed', 'token_revoked',
    'rate_limit_hit', 'task_created', 'task_updated', 'task_deleted'
  )),
  details JSONB COMMENT 'Error message, conflict details, or operation metadata',
  http_status_code INTEGER COMMENT 'HTTP status from Google API (429, 401, 500, etc)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
    'soft_delete_mismatch',  -- Hub is soft-deleted, Google has active version
    'update_timestamp_mismatch',  -- Both modified; unclear which is authoritative
    'concurrent_edit'  -- Hub mutation in-flight while Google updated
  )),
  hub_version JSONB NOT NULL COMMENT 'Last known HUB state (title, notes, due, status)',
  google_version JSONB NOT NULL COMMENT 'Latest Google API state',
  resolution TEXT COMMENT 'take_google|take_hub|manual; NULL = unresolved',
  resolved_by UUID REFERENCES identity.users(user_id) COMMENT 'User who resolved (manual picker)',
  resolved_at TIMESTAMPTZ COMMENT 'Resolution timestamp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days') COMMENT '7-day TTL for cleanup'
);

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

-- RLS Policies: service_role only (MCP + backend routes use service_role)
-- [No row-level policies needed; service_role bypasses RLS entirely]

-- Seed: Add "tareas" module to identity.modules
-- [This assumes identity.modules table exists with (id UUID PK, slug TEXT UNIQUE, label TEXT, enabled BOOLEAN)]
INSERT INTO identity.modules (slug, label, enabled, created_at)
VALUES ('tareas', 'Tareas (Tasks)', TRUE, now())
ON CONFLICT (slug) DO NOTHING;

-- Seed: Grant "tareas" to admin user if it exists
-- [This assumes identity.module_grants table exists with (user_id, module_id, granted_at)]
-- [Query deferred to Phase 1 provisioning checklist; admin user ID must be known at seed time]

COMMIT;
