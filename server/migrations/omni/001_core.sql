-- Omni Core — cross-channel inbox graph (WAVE 1 / Track A1)
-- Based on docs/team/omni-hub-schema.sql with email channel + ingest dedup

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS omni_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_uuid VARCHAR(255) UNIQUE NOT NULL,
  ml_user_id BIGINT UNIQUE,
  wa_phone VARCHAR(32) UNIQUE,
  chrome_ext_contact_id VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(32),
  avatar_url VARCHAR(1024),
  properties JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT omni_contacts_integration_uuid_not_empty CHECK (integration_uuid ~ '^\S+$')
);

CREATE INDEX IF NOT EXISTS omni_contacts_ml_user_id ON omni_contacts(ml_user_id) WHERE ml_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS omni_contacts_wa_phone ON omni_contacts(wa_phone) WHERE wa_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS omni_contacts_email ON omni_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS omni_contacts_updated_at ON omni_contacts(updated_at);

CREATE TABLE IF NOT EXISTS omni_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES omni_contacts(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL,
  channel_conversation_id VARCHAR(255) NOT NULL,
  subject VARCHAR(512),
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  priority INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  properties JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT omni_conversations_channel_valid CHECK (
    channel IN ('ml', 'wa', 'email', 'facebook', 'instagram', 'omnicrm')
  ),
  CONSTRAINT omni_conversations_channel_conversation_id_not_empty CHECK (channel_conversation_id ~ '^\S+$'),
  CONSTRAINT omni_conversations_unique_channel UNIQUE (contact_id, channel, channel_conversation_id)
);

CREATE INDEX IF NOT EXISTS omni_conversations_contact_id ON omni_conversations(contact_id);
CREATE INDEX IF NOT EXISTS omni_conversations_channel ON omni_conversations(channel);
CREATE INDEX IF NOT EXISTS omni_conversations_status ON omni_conversations(status);
CREATE INDEX IF NOT EXISTS omni_conversations_updated_at ON omni_conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS omni_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES omni_conversations(id) ON DELETE CASCADE,
  sender VARCHAR(50) NOT NULL,
  sender_id VARCHAR(255),
  body TEXT NOT NULL,
  body_ai_category VARCHAR(100),
  attachments JSONB DEFAULT '[]'::JSONB,
  metadata JSONB DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT omni_messages_sender_valid CHECK (sender IN ('bot', 'customer', 'agent')),
  CONSTRAINT omni_messages_body_not_empty CHECK (body ~ '\S')
);

CREATE INDEX IF NOT EXISTS omni_messages_conversation_id ON omni_messages(conversation_id);
CREATE INDEX IF NOT EXISTS omni_messages_created_at ON omni_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS omni_ingest_dedup (
  idempotency_key VARCHAR(512) PRIMARY KEY,
  message_id UUID REFERENCES omni_messages(id) ON DELETE SET NULL,
  channel VARCHAR(50),
  source VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS omni_ingest_dedup_created_at ON omni_ingest_dedup(created_at DESC);

CREATE TABLE IF NOT EXISTS omni_schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
