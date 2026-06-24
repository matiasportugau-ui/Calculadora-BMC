-- Patch: omni_deals pre-dated WAVE 4 without properties JSONB
ALTER TABLE omni_deals
  ADD COLUMN IF NOT EXISTS properties JSONB NOT NULL DEFAULT '{}'::JSONB;
