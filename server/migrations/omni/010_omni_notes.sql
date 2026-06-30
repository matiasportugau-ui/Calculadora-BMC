-- 010_omni_notes.sql — internal operator notes on a conversation.
--
-- Notes are team collaboration ("called the client, waiting on the PO #") and
-- are NEVER sent to the customer — distinct from omni_messages, which are the
-- actual inbound/outbound thread. author_user_id is a soft reference to
-- identity.users.user_id (no cross-schema FK, matching the 009 convention).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS omni_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES omni_conversations(id) ON DELETE CASCADE,
  author_user_id  UUID,                 -- identity.users.user_id (soft ref)
  author_label    TEXT,                 -- email/name snapshot, for display
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT omni_notes_body_not_empty CHECK (btrim(body) <> '')
);

CREATE INDEX IF NOT EXISTS idx_omni_notes_conversation
  ON omni_notes (conversation_id, created_at DESC);

-- Track this migration (omni_schema_migrations exists from 001_core.sql).
INSERT INTO omni_schema_migrations (name) VALUES ('010_omni_notes.sql')
ON CONFLICT (name) DO NOTHING;
