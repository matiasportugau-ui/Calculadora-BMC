-- Email ingest idempotency log.
-- One row per ingested inbound email, keyed by a stable message key
-- (see server/lib/emailSnapshotIngest.js stableMessageKey). Lets the
-- unattended ingester (Cloud Run Job) run repeatedly without writing
-- duplicate leads into the CRM_Operativo sheet: POST /api/crm/ingest-email
-- skips (200) when the key already exists, inserts after a successful write.
-- Applied to project chatbot-bmc-live via Supabase MCP.

CREATE TABLE IF NOT EXISTS public.email_ingest_log (
  message_key  text PRIMARY KEY,
  account      text,
  message_id   text,
  remitente    text,
  crm_row      integer,
  ingested_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_ingest_log_ingested_at_idx
  ON public.email_ingest_log (ingested_at DESC);

COMMENT ON TABLE public.email_ingest_log IS
  'Idempotency guard for inbound email ingestion (one row per processed message_key).';
