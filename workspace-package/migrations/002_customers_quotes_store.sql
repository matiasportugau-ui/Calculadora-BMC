-- Panelin Workspace store expansion: first-class customers + quotes + richer files.
-- Additive / idempotent. Mockup "Obra Norte" is example content only — domain is open-ended.

CREATE TABLE IF NOT EXISTS panelin_workspace.customers (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES panelin_workspace.workspaces(id),
  name TEXT NOT NULL,
  rut TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT,
  notes TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pw_customers_workspace ON panelin_workspace.customers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pw_customers_name ON panelin_workspace.customers(workspace_id, lower(name));

CREATE TABLE IF NOT EXISTS panelin_workspace.quotes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES panelin_workspace.workspaces(id),
  customer_id TEXT REFERENCES panelin_workspace.customers(id),
  project_id TEXT REFERENCES panelin_workspace.projects(id),
  code TEXT,
  title TEXT NOT NULL DEFAULT '',
  scenario TEXT,
  lista TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_sin_iva NUMERIC,
  total_con_iva NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'sent', 'won', 'lost', 'cancelled')),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_file_id TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pw_quotes_workspace ON panelin_workspace.quotes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pw_quotes_customer ON panelin_workspace.quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_pw_quotes_status ON panelin_workspace.quotes(status);

-- Projects: optional customer link
ALTER TABLE panelin_workspace.projects
  ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES panelin_workspace.customers(id);
ALTER TABLE panelin_workspace.projects
  ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE panelin_workspace.projects
  ADD COLUMN IF NOT EXISTS location TEXT;

-- Sessions: optional quote + workflow step
ALTER TABLE panelin_workspace.sessions
  ADD COLUMN IF NOT EXISTS quote_id TEXT REFERENCES panelin_workspace.quotes(id);
ALTER TABLE panelin_workspace.sessions
  ADD COLUMN IF NOT EXISTS workflow_step INT NOT NULL DEFAULT 1;
ALTER TABLE panelin_workspace.sessions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Files: polymorphic links + kind
ALTER TABLE panelin_workspace.files
  ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES panelin_workspace.customers(id);
ALTER TABLE panelin_workspace.files
  ADD COLUMN IF NOT EXISTS quote_id TEXT REFERENCES panelin_workspace.quotes(id);
ALTER TABLE panelin_workspace.files
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'other';
ALTER TABLE panelin_workspace.files
  ADD COLUMN IF NOT EXISTS storage_url TEXT;

CREATE INDEX IF NOT EXISTS idx_pw_files_customer ON panelin_workspace.files(customer_id);
CREATE INDEX IF NOT EXISTS idx_pw_files_quote ON panelin_workspace.files(quote_id);

-- Change requests may target quote payloads (HITL amount/qty diffs)
ALTER TABLE panelin_workspace.change_requests
  DROP CONSTRAINT IF EXISTS change_requests_type_check;
ALTER TABLE panelin_workspace.change_requests
  ADD CONSTRAINT change_requests_type_check
  CHECK (type = ANY (ARRAY[
    'knowledge'::text,
    'skill'::text,
    'workflow'::text,
    'config'::text,
    'quote'::text,
    'file'::text
  ]));
