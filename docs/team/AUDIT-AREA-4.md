# Área 4 audit — KB / chat / conversations / feedback data flows

> Inventory of where Área 4 data lives today so the v1.3 Fase 2 migration
> to Supabase + pgvector can be planned without surprises.
>
> **Generated:** 2026-04-29 (v1.3 Fase 0 #2 deliverable).

## Module inventory

### `server/lib/knowledgeLoader.js` — markdown KB
- **Source:** `data/knowledge/*.md` (5 files: encuentros-tecnicos, fichas-tecnicas, mantenimiento-y-comparativas, preguntas-frecuentes-clientes, proceso-constructivo)
- **Format:** concatenated string `### [DOC: <filename>]\n<content>\n\n---\n\n…`
- **Cache:** 60s in-memory (`KNOWLEDGE_CACHE_TTL_MS`)
- **Read by:** `chatPrompts.buildSystemPrompt()` per chat request
- **Persistence:** local disk only — manual edits committed to repo

### `server/lib/chatPrompts.js` — system prompt builder
- **Pure function** — no persistence
- Assembles: identity + catalog (from `src/data/constants.js`) + KB excerpt + training examples + calcState + recent assistant turns
- Per-channel overrides (`chat`/`ml`/`wa`)
- `sanitizeForPrompt()` strips control chars / injection vectors

### `server/lib/agentCore.js` — multi-provider chat
- Provider chain: `claude → openai → grok → gemini`
- Calls `findRelevantExamples()` (KB), `buildSystemPrompt()`, then provider
- Returns `{ text, provider }`
- No persistence — invoked from `agentChat`, `suggestResponse`, WA auto-trigger

### `server/lib/conversationLog.js` — conversation events
- **Format:** JSONL, daily files at `data/conversations/CONV-YYYY-MM-DD.jsonl`
- **Event types:** `meta`, `turn`, `action`, `close`
- **Index:** `_convFilesById` Map (in-memory) maps `conversationId → file paths`; rebuilt when file mtime/size changes
- **Reads:** `loadConversations({days, page, limit})`, `loadConversationById(id)`
- **Writes:** `logConversationMeta`, `logConversationTurn`, `logConversationAction`, `closeConversation`
- **Current state:** directory exists, **0 bytes — no conversations recorded yet**

### `server/lib/autoLearnExtractor.js` — Q→A extraction
- Calls Claude haiku on a closed conversation, returns up to 8 `{ question, goodAnswer, badAnswer, category, confidence, rationale }` pairs
- Filters: confidence ≥ 0.70, dedup via `hasSimilarQuestion()`
- Output goes to `addTrainingEntry()` → KB

### `server/lib/responseFeedback.js` — user thumbs / corrections
- **Format:** JSONL, daily files at `data/response-feedback/FEEDBACK-YYYY-MM-DD.jsonl`
- **Event:** `{ feedbackId, ts, channel, question, generatedText, rating: good|bad|edit, correction?, comment?, convId?, rowId? }`
- On every save, also creates a KB entry via `addTrainingEntry()`:
  - `good` → status `active`, confidence 0.95, source `feedback_good`
  - `edit` → status `active`, confidence 1.0, source `feedback_edit`
  - `bad` → status `pending`, confidence 0, source `feedback_bad`
- **Current state:** directory does not exist yet (lazily created on first write)

### `server/lib/trainingKB.js` — primary KB
- **Primary store:** `data/training-kb.json` (~40 KB, 100+ entries)
- **GCS fallback:** bucket `${GCS_KB_BUCKET}` / object `${GCS_KB_OBJECT}` — written async, read on init in Cloud Run (`K_SERVICE` env detected)
- **Backups:** `data/prompt-backups/` snapshots of IDENTITY/CATALOG/WORKFLOW/ACTIONS_DOC sections
- **Cache:** 60s in-memory, invalidated on every mutation
- **Search:** `findRelevantExamples(question, {limit, threshold})` — token-overlap scoring (q×3 + context×1 + answer×1, +100 bonus for `permanent`)
- **Mutations:** `addTrainingEntry`, `updateTrainingEntry`, `approve`, `reject`, `delete`, `bulkDelete`, `bulkPatch`
- **Conflict detection:** `detectConflicts(entry)` (token-overlap N²) → stored in `conflictWith[]`
- **Freshness:** sales 30d / product 90d / conversational 180d / math never (auto-stale via `reviewDueAt`)

## Route inventory

### `POST /api/agent/chat` — `server/routes/agentChat.js`
- SSE stream of text + actions
- Auth: rate-limited (10/min public, 30/min dev), CORS-checked
- Reads: `calcState`, `messages`, KB via `findRelevantExamples()`
- Writes: 4 JSONL events per conversation (meta, turn×N, action×M, close), plus auto-learn KB inserts on conversation close

### `agentConversations.js` — admin/dashboard reads
| Endpoint | Purpose |
|---|---|
| `GET /api/agent/stats` | daily KPIs (turns, hedges, latency, providers) |
| `GET /api/agent/conversations` | paginated list of conversation summaries |
| `GET /api/agent/conversations/weekly-digest` | 7-day narrative digest |
| `POST /api/agent/conversations/analyze-batch` | AI-suggested KB entries from hedgy convos |
| `GET /api/agent/conversations/:id` | full transcript + meta |
| `GET /api/agent/conversations/:id/analysis` | cached AI pros/cons (10m TTL, max 200 entries) |

All reads go through `loadConversations()` / `loadConversationById()`.

### `agentTraining.js` — KB CRUD (admin only — `devAuth`)
17 endpoints for entry CRUD, bulk ops, approve/reject, conflicts, health (stale scan), prompt-section editing with version history, scoring config. All dispatch into `trainingKB.js` mutators.

### `agentFeedback.js` — feedback collection
- `POST /api/agent/feedback` — **public** (chat users are not authenticated). Writes JSONL + creates KB entry.
- `GET /api/agent/feedback` — admin (gated by `requireAuth` from `server/middleware/requireAuth.js`)
- `GET /api/agent/feedback/stats` — admin

## Persistence summary

| Component | Storage | Format | Size today | Lifecycle |
|---|---|---|---|---|
| Training KB | `data/training-kb.json` + GCS | JSON | ~40 KB (100+ entries) | persistent, edited via admin routes, 60s cache |
| Conversations | `data/conversations/CONV-*.jsonl` | JSONL | 0 bytes | append-only daily files, paginated reads |
| Training sessions | `data/training-sessions/SESSION-*.jsonl` | JSONL | ~5 KB/day (dev only) | append-only audit trail |
| Knowledge docs | `data/knowledge/*.md` | Markdown | ~50 KB | manual edits, 60s cache |
| Response feedback | `data/response-feedback/FEEDBACK-*.jsonl` | JSONL | 0 bytes | append-only daily files |
| Scoring config | `data/kb-score-config.json` | JSON | <1 KB | rarely changed, dev endpoint |
| Prompt backups | `data/prompt-backups/` | JSON | ~100 KB | historical section snapshots |

## Migration surface — proposed Supabase schema (Fase 2)

> Concrete table targets so Fase 2 can ship a single migration + a code
> swap (filesystem → Postgres). Names are placeholders open to ADR review.

### KB tables
- **`kb_entries`** — id, category (sales|product|math|conversational), question, good_answer, bad_answer, context, source (manual|autolearned|feedback_good|feedback_edit|feedback_bad), permanent, status (active|pending|rejected), confidence, conv_id, good_answer_ml, good_answer_wa, retrieval_count, last_retrieved_at, review_due_at, reject_reason, conflicts_with UUID[], created_at, updated_at
- **`kb_entry_embeddings`** — entry_id PK FK, question_embedding `vector(1536)`, answer_embedding `vector(1536)`, created_at. **ivfflat indexes** on both vectors.
- **`kb_documents`** — id, title, content, source (knowledge_dir|manual|imported), version, sha256_hash, created_at, updated_at. Replaces `data/knowledge/*.md`.
- **`kb_scoring_config`** — singleton row with permanent_bonus, question/context/answer match weights.
- **`kb_prompt_sections`** — singleton row per section_key (IDENTITY|CATALOG|WORKFLOW|ACTIONS_DOC), content, version, updated_at.
- **`kb_prompt_section_history`** — content snapshots per version.

### Conversation tables
- **`conversations`** — id PK, started_at, closed_at, provider, model, dev_mode, turn_count, hedge_count, actions_emitted text[]
- **`conversation_turns`** — id, conversation_id FK, turn_index, role, content, char_count, latency_ms, kb_match_count, hedge_count
- **`conversation_actions`** — id, conversation_id FK, turn_index, action_type, payload jsonb

### Feedback table
- **`response_feedback`** — id, channel (chat|wa|ml), question, generated_text, rating (good|bad|edit), correction, comment, conv_id FK, row_id, created_kb_entry_id FK, created_at

### Training session table (audit trail, optional)
- **`training_sessions`** — id, session_date, event_type, mode (production|developer), provider, conversation_id, entry_id, details jsonb, created_at

### Indexes (key ones)
- `kb_entries(status)`, `kb_entries(category)`, `kb_entries(created_at)`
- `kb_entry_embeddings.question_embedding` ivfflat
- `conversations(started_at)`, `conversations(dev_mode)`
- `conversation_turns(conversation_id)`, `conversation_actions(conversation_id)`
- `response_feedback(created_at)`, `response_feedback(rating)`, `response_feedback(channel)`

## Migration strategy outline

### Step 1 — Schema + migration scripts
- `apply_migration` in Supabase (via MCP or SQL files in `supabase/migrations/`)
- Backfill scripts:
  - `data/training-kb.json` → `kb_entries` + `kb_entry_embeddings` (compute embeddings — Claude or OpenAI text-embedding-3)
  - `data/conversations/CONV-*.jsonl` → `conversations` + `conversation_turns` + `conversation_actions`
  - `data/training-sessions/SESSION-*.jsonl` → `training_sessions`
  - `data/response-feedback/FEEDBACK-*.jsonl` → `response_feedback`
  - `data/knowledge/*.md` → `kb_documents`

### Step 2 — Code swap
- `trainingKB.js`: replace file I/O with Supabase client; replace token-overlap scoring with hybrid (token + cosine on embeddings)
- `conversationLog.js`: replace JSONL append with Supabase insert; preserve in-memory `_convFilesById` cache concept (now `_convCache`)
- `responseFeedback.js`: insert + FK to `kb_entries`
- `knowledgeLoader.js`: load from `kb_documents` table; keep 60s cache

### Step 3 — Cutover (per channel, per `D4.2` rule)
- ChatBox first → WhatsApp → MELI
- `shadow_mode` boolean column or per-channel feature flag
- Archive filesystem to GCS cold storage after 7 days of clean operation

### Step 4 — Optimization
- pgvector ivfflat tuning based on query latency
- Conflict detection: replace N² scan with materialized view or trigger
- Optional: Supabase Realtime for live admin dashboards

## Migration risks

1. **Embedding cost.** ~100 KB entries × 2 embeddings each on initial load is trivial; ongoing per-write embedding is also cheap. Per-search embedding (user question on every chat) is the hot path — needs caching.
2. **Cloud Run write amplification.** Conversation logging today writes JSONL synchronously. Postgres insert latency must stay under the SSE flush budget (~10ms p95). Consider: batched flush per turn or async write with `setImmediate`.
3. **Search semantics change.** Token-overlap returns deterministic results; cosine returns probabilistic. Some answers will move in/out of the top-N. Need a side-by-side eval set in `tests/agent-golden/` before cutover.
4. **GCS dual-write removal.** The current `trainingKB` writes both local and GCS. After migration, both go away — no transitional fallback. Need a "freeze KB during cutover" window or read-only mode.
5. **Public feedback POST.** `/api/agent/feedback` is intentionally unauthenticated. Migration must preserve this — RLS policies should `INSERT` allow `anon` but `SELECT/UPDATE/DELETE` only `service_role`.

## Bridge from current state (per v1.3 plan §"Puente desde código actual")

| Today | Target | Cutover criterion |
|---|---|---|
| `training-kb.json` + GCS | `kb_entries` + `kb_entry_embeddings` | "7 días sin lectura GCS KB" |
| Daily JSONL conversations | `conversations` + `conversation_turns` + `conversation_actions` | Same 7-day window |
| `addTrainingEntry()` | Supabase RPC + same shape | Replace inline |
| `findRelevantExamples()` token-overlap | Hybrid retrieval (token + cosine) | Side-by-side eval > parity |

## Related docs

- `docs/team/PROJECT-STATE.md` — current live state
- `docs/EXTERNAL-CONNECTIONS.md` — visual map of where data flows
- `/Users/matias/.cursor/plans/telemetry_kb_autolearn_41450d75.plan.md` — v1.3 master roadmap
- (Future) `docs/adr/0001-source-of-truth-post-supabase.md` — ADR pending Fase 0 #4
