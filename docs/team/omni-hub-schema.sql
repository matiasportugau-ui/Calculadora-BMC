/**
 * Omni-Hub Data Model - Unified Cross-Channel Contact & Conversation Management
 *
 * This schema enables:
 * - Contact deduplication across MercadoLibre, WhatsApp, Facebook, Instagram, omnicrm-sync
 * - Unified conversation threading by contact + channel
 * - AI-classified message categorization for smart routing
 * - Cross-channel deal/opportunity tracking
 * - Rich audit trail and metadata storage
 *
 * Design principles:
 * - UUID primary keys for distributed system safety
 * - JSONB for channel-specific extensibility
 * - Unique constraints on channel identifiers (with WHERE IS NOT NULL for sparse columns)
 * - Cascading deletes to maintain referential integrity
 * - Explicit timestamps for audit and business logic
 */

-- ============================================================================
-- OMNI_CONTACTS: Unified contact repository with cross-channel deduplication
-- ============================================================================

CREATE TABLE omni_contacts (
  -- Identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cross-channel unique identifiers (sparse - only one per contact may be populated)
  integration_uuid VARCHAR(255) UNIQUE NOT NULL,
    -- Global unique ID issued by omni system or synced from primary channel
  ml_user_id BIGINT UNIQUE,
    -- MercadoLibre user ID (if contact originated from ML)
  wa_phone VARCHAR(20) UNIQUE,
    -- WhatsApp phone in E.164 format (e.g., +12125551234)
  chrome_ext_contact_id VARCHAR(255) UNIQUE,
    -- omnicrm-sync contact ID (if synced from CRM extension)

  -- Contact attributes
  name VARCHAR(255),
    -- Contact display name (may be sourced from any channel)
  email VARCHAR(255),
    -- Primary email (deduplicated across channels)
  phone VARCHAR(20),
    -- Primary phone (may differ from wa_phone if multi-channel)
  avatar_url VARCHAR(1024),
    -- Profile picture URL (union of all channel avatars; front-end picks latest)

  -- Channel-specific and custom properties
  properties JSONB DEFAULT '{}'::JSONB,
    -- Extensible channel properties: {
    --   "ml": { "reputation": 4.5, "closed_operations": 120, "status": "gold" },
    --   "wa": { "message_count": 15, "group_id": "..." },
    --   "omnicrm": { "custom_field_1": "...", "source": "shopify" }
    -- }

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT integration_uuid_not_empty CHECK (integration_uuid ~ '^\S+$')
);

CREATE INDEX omni_contacts_ml_user_id ON omni_contacts(ml_user_id) WHERE ml_user_id IS NOT NULL;
CREATE INDEX omni_contacts_wa_phone ON omni_contacts(wa_phone) WHERE wa_phone IS NOT NULL;
CREATE INDEX omni_contacts_email ON omni_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX omni_contacts_updated_at ON omni_contacts(updated_at);

-- ============================================================================
-- OMNI_CONVERSATIONS: Channel-specific conversation threads per contact
-- ============================================================================

CREATE TABLE omni_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact reference
  contact_id UUID NOT NULL REFERENCES omni_contacts(id) ON DELETE CASCADE,

  -- Channel identity
  channel VARCHAR(50) NOT NULL,
    -- Allowed values: 'ml', 'wa', 'facebook', 'instagram', 'omnicrm'
  channel_conversation_id VARCHAR(255) NOT NULL,
    -- Native channel conversation ID (e.g., MercadoLibre question ID, WhatsApp chat ID)

  CONSTRAINT channel_valid CHECK (channel IN ('ml', 'wa', 'facebook', 'instagram', 'omnicrm')),
  CONSTRAINT channel_conversation_id_not_empty CHECK (channel_conversation_id ~ '^\S+$'),

  -- Conversation metadata
  subject VARCHAR(512),
    -- Conversation title/subject (for ML questions, thread titles)
  status VARCHAR(50) NOT NULL DEFAULT 'open',
    -- Allowed values: 'open', 'resolved', 'archived', 'pending_response'
  priority INTEGER DEFAULT 0,
    -- Business priority: 0 (low), 1 (normal), 2 (high), 3 (urgent)
  tags TEXT[] DEFAULT '{}',
    -- Searchable tags: {'vip', 'complaint', 'bulk_inquiry', 'returns', ...}

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Unique per channel
  CONSTRAINT unique_channel_conversation UNIQUE (contact_id, channel, channel_conversation_id)
);

