-- 015_omni_suggestions_resolved_at.sql — resolution timestamp for HITL suggestions.
--
-- omni_suggestions only carried approval_state (pending/accepted/rejected) with no
-- record of WHEN a suggestion was resolved. The WA cockpit read-model adapter
-- (OMNI_WA_READS) maps chosen_at from this column, and resolveSuggestion() stamps
-- it on accept/reject.
--
-- Dormancy: resolveSuggestion() falls back to the old UPDATE (no resolved_at) when
-- the column doesn't exist yet (undefined_column 42703), so deploying the code
-- before this migration does NOT break the approve/reject endpoints. Apply this
-- migration before flipping OMNI_WA_READS=1 (the read adapter SELECTs the column
-- unconditionally).
--
-- Cheap + idempotent. Apply with: npm run omni:migrate.

ALTER TABLE omni_suggestions ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
