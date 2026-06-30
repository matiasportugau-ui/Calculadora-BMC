-- 008_email_channel_constraint.sql
-- Realign the channel CHECK constraints to include 'email'.
--
-- WHY: prod drift. The live DB kept an original constraint named `channel_valid`
-- on omni_conversations that allowed only (ml, wa, facebook, instagram, omnicrm)
-- — no 'email'. 001_core.sql was edited to add 'email' (and renamed the
-- constraint to omni_conversations_channel_valid), but applied migrations don't
-- re-run, so prod rejected every email shadow-write with:
--   new row for relation "omni_conversations" violates check constraint "channel_valid"
-- The write is wrapped in try/catch, so it failed SILENTLY (mail reached the CRM
-- sheet; only the Omni copy was dropped). This migration makes prod match code and
-- is idempotent (drop-if-exists, then add) so it is safe to re-run.

ALTER TABLE omni_conversations DROP CONSTRAINT IF EXISTS channel_valid;
ALTER TABLE omni_conversations DROP CONSTRAINT IF EXISTS omni_conversations_channel_valid;
ALTER TABLE omni_conversations
  ADD CONSTRAINT omni_conversations_channel_valid
  CHECK (channel IN ('ml', 'wa', 'email', 'facebook', 'instagram', 'omnicrm'));

-- Same drift likely affects omni_deals.source_channel; realign it too (superset, safe).
ALTER TABLE omni_deals DROP CONSTRAINT IF EXISTS omni_deals_source_channel_valid;
ALTER TABLE omni_deals
  ADD CONSTRAINT omni_deals_source_channel_valid
  CHECK (source_channel IS NULL OR source_channel IN ('ml', 'wa', 'email', 'facebook', 'instagram', 'omnicrm'));