CREATE INDEX omni_conversations_contact_id ON omni_conversations(contact_id);
CREATE INDEX omni_conversations_channel ON omni_conversations(channel);
CREATE INDEX omni_conversations_status ON omni_conversations(status);
CREATE INDEX omni_conversations_priority ON omni_conversations(priority DESC);
CREATE INDEX omni_conversations_updated_at ON omni_conversations(updated_at DESC);
CREATE INDEX omni_conversations_tags ON omni_conversations USING GIN(tags);

-- ============================================================================
-- OMNI_MESSAGES: Individual messages within conversations
-- ============================================================================

CREATE TABLE omni_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Conversation reference
  conversation_id UUID NOT NULL REFERENCES omni_conversations(id) ON DELETE CASCADE,

  -- Message source
  sender VARCHAR(50) NOT NULL,
    -- Allowed values: 'bot', 'customer', 'agent'
  sender_id VARCHAR(255),
    -- User/agent identifier: user ID, email, phone, etc. (optional but recommended)

  CONSTRAINT sender_valid CHECK (sender IN ('bot', 'customer', 'agent')),

  -- Message content
  body TEXT NOT NULL,
    -- Plain text message content
  body_ai_category VARCHAR(100),
    -- Auto-classified message category for routing/analytics:
    -- 'product', 'order', 'issue', 'inquiry', 'complaint', 'feedback', 'spam', 'other'

  -- Attachments and metadata
  attachments JSONB DEFAULT '[]'::JSONB,
    -- Array of file objects: [
    --   { "name": "invoice.pdf", "url": "s3://...", "mime_type": "application/pdf" }
    -- ]
  metadata JSONB DEFAULT '{}'::JSONB,
    -- Channel-specific metadata: {
    --   "ml": { "question_id": "...", "item_id": "..." },
    --   "wa": { "message_id": "...", "timestamp": 1234567890 },
    --   "facebook": { "post_id": "...", "comment_id": "..." }
    -- }

  -- Message state
  read_at TIMESTAMP,
    -- When message was read by recipient (if applicable)

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT body_not_empty CHECK (body ~ '\S'),
  CONSTRAINT body_ai_category_valid CHECK (
    body_ai_category IS NULL OR
    body_ai_category IN ('product', 'order', 'issue', 'inquiry', 'complaint', 'feedback', 'spam', 'other')
  )
);

CREATE INDEX omni_messages_conversation_id ON omni_messages(conversation_id);
CREATE INDEX omni_messages_sender ON omni_messages(sender);
CREATE INDEX omni_messages_body_ai_category ON omni_messages(body_ai_category);
CREATE INDEX omni_messages_created_at ON omni_messages(created_at DESC);
CREATE INDEX omni_messages_read_at ON omni_messages(read_at) WHERE read_at IS NOT NULL;

-- ============================================================================
-- OMNI_DEALS: Cross-channel opportunities and pipeline management
-- ============================================================================

CREATE TABLE omni_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact reference
  contact_id UUID NOT NULL REFERENCES omni_contacts(id) ON DELETE CASCADE,

  -- Deal identity
  title VARCHAR(512) NOT NULL,
    -- Deal/opportunity title (e.g., "Bulk order - 50 units")
  value_usd DECIMAL(12, 2),
    -- Deal value in USD (nullable for inquiry-stage deals)

  -- Deal lifecycle
  stage VARCHAR(50) NOT NULL DEFAULT 'lead',
    -- Allowed values: 'lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
  source_channel VARCHAR(50),
    -- Which channel originated the deal: 'ml', 'wa', 'facebook', 'instagram', 'omnicrm'
  source_conversation_id UUID REFERENCES omni_conversations(id) ON DELETE SET NULL,
    -- Link to originating conversation thread (if applicable)

  CONSTRAINT stage_valid CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  CONSTRAINT source_channel_valid CHECK (source_channel IS NULL OR source_channel IN ('ml', 'wa', 'facebook', 'instagram', 'omnicrm')),
  CONSTRAINT value_positive CHECK (value_usd IS NULL OR value_usd > 0),

  -- Assignment
  owner_agent_id VARCHAR(255),
    -- Assigned agent ID (if deal is assigned; nullable for unassigned leads)

  -- Timeline
  expected_close_date DATE,
    -- Expected closing date (for forecasting)
  closed_at TIMESTAMP,
    -- When deal was closed (won or lost)

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX omni_deals_contact_id ON omni_deals(contact_id);
CREATE INDEX omni_deals_stage ON omni_deals(stage);
CREATE INDEX omni_deals_contact_stage ON omni_deals(contact_id, stage);
CREATE INDEX omni_deals_source_channel ON omni_deals(source_channel);
CREATE INDEX omni_deals_owner_agent_id ON omni_deals(owner_agent_id) WHERE owner_agent_id IS NOT NULL;
CREATE INDEX omni_deals_expected_close_date ON omni_deals(expected_close_date) WHERE expected_close_date IS NOT NULL;
CREATE INDEX omni_deals_updated_at ON omni_deals(updated_at DESC);

