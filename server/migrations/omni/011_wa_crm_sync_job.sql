-- 011_wa_crm_sync_job.sql
-- WA flip (ADR-009 shadow→canonical): add the `wa_crm_sync` durable job type.
--
-- WHY: when OMNI_WA_CANONICAL is ON, the legacy in-memory WA pipeline (CRM_Operativo
-- + Form-responses Sheets ingest and auto-learn) is retired and re-homed onto the
-- existing omni_ai_jobs queue as a `wa_crm_sync` job — gaining SKIP-LOCKED claiming,
-- retries/dead-lettering, and stale-running recovery for free. NOTE: wa_crm_sync is
-- a zero-LLM-cost bookkeeping job and is intentionally NOT gated by the AI daily
-- budget (the budget gate scopes to 'suggest' only — see aiWorker.js); its
-- parse-conversation spend is outside OMNI_AI_DAILY_BUDGET_USD.
--
-- ⚠️ OPS: the CREATE UNIQUE INDEX below takes a brief ACCESS EXCLUSIVE (write) lock
-- on omni_ai_jobs. Apply in a low-traffic window, or build it out-of-band with
-- CREATE UNIQUE INDEX CONCURRENTLY (cannot run inside the migration runner's
-- transaction). See docs/team/runbooks/wa-canonical-flip.md.
--
-- Idempotent (drop-if-exists, then add) so it is safe to re-run.
--
-- ⚠️ CROSS-BRANCH NOTE: this repo independently grew a SECOND "011" migration on
-- another branch — 011_ai_job_type_assist.sql, which widens this same CHECK to
-- admit 'assist' (the /omni/.../assist route's cost-accounting job type). Migration
-- filenames sort alphabetically ("011_ai_job_type_assist.sql" < "011_wa_crm_sync_job.sql"),
-- so that one applies first and THIS ONE'S DROP+ADD would otherwise silently drop
-- 'assist' again. The CHECK below is therefore the union of both, not just this
-- migration's own concern — keep it that way if either side adds another job type.

-- 1) Widen the job-type CHECK to admit 'wa_crm_sync' (+ 'assist', see note above).
--    The constraint is the single source of truth mirrored by ALLOWED_AI_JOB_TYPES
--    in aiWorker.js.
ALTER TABLE omni_ai_jobs DROP CONSTRAINT IF EXISTS omni_ai_jobs_type_valid;
ALTER TABLE omni_ai_jobs
  ADD CONSTRAINT omni_ai_jobs_type_valid
  CHECK (job_type IN ('classify', 'suggest', 'extract_deal', 'embed', 'assist', 'wa_crm_sync'));

-- 2) Per-conversation coalescing for wa_crm_sync ONLY: at most one NON-TERMINAL
--    (pending OR failed) wa_crm_sync job per conversation. New inbound messages that
--    arrive while one is in-flight enqueue with ON CONFLICT DO NOTHING → no duplicate.
--    Covering 'failed' too closes the leak where a failed job awaiting retry + a new
--    message would otherwise create two concurrent jobs for the same conversation.
--    Scoped to job_type='wa_crm_sync' so per-message classify/suggest jobs (which
--    legitimately have multiple in-flight rows per conversation) are unaffected.
DROP INDEX IF EXISTS omni_ai_jobs_wa_crm_sync_pending_dedup;
CREATE UNIQUE INDEX IF NOT EXISTS omni_ai_jobs_wa_crm_sync_active_dedup
  ON omni_ai_jobs (conversation_id)
  WHERE status IN ('pending', 'failed') AND job_type = 'wa_crm_sync';
