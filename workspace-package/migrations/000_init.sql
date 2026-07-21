-- Panelin Workspace domain (BMC-as-platform, ADR-008)
-- Additive schema — does not touch traktime/wa/identity/calc tables.
-- Apply: npm run workspace:migrate

CREATE SCHEMA IF NOT EXISTS panelin_workspace;

CREATE TABLE IF NOT EXISTS panelin_workspace.ws_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'operator'))
);

CREATE TABLE IF NOT EXISTS panelin_workspace.workspaces (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES panelin_workspace.ws_users(id),
  name TEXT NOT NULL,
  agent_config_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS panelin_workspace.projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES panelin_workspace.workspaces(id),
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES panelin_workspace.projects(id)
);

CREATE TABLE IF NOT EXISTS panelin_workspace.sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES panelin_workspace.projects(id),
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  file_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS panelin_workspace.files (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES panelin_workspace.workspaces(id),
  project_id TEXT REFERENCES panelin_workspace.projects(id),
  session_id TEXT REFERENCES panelin_workspace.sessions(id),
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS panelin_workspace.knowledge_docs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES panelin_workspace.workspaces(id),
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('indexed', 'proposed', 'pending')),
  bmc_kb_id TEXT,
  proposed_by TEXT,
  approved_by TEXT,
  indexed_at DATE,
  size TEXT
);

CREATE TABLE IF NOT EXISTS panelin_workspace.skills (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES panelin_workspace.workspaces(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  kind TEXT NOT NULL CHECK (kind IN ('skill', 'tool')),
  status TEXT NOT NULL CHECK (status IN ('approved', 'pending')),
  bmc_tool_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS panelin_workspace.workflows (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES panelin_workspace.workspaces(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  last_edited TEXT
);

CREATE TABLE IF NOT EXISTS panelin_workspace.agent_configs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES panelin_workspace.workspaces(id),
  system_prompt TEXT NOT NULL,
  models JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_model TEXT NOT NULL,
  api_keys_masked JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS panelin_workspace.change_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES panelin_workspace.workspaces(id),
  type TEXT NOT NULL CHECK (type IN ('knowledge', 'skill', 'workflow', 'config')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'in_review', 'approved', 'rejected')),
  diff_text TEXT NOT NULL,
  diff_json TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  reviewer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS panelin_workspace.telemetry_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES panelin_workspace.workspaces(id),
  source TEXT NOT NULL CHECK (source IN ('calc', 'agent', 'workspace')),
  kind TEXT NOT NULL CHECK (kind IN ('error', 'fix', 'improvement', 'patch')),
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'pending')),
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pw_sessions_project ON panelin_workspace.sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_pw_files_workspace ON panelin_workspace.files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pw_cr_status ON panelin_workspace.change_requests(status);
CREATE INDEX IF NOT EXISTS idx_pw_telemetry_kind ON panelin_workspace.telemetry_events(kind);
