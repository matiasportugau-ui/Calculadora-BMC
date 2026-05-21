-- Enable Row-Level Security on tasks.* tables for defense-in-depth.
-- Applied to project htnwozvopveibwppyjhg on 2026-05-22 via Supabase MCP.
--
-- The BMC backend connects as the postgres role (BYPASSRLS=true), so RLS is
-- transparent at runtime. These policies protect against any future
-- least-privilege connection (e.g., if someone later swaps to authenticated
-- or anon role) — and satisfy the Supabase RLS advisory that was flagging
-- all 6 tables with rls_enabled=false.

ALTER TABLE tasks.task_lists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.oauth_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.oauth_state     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.sync_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.sync_conflicts  ENABLE ROW LEVEL SECURITY;

-- service_role bypass policies (FOR ALL, USING true, WITH CHECK true)
CREATE POLICY tasks_service_role_all ON tasks.task_lists      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tasks_service_role_all ON tasks.tasks           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tasks_service_role_all ON tasks.oauth_tokens    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tasks_service_role_all ON tasks.oauth_state     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tasks_service_role_all ON tasks.sync_log        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tasks_service_role_all ON tasks.sync_conflicts  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON POLICY tasks_service_role_all ON tasks.task_lists IS
  'service_role bypass — backend already connects as postgres (BYPASSRLS=true); this is defense-in-depth for future least-privilege connections';
