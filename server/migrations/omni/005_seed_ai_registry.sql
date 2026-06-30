-- 005_seed_ai_registry.sql
-- Seed the AI registry so the omni worker can actually generate suggestions.
--
-- WHY: omni_model_registry had NO enabled rows (no prior migration/script seeded
-- it), and the prompt rows from 002/003 are seeded enabled=false. The 'suggest'
-- and 'extract_deal' jobs call getEnabledModel()/getEnabledPrompt() and SKIP with
-- reason 'registry_disabled' when none exist. This migration enables them.
--
-- SAFE TO APPLY ANYTIME: the OMNI_AI_ORCHESTRATOR_ENABLED feature flag still gates
-- whether the worker runs at all. Seeding the registry alone changes nothing until
-- that flag is on. Idempotent (ON CONFLICT / scoped UPDATE).
--
-- ASSUMPTION (verify before high-volume use): model + pricing below.
--   provider=anthropic, model_id=claude-sonnet-4-6, ~USD 0.003/1k in, 0.015/1k out.

INSERT INTO omni_model_registry
  (task_key, provider, model_id, version, max_tokens, temperature,
   cost_per_1k_input_usd, cost_per_1k_output_usd, enabled)
VALUES
  ('suggest',      'anthropic', 'claude-sonnet-4-6', 1, 1024, 0.30, 0.003, 0.015, true),
  ('extract_deal', 'anthropic', 'claude-sonnet-4-6', 1, 1024, 0.00, 0.003, 0.015, true)
ON CONFLICT (task_key, version) DO UPDATE SET
  provider              = EXCLUDED.provider,
  model_id              = EXCLUDED.model_id,
  max_tokens            = EXCLUDED.max_tokens,
  temperature           = EXCLUDED.temperature,
  cost_per_1k_input_usd  = EXCLUDED.cost_per_1k_input_usd,
  cost_per_1k_output_usd = EXCLUDED.cost_per_1k_output_usd,
  enabled               = EXCLUDED.enabled;

-- Enable the default prompt rows seeded (disabled) by 002/003.
UPDATE omni_prompt_registry
   SET enabled = true
 WHERE task_key IN ('classify', 'suggest', 'extract_deal')
   AND version = 1;
