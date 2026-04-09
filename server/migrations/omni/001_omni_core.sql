-- Omnicanal Meta + CRM: tablas core (Postgres)
-- Aplicar con: npm run omni:migrate (requiere DATABASE_URL u OMNI_DATABASE_URL)

CREATE TABLE IF NOT EXISTS omni_threads (
  id bigserial PRIMARY KEY,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'messenger', 'instagram')),
  external_thread_id text NOT NULL,
  contact_name text,
  mode text NOT NULL DEFAULT 'listen' CHECK (mode IN ('off', 'listen', 'auto')),
  human_active_until timestamptz,
  last_message_at timestamptz,
  pending_flush boolean NOT NULL DEFAULT false,
  last_flushed_message_id bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, external_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_omni_threads_flush ON omni_threads (pending_flush, last_message_at)
  WHERE pending_flush = true;

CREATE TABLE IF NOT EXISTS omni_messages (
  id bigserial PRIMARY KEY,
  thread_id bigint NOT NULL REFERENCES omni_threads (id) ON DELETE CASCADE,
  channel text NOT NULL,
  external_message_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body_text text,
  raw_payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  consulta_tipo text,
  classification_score numeric,
  UNIQUE (channel, external_message_id)
);

CREATE INDEX IF NOT EXISTS idx_omni_messages_thread_id_received ON omni_messages (thread_id, id);

CREATE TABLE IF NOT EXISTS omni_attachments (
  id bigserial PRIMARY KEY,
  message_id bigint NOT NULL REFERENCES omni_messages (id) ON DELETE CASCADE,
  media_kind text NOT NULL,
  whatsapp_media_id text,
  gcs_uri text,
  mime_type text,
  byte_size bigint,
  processing_status text NOT NULL DEFAULT 'pending',
  extracted_text text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omni_attachments_message ON omni_attachments (message_id);

CREATE TABLE IF NOT EXISTS omni_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS omni_outbox (
  id bigserial PRIMARY KEY,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omni_outbox_pending ON omni_outbox (status, next_run_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS omni_policy (
  consulta_tipo text PRIMARY KEY,
  allow_auto boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO omni_policy (consulta_tipo, allow_auto) VALUES
  ('general', false),
  ('precio_stock', false),
  ('reclamo', false),
  ('spam', false)
ON CONFLICT (consulta_tipo) DO NOTHING;
