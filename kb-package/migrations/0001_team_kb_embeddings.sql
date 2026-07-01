-- ============================================================
-- Migración 0001: team_kb_embeddings (federated KB access layer)
-- ============================================================
-- Prerequisito: la extensión pgvector debe estar disponible en el servidor
-- Postgres (misma extensión que usa migrations/0001_add_pgvector_and_quote_embeddings.sql
-- para quote_embeddings). Ver ese archivo si pgvector aún no está habilitado.
--
-- Cómo correr esta migración:
--   DATABASE_URL=postgres://... npm run kb:migrate
--
-- Es idempotente: usa IF NOT EXISTS en todas las operaciones. Re-correr no
-- produce errores ni duplica datos. Tracking propio (kb_schema_migrations),
-- no comparte tabla de tracking con traktime/wa/transportista/omni.
--
-- Propósito: corpus semántico para docs/team/knowledge/<rol>.md y las entradas
-- de docs/team/PROJECT-STATE.md ("Cambios recientes"), consumido por
-- server/lib/kbAccess.js. Tabla nueva y aislada — no toca quote_embeddings
-- (datos de producción) ni training-kb.json (pipeline de chat/CRM en vivo).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS kb_schema_migrations (
  name       TEXT        PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS vector;

-- team_kb_embeddings
--
--   source_path  — ruta relativa al repo del documento origen
--                  (ej. 'docs/team/knowledge/Security.md' o 'docs/team/PROJECT-STATE.md').
--   chunk_index  — índice del chunk dentro del documento (0-based). Para
--                  PROJECT-STATE.md, cada entrada fechada de "Cambios recientes"
--                  es su propio chunk_index.
--   domain       — etiqueta de dominio para scoping por rol/agente
--                  (ej. 'security_finding', 'pricing_decision', 'project_state').
--                  Ver server/lib/kbDomains.js para el mapeo canónico.
--   content_hash — sha256 del texto embebido (mismo helper que embeddings.js
--                  usa para quote_embeddings). Permite upsert idempotente:
--                  re-ingerir un doc sin cambios no duplica ni re-embebe filas.
--   embedding    — vector de 1536 dimensiones (mismo shape que quote_embeddings,
--                  generado por el mismo server/lib/embeddings.js:embedText()).
--   text         — texto legible del chunk, se inyecta tal cual en el prompt.
CREATE TABLE IF NOT EXISTS team_kb_embeddings (
  id            BIGSERIAL    PRIMARY KEY,
  source_path   TEXT         NOT NULL,
  chunk_index   INT          NOT NULL,
  domain        VARCHAR(50)  NOT NULL,
  content_hash  TEXT         NOT NULL,
  embedding     vector(1536),                    -- nullable hasta el primer ingest
  text          TEXT         NOT NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  UNIQUE (source_path, chunk_index)
);

-- Índice ivfflat para búsqueda coseno. lists=20 es apropiado para un corpus
-- chico (~30 archivos de knowledge + entradas de PROJECT-STATE, muy por
-- debajo del umbral de ~1M vectores que justificaría lists=100 (ver
-- migrations/0001_add_pgvector_and_quote_embeddings.sql). Reajustar con
-- REINDEX si el corpus crece significativamente.
CREATE INDEX IF NOT EXISTS idx_team_kb_embeddings_ivfflat
  ON team_kb_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 20);

-- Índice de dominio para el filtro de scoping por rol (WHERE domain = $n)
-- antes de aplicar la búsqueda vectorial.
CREATE INDEX IF NOT EXISTS idx_team_kb_embeddings_domain
  ON team_kb_embeddings (domain);

INSERT INTO kb_schema_migrations (name)
VALUES ('0001_team_kb_embeddings')
ON CONFLICT (name) DO NOTHING;

COMMIT;
