-- 0002_quote_embeddings_provider.sql — tag each quote_embeddings row with the
-- embedding provider that produced its vector ("openai" or "stub").
--
-- Why: embedText() falls back to a deterministic NON-SEMANTIC stub when no real
-- embedding key is configured. Stub vectors still return (garbage) nearest
-- neighbours, so a backfill done without a key would pass a naive "table
-- populated + sample retrieval" pre-check and ground suggestions on noise.
-- Recording the provider lets `npm run omni:rag-precheck` refuse to enable RAG
-- unless every embedded row was created with a semantic provider.
--
-- Idempotent. Apply with: psql "$DATABASE_URL" -f migrations/0002_quote_embeddings_provider.sql

ALTER TABLE quote_embeddings ADD COLUMN IF NOT EXISTS provider TEXT;
