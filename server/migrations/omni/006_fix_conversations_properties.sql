-- 006_fix_conversations_properties.sql
-- Migration-drift repair: production applied an older 001_core that predates the
-- omni_conversations.properties column, and since 001 is marked applied it never
-- got the column. The normalizer (normalizeAndPersist) INSERTs `properties`, so
-- every omni ingest / shadow-write was failing in prod with:
--   column "properties" of relation "omni_conversations" does not exist
-- (shadowPersist swallows the error, so it failed silently.)
-- Idempotent forward-fix so all environments converge.

ALTER TABLE omni_conversations
  ADD COLUMN IF NOT EXISTS properties JSONB NOT NULL DEFAULT '{}'::jsonb;
