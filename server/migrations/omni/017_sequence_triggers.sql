-- 017_sequence_triggers.sql — temporal follow-up automation triggers (Gap 4).
-- Idempotent support for trigger_event values:
--   - conversation.no_reply
--   - followup.due
-- Rule-specific knobs live in omni_automation_rules.conditions JSONB, e.g.
--   {"hours_since_last_customer_reply": 24, "only_open_conversations": true}

CREATE INDEX IF NOT EXISTS omni_automation_rules_sequence_trigger_idx
  ON omni_automation_rules (trigger_event, enabled, priority ASC)
  WHERE enabled = true
    AND trigger_event IN ('conversation.no_reply', 'followup.due');

CREATE INDEX IF NOT EXISTS omni_suggestions_sequence_pending_idx
  ON omni_suggestions (conversation_id, (metadata->>'automation_rule_id'), created_at DESC)
  WHERE approval_state = 'pending'
    AND metadata->>'source' = 'sequence';

CREATE INDEX IF NOT EXISTS omni_ai_jobs_sequence_pending_idx
  ON omni_ai_jobs (conversation_id, (input_json->>'automation_rule_id'), created_at DESC)
  WHERE job_type = 'suggest'
    AND status IN ('pending', 'running')
    AND input_json->>'source' = 'sequence';

COMMENT ON INDEX omni_automation_rules_sequence_trigger_idx IS
  'Gap 4: temporal sequence triggers conversation.no_reply and followup.due.';
