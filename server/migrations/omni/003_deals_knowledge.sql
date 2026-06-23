-- Omni Deals + Knowledge extensions (WAVE 4 / Track F + H)
-- Depends on 001_core.sql, 002_ai_automation.sql

CREATE TABLE IF NOT EXISTS omni_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES omni_contacts(id) ON DELETE CASCADE,
  title VARCHAR(512) NOT NULL,
  value_usd NUMERIC(12, 2),
  stage VARCHAR(50) NOT NULL DEFAULT 'lead',
  source_channel VARCHAR(50),
  source_conversation_id UUID REFERENCES omni_conversations(id) ON DELETE SET NULL,
  owner_agent_id VARCHAR(255),
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  properties JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT omni_deals_stage_valid CHECK (
    stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')
  ),
  CONSTRAINT omni_deals_source_channel_valid CHECK (
    source_channel IS NULL OR source_channel IN ('ml', 'wa', 'email', 'facebook', 'instagram', 'omnicrm')
  ),
  CONSTRAINT omni_deals_value_positive CHECK (value_usd IS NULL OR value_usd > 0)
);

CREATE INDEX IF NOT EXISTS omni_deals_contact_id ON omni_deals(contact_id);
CREATE INDEX IF NOT EXISTS omni_deals_stage ON omni_deals(stage);
CREATE INDEX IF NOT EXISTS omni_deals_source_conversation_id ON omni_deals(source_conversation_id)
  WHERE source_conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS omni_deals_updated_at ON omni_deals(updated_at DESC);

-- Idempotent if omni_deals pre-existed without properties (legacy schema)
ALTER TABLE omni_deals
  ADD COLUMN IF NOT EXISTS properties JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE TABLE IF NOT EXISTS omni_message_embeddings (
  message_id UUID PRIMARY KEY REFERENCES omni_messages(id) ON DELETE CASCADE,
  content_hash VARCHAR(64) NOT NULL,
  embedded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS omni_prompt_eval (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key VARCHAR(50) NOT NULL,
  prompt_version INT NOT NULL,
  suggestion_id UUID REFERENCES omni_suggestions(id) ON DELETE SET NULL,
  rating VARCHAR(10) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT omni_prompt_eval_rating_valid CHECK (rating IN ('good', 'bad', 'edit', 'accepted', 'rejected'))
);

CREATE INDEX IF NOT EXISTS omni_prompt_eval_task_idx ON omni_prompt_eval(task_key, prompt_version, created_at DESC);

INSERT INTO omni_prompt_registry (task_key, channel, version, system_prompt, enabled)
VALUES
  ('extract_deal', NULL, 1,
   'Extract deal fields from customer message: title, value_usd (number or null), stage hint (lead|qualified|proposal). Return JSON only.',
   false)
ON CONFLICT (task_key, channel, version) DO NOTHING;
