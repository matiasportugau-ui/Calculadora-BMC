-- 011_ai_job_type_assist.sql — allow 'assist' in omni_ai_jobs.job_type.
--
-- The /omni/conversations/:id/assist route records its AI spend as a completed
-- omni_ai_jobs row with job_type='assist' so it counts toward the daily budget
-- (omniAiDailyBudgetUsd). Migration 002's CHECK constraint omitted 'assist', so
-- that INSERT silently failed (swallowed by .catch in the route) and assist spend
-- was never accounted — a budget/audit gap. This widens the allow-list to match
-- server/lib/omni/orchestrator/aiWorker.js ALLOWED_AI_JOB_TYPES.
--
-- Idempotent: drop + re-add the named constraint.

ALTER TABLE omni_ai_jobs DROP CONSTRAINT IF EXISTS omni_ai_jobs_type_valid;
ALTER TABLE omni_ai_jobs ADD CONSTRAINT omni_ai_jobs_type_valid
  CHECK (job_type IN ('classify', 'suggest', 'extract_deal', 'embed', 'assist'));
