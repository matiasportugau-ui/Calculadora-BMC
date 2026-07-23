# Evidence — data model (R2)

**Date:** 2026-07-23

## Postgres / pgvector (RAG)

**Source:** `migrations/0001_add_pgvector_and_quote_embeddings.sql:41-65`, `0002_quote_embeddings_provider.sql`

| Object | Notes |
|--------|-------|
| Extension | `vector` (pgvector) |
| Table | `quote_embeddings` |
| Columns | `lead_id` UNIQUE, `content_hash`, `embedding vector(1536)`, `text_for_embedding`, `metadata` JSONB, timestamps; provider column in 0002 |
| Index | ivfflat cosine `lists=100` |

Runtime: `rag.js` cosine retrieve; `embeddings.js` OpenAI `text-embedding-3-small` or deterministic stub 1536-d.  
**Default:** `RAG_ENABLED=false` (`config.js:335`) — RAG code exists; prod readiness requires env + embed batch.

## Training KB (file / GCS)

**Source:** `trainingKB.js`

- Local JSON KB under repo/runtime paths; optional GCS sync.
- Surfaces via `kbSurface.js`: `panelin_chat`, ML, WA, email, wolfboard.
- Analytics: `kbAnalytics.js` miss/coverage events.

## Quote registry (agent quotes)

**Source:** `quoteRegistry.js` + `AE-AGENT-CALC-CONTRACT.md`

- GCS-backed when `GCS_QUOTES_BUCKET` set; else in-memory.
- Provenance `source: "ae_agent"` for tool-originated quotes.
- Kinds: `calc_only` vs PDF-canonical.

## Omni / assistants runtime

- Omni AI jobs / suggestions: Postgres `omni_*` tables (when Omni enabled).
- Assistant enable overrides: `wa_settings` key `assistants` (LISTEN/NOTIFY cache) — `assistantRegistry.js:134-142`.

## Brain lessons (optional)

- GCS `BRAIN_GCS_BUCKET` / `BRAIN_GCS_OBJECT` when `VITE_FEATURE_BRAIN` on — `brainKB.js`.
- Default feature off — UNKNOWN if prod-enabled.

## Agent tool telemetry (durable + memory)

**Source:** B-05 2026-07-22 — `server/migrations/agent/001_agent_tool_calls.sql`, `toolStats.js`

| Store | Module | Notes |
|-------|--------|-------|
| `public.agent_tool_calls` | Postgres when `DATABASE_URL` | Dual-write from `recordToolCall`; `GET /api/agent/tool-stats` via `getToolStatsAsync` (`source: db\|memory`) |
| In-memory ring | `toolStats.js` | Hot cache; cold-start fallback |
| Voice error log | voice routes | Still mostly ephemeral — IMP-09 |
| Conversation files (optional) | `CHAT_LOG_CONVERSATIONS` | Disk / ops |
