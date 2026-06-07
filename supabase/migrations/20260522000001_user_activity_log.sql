-- Unified user activity log — powers per-user Historial + admin analytics.
-- Additive to identity.audit_log (which stays security-audit canonical).
-- BIGSERIAL event_id matches the convention used by identity.audit_log.audit_id,
-- identity.quote_events.event_id, tk_audit_log.audit_id, wa_audit_log.id.
-- RLS enabled for defense-in-depth (matches convention on other identity.* tables);
-- actual per-user isolation is enforced in handler code via
-- WHERE actor_user_id = $req.user.id — the BMC backend connects with a
-- privileged Postgres role that bypasses RLS by design.
-- Applied to project htnwozvopveibwppyjhg on 2026-05-21 via Supabase MCP.

CREATE TABLE IF NOT EXISTS identity.user_activity_log (
  event_id          BIGSERIAL PRIMARY KEY,
  actor_user_id     uuid REFERENCES identity.users(user_id) ON DELETE SET NULL,
  session_id        uuid REFERENCES identity.sessions(session_id) ON DELETE SET NULL,
  action            text NOT NULL,
  module            text,
  resource_type     text,
  resource_id       text,
  outcome           text NOT NULL DEFAULT 'success',
  duration_ms       integer,
  ip                text,
  user_agent        text,
  client_emitted    boolean NOT NULL DEFAULT false,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_activity_log_actor_at_idx
  ON identity.user_activity_log (actor_user_id, at DESC);
CREATE INDEX IF NOT EXISTS user_activity_log_action_at_idx
  ON identity.user_activity_log (action, at DESC);
CREATE INDEX IF NOT EXISTS user_activity_log_session_idx
  ON identity.user_activity_log (session_id)
  WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_activity_log_failures_idx
  ON identity.user_activity_log (at DESC)
  WHERE outcome != 'success';
CREATE INDEX IF NOT EXISTS user_activity_log_module_at_idx
  ON identity.user_activity_log (module, at DESC)
  WHERE module IS NOT NULL;

ALTER TABLE identity.user_activity_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE identity.user_activity_log IS
  'Unified per-user activity log: business actions, auth, admin, and client-emitted intent events (nav, ui). Powers /mi-espacio Historial tab and /hub/admin/analytics. Enforcement is in handler code (WHERE actor_user_id = $req.user.id), not RLS — RLS is defense-in-depth.';
COMMENT ON COLUMN identity.user_activity_log.action IS
  'Flat dotted string validated server-side against ACTION_TAXONOMY in server/lib/userActivityLog.js';
COMMENT ON COLUMN identity.user_activity_log.client_emitted IS
  'true if event came from POST /api/me/activity. Client-emittable actions are restricted to the CLIENT_EMITTABLE subset (nav.*, ui.*).';
COMMENT ON COLUMN identity.user_activity_log.outcome IS
  'success|failure|pending|orphan (orphan = synthetic session.end from TTL job)';
