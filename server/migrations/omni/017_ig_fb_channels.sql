-- Gap 3 — add short channel IDs for Instagram DM and Facebook Messenger.
-- Idempotent: replaces the conversations channel CHECK only when present.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'omni_conversations_channel_valid'
       AND conrelid = 'omni_conversations'::regclass
  ) THEN
    ALTER TABLE omni_conversations DROP CONSTRAINT omni_conversations_channel_valid;
  END IF;

  ALTER TABLE omni_conversations
    ADD CONSTRAINT omni_conversations_channel_valid CHECK (
      channel IN ('ml', 'wa', 'email', 'ig', 'fb', 'facebook', 'instagram', 'omnicrm')
    );
END $$;
