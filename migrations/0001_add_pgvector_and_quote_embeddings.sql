-- ============================================================
-- Migración 0001: pgvector + quote_embeddings (RAG v1)
-- ============================================================
-- Prerequisito: la extensión pgvector debe estar disponible
-- en el servidor Postgres. Ver migrations/README.md para
-- instrucciones por provider.
--
-- Cómo correr esta migración:
--   psql "$DATABASE_URL" -f migrations/0001_add_pgvector_and_quote_embeddings.sql
--
-- Es idempotente: usa IF NOT EXISTS en todas las operaciones.
-- Re-correr no produce errores ni duplica datos.
-- ============================================================

BEGIN;

-- 1. Tabla de tracking de migraciones (compartida con futuros SQLs)
CREATE TABLE IF NOT EXISTS bmc_schema_migrations (
  name       TEXT        PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Habilitar pgvector
--    Si falla aquí es porque pgvector no está instalado en el servidor.
--    Ver migrations/README.md § Prerequisito: pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 3. Tabla de embeddings
--
--    lead_id        — coincide con el campo lead_id del JSONL normalizado
--                     (SHA-1 del filepath, 16 chars hex).
--    content_hash   — sha256 del texto embebido. Usado por embedQuotes.js
--                     para detectar cambios y evitar re-embebido innecesario.
--    embedding      — vector de 1536 dimensiones (OpenAI text-embedding-3-small
--                     o stub determinístico del mismo tamaño). NULL hasta que
--                     se corre el primer embedQuotes batch.
--    text_for_embedding — texto legible que se envía al modelo de embeddings.
--                         Se conserva para debugging y re-embebido con otro modelo.
--    metadata       — lead JSON original completo (todos los campos del JSONL).
--                     Permite reconstruir el contexto sin volver al archivo.
CREATE TABLE IF NOT EXISTS quote_embeddings (
  id                 BIGSERIAL    PRIMARY KEY,
  lead_id            TEXT         NOT NULL UNIQUE,
  content_hash       TEXT         NOT NULL,
  embedding          vector(1536),                       -- nullable hasta primer embed
  text_for_embedding TEXT         NOT NULL,
  metadata           JSONB        NOT NULL,
  created_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 4. Índice ivfflat para búsqueda coseno eficiente
--
--    lists=100 es apropiado para hasta ~1M vectores.
--    Para <50k vectores (como en el RAG v1 inicial con ~11.8k leads)
--    un valor de 50-100 está bien. Ajustar con REINDEX si el corpus crece.
--
--    NOTA: El índice solo puede crearse sobre columnas NOT NULL.
--    Como embedding es nullable, el índice se crea sin el WHERE IS NOT NULL
--    para que Postgres use el índice parcial automáticamente.
--    pgvector ignora NULL en el índice ivfflat por diseño.
CREATE INDEX IF NOT EXISTS idx_quote_embeddings_ivfflat
  ON quote_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 5. Índice en lead_id para upserts rápidos
CREATE INDEX IF NOT EXISTS idx_quote_embeddings_lead_id
  ON quote_embeddings (lead_id);

-- 6. Registrar la migración
INSERT INTO bmc_schema_migrations (name)
VALUES ('0001_add_pgvector_and_quote_embeddings')
ON CONFLICT (name) DO NOTHING;

COMMIT;
