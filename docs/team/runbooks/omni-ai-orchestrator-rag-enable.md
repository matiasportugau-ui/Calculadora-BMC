# Runbook — Enable Omni AI Orchestrator + RAG grounding (Phase 1)

**Goal:** turn on the Omni AI worker so inbound customer messages get an AI-drafted suggestion,
grounded in similar past quotes (RAG), staged for human approval. **Nothing auto-sends** — the
operator approves in `/hub/canales` before anything goes out.

**Owner-run / human-gated.** The code already exists and ships **dormant** (all flags default off).
This runbook flips the flags in prod after verifying the prerequisites. Phase 1 reference:
[`../INBOX-AI-FIRST-BLUEPRINT.md`](../INBOX-AI-FIRST-BLUEPRINT.md) §6.

> **Why the pre-check matters.** RAG retrieval embeds the query and compares it against
> `quote_embeddings`. Without a real embedding provider, `embedText()` silently falls back to
> **non-semantic stub vectors** — grounding on those is worse than none. The code now **skips RAG**
> (logging `omni_rag_skipped_stub_embeddings`) when no usable embedding key is configured, and
> `npm run omni:rag-precheck` hard-fails so you never enable RAG on garbage/empty vectors.

## Prerequisites

- `DATABASE_URL` for the prod Postgres (same instance that holds the `omni_*` tables).
- A usable embedding provider key (`OPENAI_API_KEY`, `text-embedding-3-small`) for **both** the
  backfill and runtime retrieval. (#ZonaDesconocida: confirm the key is live — earlier notes flagged
  OpenAI quota issues. The pre-check enforces this.)
- The Omni schema already applied (`npm run omni:migrate`, migrations `001..010`).

## Steps

### 1. Apply the pgvector migration (not covered by `omni:migrate`)

`npm run omni:migrate` only applies `server/migrations/omni/*.sql`. The embeddings table lives in the
repo-root `migrations/` dir, so apply it directly:

```bash
psql "$DATABASE_URL" -f migrations/0001_add_pgvector_and_quote_embeddings.sql
psql "$DATABASE_URL" -f migrations/0002_quote_embeddings_provider.sql
```

`0001` creates the `vector` extension, `quote_embeddings (… embedding vector(1536) …)`, and the ivfflat
index. `0002` adds the `provider` column so the pre-check can refuse non-semantic stub vectors. Both idempotent.

### 2. Backfill embeddings

Requires a real embedding key (else vectors are stub — non-semantic). Dry-run first:

```bash
node scripts/training/embedQuotes.js --dry-run --limit 50   # sanity check text/sample
node scripts/training/embedQuotes.js                        # full backfill (~quotes corpus)
```

Reads `data/training/normalized-quotes.jsonl`, upserts into `quote_embeddings` (idempotent by
`content_hash`; `--reembed-all` forces re-embed).

### 3. Pre-check (must pass)

```bash
npm run omni:rag-precheck
```

Verifies: (a) semantic embedding provider configured, (b) `quote_embeddings` has embedded rows that were
**created with a semantic provider** (fails if any were backfilled with the stub, or are untagged pre-0002),
(c) a sample query returns hits. **Do not proceed if it fails.**

### 4. Flip flags — shadow mode (Cloud Run `panelin-calc`)

Set, then deploy/restart so `startOmniAiWorker` boots (see `server/index.js`):

```
OMNI_EVENT_BUS_ENABLED=1
OMNI_AI_ORCHESTRATOR_ENABLED=1
RAG_ENABLED=1
RAG_TOP_K=5
RAG_THRESHOLD=0.70
OMNI_AI_DAILY_BUDGET_USD=50      # daily spend cap (already enforced per-job + per-batch)
```

"Shadow" here means: the worker classifies inbound customer messages and generates a **suggestion**
into `omni_suggestions` (`approval_state='pending'`). It does **not** send. Operators review and
approve in `/hub/canales`. (#ZonaDesconocida: whether `emit("message.ingested")` is additionally
gated by `OMNI_EVENT_BUS_ENABLED` — set it regardless.)

### 5. Verify end-to-end

Trigger one inbound **customer** message (WA/ML/email) into an `omni_conversations` thread, then:

```sql
-- jobs enqueued + completed (classify + suggest), with cost/latency
SELECT job_type, status, cost_usd, latency_ms, confidence
FROM omni_ai_jobs ORDER BY created_at DESC LIMIT 5;

-- suggestion staged with grounding citations, awaiting approval
SELECT approval_state, channel, metadata->'grounding' AS grounding, left(body, 80) AS preview
FROM omni_suggestions ORDER BY created_at DESC LIMIT 3;
```

Expect: a `suggest` job `completed` with non-zero `cost_usd`; an `omni_suggestions` row
`approval_state='pending'` whose `metadata.grounding` shows `rag_count > 0` and `rag_case_ids`
(the cited past quotes). Confirm **no outbound** was sent.

## Rollback

Toggle the flags off (no redeploy needed for behavior to revert on next worker tick / restart):

```
OMNI_AI_ORCHESTRATOR_ENABLED=0     # worker stops enqueuing + processing
RAG_ENABLED=0                      # suggestions ungrounded (text reverts; metadata grounded:false)
```

With both off, the system is byte-identical to pre-Phase-1.

## Notes

- Daily budget: enforced before each job and each batch (`getDailyAiCost` vs `OMNI_AI_DAILY_BUDGET_USD`).
- Cost/telemetry come from `callAgentOnce()` (provider/model/latency/cost) and are written to
  `omni_ai_jobs`. The suggestion's `metadata.grounding` is the citation trail for the operator UI.
- `classify` stays a fast/free regex (`classifyIntent`) by design — converting it to an LLM is a later
  phase, not part of "one brain" (which is about the **suggestion** path).