-- ============================================================================
-- AUDIT TABLE: Immutable event log for compliance and debugging
-- ============================================================================

CREATE TABLE omni_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event metadata
  entity_type VARCHAR(50) NOT NULL,
    -- Table name: 'omni_contacts', 'omni_conversations', etc.
  entity_id UUID NOT NULL,
    -- Primary key of affected row
  operation VARCHAR(10) NOT NULL,
    -- Allowed values: 'INSERT', 'UPDATE', 'DELETE'

  CONSTRAINT entity_type_valid CHECK (entity_type IN ('omni_contacts', 'omni_conversations', 'omni_messages', 'omni_deals')),
  CONSTRAINT operation_valid CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),

  -- Change details
  old_values JSONB,
    -- Previous state (NULL for INSERT)
  new_values JSONB,
    -- New state (NULL for DELETE)
  changed_columns TEXT[],
    -- List of column names that changed

  -- Actor and context
  changed_by VARCHAR(255),
    -- User/system that made the change
  change_reason VARCHAR(512),
    -- Optional reason/comment for the change

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX omni_audit_log_entity ON omni_audit_log(entity_type, entity_id);
CREATE INDEX omni_audit_log_operation ON omni_audit_log(operation);
CREATE INDEX omni_audit_log_created_at ON omni_audit_log(created_at DESC);
CREATE INDEX omni_audit_log_changed_by ON omni_audit_log(changed_by) WHERE changed_by IS NOT NULL;

-- ============================================================================
-- TRIGGER: Auto-update updated_at on omni_contacts
-- ============================================================================

CREATE OR REPLACE FUNCTION update_omni_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER omni_contacts_updated_at_trigger
BEFORE UPDATE ON omni_contacts
FOR EACH ROW
EXECUTE FUNCTION update_omni_contacts_updated_at();

-- ============================================================================
-- TRIGGER: Auto-update updated_at on omni_conversations
-- ============================================================================

CREATE OR REPLACE FUNCTION update_omni_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER omni_conversations_updated_at_trigger
BEFORE UPDATE ON omni_conversations
FOR EACH ROW
EXECUTE FUNCTION update_omni_conversations_updated_at();

-- ============================================================================
-- TRIGGER: Auto-update updated_at on omni_deals
-- ============================================================================

CREATE OR REPLACE FUNCTION update_omni_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER omni_deals_updated_at_trigger
BEFORE UPDATE ON omni_deals
FOR EACH ROW
EXECUTE FUNCTION update_omni_deals_updated_at();

-- ============================================================================
-- HELPER VIEWS: Common queries
-- ============================================================================

-- View: Active conversations requiring attention
CREATE VIEW omni_conversations_active AS
SELECT
  c.id,
  c.contact_id,
  co.name AS contact_name,
  co.email,
  c.channel,
  c.subject,
  c.status,
  c.priority,
  COUNT(m.id) AS message_count,
  MAX(m.created_at) AS last_message_at,
  c.updated_at
FROM omni_conversations c
JOIN omni_contacts co ON c.contact_id = co.id
LEFT JOIN omni_messages m ON c.id = m.conversation_id
WHERE c.status != 'archived'
GROUP BY c.id, c.contact_id, co.name, co.email, c.channel, c.subject, c.status, c.priority, c.updated_at
ORDER BY c.priority DESC, c.updated_at DESC;

-- View: Open deals by stage
CREATE VIEW omni_deals_pipeline AS
SELECT
  d.id,
  d.contact_id,
  co.name AS contact_name,
  d.title,
  d.value_usd,
  d.stage,
  d.source_channel,
  d.owner_agent_id,
  d.expected_close_date,
  d.created_at
