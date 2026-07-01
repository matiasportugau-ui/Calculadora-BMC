-- 013_contact_merge_log.sql — audit trail for contact merges (Wave 6b).
--
-- mergeContacts() (server/lib/omni/identity/contactMerge.js) NEVER hard-deletes
-- the "loser" contact — omni_contacts has CASCADE DELETE into omni_conversations
-- and omni_deals (and from there into messages/suggestions/ai_jobs/notes/
-- frt_breaches), so a literal DELETE would destroy the very history a merge is
-- meant to preserve. Instead it repoints those two FKs and soft-archives the
-- loser via properties.merged_into. This table is the structured, queryable
-- record of every merge performed: who did it, when, which two contacts, and
-- how many rows were repointed — both for accountability and so a mistaken
-- merge can be reasoned about (and reversed by hand) after the fact.
--
-- No ON DELETE clause on either FK (defaults to NO ACTION): since merged
-- contacts are never deleted, this also acts as a guard against any future
-- code path accidentally hard-deleting a contact that has merge history.
--
-- Idempotent. Apply with: npm run omni:migrate.

CREATE TABLE IF NOT EXISTS omni_contact_merge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merged_from_id UUID NOT NULL REFERENCES omni_contacts(id),
  merged_into_id UUID NOT NULL REFERENCES omni_contacts(id),
  performed_by_user_id UUID,
  conversations_repointed INT NOT NULL DEFAULT 0,
  deals_repointed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS omni_contact_merge_log_into_idx
  ON omni_contact_merge_log (merged_into_id);
CREATE INDEX IF NOT EXISTS omni_contact_merge_log_from_idx
  ON omni_contact_merge_log (merged_from_id);
