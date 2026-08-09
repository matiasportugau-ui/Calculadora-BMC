-- BMC Envíos P5 — durable multi-device drafts for /logistica
-- Applied lazily by ensureEnviosSchema() on first API use; this file is the SoT.

CREATE TABLE IF NOT EXISTS envios_drafts (
  id TEXT PRIMARY KEY,
  env_no TEXT NOT NULL,
  payload JSONB NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS envios_drafts_updated_at_idx ON envios_drafts (updated_at DESC);
CREATE INDEX IF NOT EXISTS envios_drafts_env_no_idx ON envios_drafts (env_no);
