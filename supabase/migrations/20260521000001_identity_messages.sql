-- Internal messages: threads, members, and individual messages
-- under the identity.* schema, owned by users. Supports simple group
-- threads (2+ members) with unread tracking per-member.
-- Applied to project htnwozvopveibwppyjhg on 2026-05-20 via Supabase MCP.

CREATE TABLE IF NOT EXISTS identity.message_threads (
  thread_id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  subject text NOT NULL,
  created_by uuid REFERENCES identity.users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_threads_last_message_idx
  ON identity.message_threads (last_message_at DESC);

CREATE TABLE IF NOT EXISTS identity.message_thread_members (
  thread_id uuid NOT NULL REFERENCES identity.message_threads(thread_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS thread_members_user_idx
  ON identity.message_thread_members (user_id);

CREATE TABLE IF NOT EXISTS identity.messages (
  message_id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  thread_id uuid NOT NULL REFERENCES identity.message_threads(thread_id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_thread_idx
  ON identity.messages (thread_id, created_at DESC);

ALTER TABLE identity.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.message_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.messages ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE identity.message_threads IS 'Internal conversation threads between BMC users';
COMMENT ON TABLE identity.message_thread_members IS 'Per-user membership + last-read timestamp for unread count';
COMMENT ON TABLE identity.messages IS 'Individual messages in a thread';
