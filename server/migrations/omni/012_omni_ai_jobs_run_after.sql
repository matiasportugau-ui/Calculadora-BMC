-- 012_omni_ai_jobs_run_after.sql
-- WA flip: burst-debounce for wa_crm_sync.
--
-- WHY: wa_crm_sync is insert-once but had no debounce, so it created the CRM lead
-- row from the FIRST message of a conversation (thin resumen). This column lets a
-- job be held until the conversation has been quiet for a window — each new message
-- re-stamps run_after (see aiWorker.enqueueAiJob reStampRunAfter), so the job fires
-- once after the burst quiesces and parses the FULL transcript, matching the legacy
-- 5-min-inactivity behavior. The worker claim skips rows whose run_after is future.
--
-- Cheap metadata-only ADD COLUMN (nullable, no default value → no table rewrite,
-- no long lock). Other job types leave run_after NULL and are claimed immediately.
-- Idempotent.

ALTER TABLE omni_ai_jobs ADD COLUMN IF NOT EXISTS run_after timestamptz;
