-- Omni AI + Automation (WAVE 3 / Track E + F1)
-- Depends on 001_core.sql

-- ─── AI governance (ADR-004) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS omni_prompt_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key VARCHAR(50) NOT NULL,
  channel VARCHAR(20),
  version INT NOT NULL DEFAULT 1,
  system_prompt TEXT NOT NULL,
  user_template TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT omni_prompt_registry_unique UNIQUE (task_key, channel, version)
);

CREATE INDEX IF NOT EXISTS omni_prompt_registry_enabled_idx
  ON omni_prompt_registry (task_key, channel) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS omni_model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key VARCHAR(50) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  model_id VARCHAR(100) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  max_tokens INT,
  temperature NUMERIC(3, 2),
  enabled BOOLEAN NOT NULL DEFAULT false,
  cost_per_1k_input_usd NUMERIC(10, 6),
  cost_per_1k_output_usd NUMERIC(10, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT omni_model_registry_unique UNIQUE (task_key, version)
);

CREATE TABLE IF NOT EXISTS omni_ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL,
  message_id UUID REFERENCES omni_messages(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES omni_conversations(id) ON DELETE CASCADE,
  channel VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  input_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  output_json JSONB,
  prompt_version INT,
  model_version INT,
  confidence NUMERIC(5, 4),
  latency_ms INT,
  cost_usd NUMERIC(10, 6),
  approval_state VARCHAR(20) DEFAULT 'auto_skipped',
  error TEXT,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT omni_ai_jobs_status_valid CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'dead')
  ),
  CONSTRAINT omni_ai_jobs_type_valid CHECK (
    job_type IN ('classify', 'suggest', 'extract_deal', 'embed')
  )
);

CREATE INDEX IF NOT EXISTS omni_ai_jobs_pending_idx
  ON omni_ai_jobs (created_at ASC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS omni_ai_jobs_message_idx ON omni_ai_jobs (message_id);

CREATE TABLE IF NOT EXISTS omni_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES omni_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES omni_conversations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES omni_ai_jobs(id) ON DELETE SET NULL,
  channel VARCHAR(50),
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  approval_state VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS omni_suggestions_message_idx ON omni_suggestions (message_id);
CREATE INDEX IF NOT EXISTS omni_suggestions_conversation_idx ON omni_suggestions (conversation_id);

-- ─── Automation engine (ADR-005) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS omni_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 100,
  trigger_event VARCHAR(50) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::JSONB,
  actions JSONB NOT NULL DEFAULT '[]'::JSONB,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS omni_automation_rules_trigger_idx
  ON omni_automation_rules (trigger_event, enabled, priority ASC)
  WHERE enabled = true;

CREATE TABLE IF NOT EXISTS omni_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES omni_automation_rules(id) ON DELETE CASCADE,
  trigger_event_id UUID,
  idempotency_key VARCHAR(512) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  actions_result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT omni_automation_runs_status_valid CHECK (
    status IN ('running', 'completed', 'failed', 'pending_approval', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS omni_automation_runs_rule_idx ON omni_automation_runs (rule_id, started_at DESC);

-- Seed default disabled prompts (operators enable via admin later)
INSERT INTO omni_prompt_registry (task_key, channel, version, system_prompt, enabled)
VALUES
  ('classify', NULL, 1, 'Classify customer message into: product, order, issue, inquiry, complaint, feedback, spam, cotizacion, chatter.', false),
  ('suggest', NULL, 1, 'Suggest operator reply for BMC Uruguay panel insulation sales.', false)
ON CONFLICT (task_key, channel, version) DO NOTHING;
