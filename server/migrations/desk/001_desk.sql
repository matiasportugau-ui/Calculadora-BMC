-- Desk Hito 1 — Postgres como fuente de verdad (D1/D6/D10/D11)
-- Reversible: DROP TABLE IF EXISTS desk_reviews; DROP TABLE IF EXISTS matriz_snapshots;

CREATE TABLE IF NOT EXISTS matriz_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'MATRIZ',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT matriz_snapshots_version_not_empty CHECK (version ~ '^\S+$')
);

CREATE INDEX IF NOT EXISTS matriz_snapshots_created_at ON matriz_snapshots(created_at DESC);

CREATE TABLE IF NOT EXISTS desk_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID,
  conversation_id UUID REFERENCES omni_conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES omni_contacts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'wa',
  matriz_version TEXT REFERENCES matriz_snapshots(version) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  interp JSONB NOT NULL DEFAULT '{}'::jsonb,
  faltantes JSONB NOT NULL DEFAULT '[]'::jsonb,
  causa JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  wa_link TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT desk_reviews_status_valid CHECK (
    status IN ('pending', 'approved', 'sent', 'sold', 'discarded')
  ),
  CONSTRAINT desk_reviews_channel_valid CHECK (
    channel IN ('wa', 'email', 'ml', 'instagram', 'facebook', 'manual')
  )
);

CREATE INDEX IF NOT EXISTS desk_reviews_status ON desk_reviews(status);
CREATE INDEX IF NOT EXISTS desk_reviews_updated_at ON desk_reviews(updated_at DESC);
CREATE INDEX IF NOT EXISTS desk_reviews_conversation ON desk_reviews(conversation_id) WHERE conversation_id IS NOT NULL;
