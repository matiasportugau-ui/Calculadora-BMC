-- 011_wa_crm_sync_job.sql
-- WA flip (ADR-009 shadow→canonical): add the `wa_crm_sync` durable job type.
--
-- WHY: when OMNI_WA_CANONICAL is ON, the legacy in-memory WA pipeline (CRM_Operativo
-- + Form-responses Sheets ingest and auto-learn) is retired and re-homed onto the
-- existing omni_ai_jobs queue as a `wa_crm_sync` job — gaining SKIP-LOCKED claiming,
-- retries/dead-lettering, stale-running recovery, and daily-budget control for free.
--
-- Idempotent (drop-if-exists, then add) so it is safe to re-run.

-- 1) Widen the job-type CHECK to admit 'wa_crm_sync'. The constraint is the single
--    source of truth mirrored by ALLOWED_AI_JOB_TYPES in aiWorker.js.
ALTER TABLE omni_ai_jobs DROP CONSTRAINT IF EXISTS omni_ai_jobs_type_valid;
ALTER TABLE omni_ai_jobs
  ADD CONSTRAINT omni_ai_jobs_type_valid
  CHECK (job_type IN ('classify', 'suggest', 'extract_deal', 'embed', 'wa_crm_sync'));

-- 2) Per-conversation coalescing for wa_crm_sync ONLY (debounce without a timer):
--    at most one PENDING wa_crm_sync job per conversation. New inbound messages that
--    arrive while one is pending enqueue with ON CONFLICT DO NOTHING → no duplicate;
--    when the job runs it reads the whole conversation and upserts one CRM row.
--    Scoped to job_type='wa_crm_sync' so the per-message classify/suggest jobs (which
--    legitimately have multiple pending rows per conversation) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS omni_ai_jobs_wa_crm_sync_pending_dedup
  ON omni_ai_jobs (conversation_id)
  WHERE status = 'pending' AND job_type = 'wa_crm_sync';
