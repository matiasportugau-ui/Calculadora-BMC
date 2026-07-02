-- 014_ai_job_type_union.sql — converge omni_ai_jobs_type_valid to the full
-- job-type union, regardless of prior migration history in this environment.
--
-- WHY (see PR #531): two independent branches each shipped a migration named
-- "011" — 011_ai_job_type_assist.sql ('assist') and 011_wa_crm_sync_job.sql
-- ('wa_crm_sync') — different filenames, so they never conflicted in git, but
-- both DROP+ADD the SAME omni_ai_jobs_type_valid CHECK (not additive). PR #531
-- widened 011_wa_crm_sync_job.sql's CHECK to the union as a same-file fix, but
-- scripts/omni-migrate.mjs tracks applied migrations by FILENAME in
-- omni_schema_migrations — any environment that already ran the OLD
-- 011_wa_crm_sync_job.sql (before this fix) has that filename recorded and
-- will SKIP it on the next `omni:migrate`, never picking up the widened CHECK.
-- This migration is a brand-new filename (never applied anywhere), so it
-- ALWAYS runs and re-asserts the correct constraint — the single convergence
-- point regardless of which combination of "011"/"012" files a given
-- environment already has recorded as applied.
--
-- Idempotent (drop-if-exists, then add). Apply with: npm run omni:migrate.

ALTER TABLE omni_ai_jobs DROP CONSTRAINT IF EXISTS omni_ai_jobs_type_valid;
ALTER TABLE omni_ai_jobs
  ADD CONSTRAINT omni_ai_jobs_type_valid
  CHECK (job_type IN ('classify', 'suggest', 'extract_deal', 'embed', 'assist', 'wa_crm_sync'));