FROM omni_deals d
JOIN omni_contacts co ON d.contact_id = co.id
WHERE d.stage NOT IN ('closed_won', 'closed_lost')
ORDER BY d.stage ASC, d.expected_close_date ASC;

-- View: Contact summary with channel presence
CREATE VIEW omni_contacts_summary AS
SELECT
  c.id,
  c.name,
  c.email,
  c.phone,
  COUNT(DISTINCT CASE WHEN c.ml_user_id IS NOT NULL THEN 'ml' END) AS has_ml,
  COUNT(DISTINCT CASE WHEN c.wa_phone IS NOT NULL THEN 'wa' END) AS has_wa,
  COUNT(DISTINCT CASE WHEN c.chrome_ext_contact_id IS NOT NULL THEN 'omnicrm' END) AS has_omnicrm,
  COUNT(DISTINCT conv.id) AS conversation_count,
  COUNT(DISTINCT CASE WHEN conv.status = 'open' THEN conv.id END) AS open_conversations,
  COUNT(DISTINCT d.id) AS deal_count,
  COUNT(DISTINCT CASE WHEN d.stage NOT IN ('closed_won', 'closed_lost') THEN d.id END) AS active_deals,
  MAX(conv.updated_at) AS last_activity_at,
  c.updated_at
FROM omni_contacts c
LEFT JOIN omni_conversations conv ON c.id = conv.contact_id
LEFT JOIN omni_deals d ON c.id = d.contact_id
GROUP BY c.id, c.name, c.email, c.phone, c.updated_at
ORDER BY c.updated_at DESC;

-- ============================================================================
-- COMMENTS: Column documentation
-- ============================================================================

COMMENT ON TABLE omni_contacts IS 'Unified contact repository with cross-channel deduplication. One record per unique contact across all channels.';
COMMENT ON COLUMN omni_contacts.integration_uuid IS 'Global unique identifier issued by omni system or synced from primary channel. REQUIRED.';
COMMENT ON COLUMN omni_contacts.ml_user_id IS 'MercadoLibre user ID (sparse, only populated if contact has ML presence).';
COMMENT ON COLUMN omni_contacts.wa_phone IS 'WhatsApp phone in E.164 format, e.g., +12125551234 (sparse, only populated if contact has WhatsApp presence).';
COMMENT ON COLUMN omni_contacts.properties IS 'JSONB object storing channel-specific and custom properties for extensibility.';

COMMENT ON TABLE omni_conversations IS 'Channel-specific conversation threads. One record per contact + channel combination.';
COMMENT ON COLUMN omni_conversations.channel_conversation_id IS 'Native channel conversation ID, e.g., ML question ID, WhatsApp chat ID.';
COMMENT ON COLUMN omni_conversations.status IS 'Conversation lifecycle: open, resolved, archived, pending_response.';
COMMENT ON COLUMN omni_conversations.priority IS 'Business priority: 0=low, 1=normal, 2=high, 3=urgent.';
COMMENT ON COLUMN omni_conversations.tags IS 'Searchable tags for segmentation and filtering, e.g., {vip, complaint, bulk_inquiry}.';

COMMENT ON TABLE omni_messages IS 'Individual messages within conversations. Immutable record of all communication.';
COMMENT ON COLUMN omni_messages.sender IS 'Message origin: bot (automated), customer (contact), agent (staff).';
COMMENT ON COLUMN omni_messages.body_ai_category IS 'Auto-classified by AI for smart routing: product, order, issue, inquiry, complaint, feedback, spam, other.';
COMMENT ON COLUMN omni_messages.attachments IS 'JSONB array of file objects with name, url, and mime_type.';
COMMENT ON COLUMN omni_messages.metadata IS 'JSONB object storing channel-specific fields (ML question_id, WhatsApp message_id, etc.).';

COMMENT ON TABLE omni_deals IS 'Cross-channel opportunities and pipeline management.';
COMMENT ON COLUMN omni_deals.stage IS 'Deal pipeline stage: lead, qualified, proposal, negotiation, closed_won, closed_lost.';
COMMENT ON COLUMN omni_deals.source_conversation_id IS 'Optional reference to the conversation that originated the deal.';

COMMENT ON TABLE omni_audit_log IS 'Immutable event log for compliance, debugging, and change tracking. All modifications to core omni tables are logged here.';
