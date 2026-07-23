# Evidence — RAG production enablement (IMP-04)

**Date:** 2026-07-23  
**Status:** **BLOCKED — human gate** (do not set `RAG_ENABLED=1` on Cloud Run without operator confirm after embed batch)

## Preconditions

1. `DATABASE_URL` on Cloud Run with pgvector extension applied (`quote_embeddings` table exists).
2. Embeddings provider configured (`OPENAI_API_KEY` or stub policy documented in OPS).
3. Rollback path documented (flip `RAG_ENABLED=0` + redeploy).

## Enable procedure (ops)

```bash
# 1. Confirm migration + table
# See docs/team/runbooks/omni-ai-orchestrator-rag-enable.md

# 2. Run embed batch (from repo root, secrets via Doppler)
doppler run --project bmc-backend --config prd -- node scripts/training/embedQuotes.js

# 3. Human gate — operator confirms row count + sample similarity
# 4. Set env on Cloud Run (GSM / revision):
#    RAG_ENABLED=1
#    RAG_TOP_K=5
#    RAG_THRESHOLD=0.70
# Optional hybrid fusion (code shipped, default OFF):
#    RAG_HYBRID=0   # set 1 after offline eval if desired

# 5. Smoke retrieve (API up, auth as needed)
# Tool: recuperar_casos_similares OR chat turn with RAG auto-inject when enabled
```

## Rollback

```bash
# Cloud Run / GSM
RAG_ENABLED=0
# Redeploy panelin-calc — chat continues without historical quote block
```

## Acceptance (product)

- [ ] Embed batch completed with real vectors (not stub-only in prod)
- [ ] `RAG_ENABLED=1` set **after** operator sign-off
- [ ] At least one **CONFIRMED** prod retrieve log (`rag: retrieved quotes` or tool result)
- [ ] Hybrid (`RAG_HYBRID=1`) only after separate eval sign-off

## Current state (2026-07-23)

| Check | Status |
|-------|--------|
| Code path (`rag.js`, `agentChat` inject) | **CONFIRMED** |
| `RAG_HYBRID` fusion code | **CONFIRMED** (default OFF) |
| Prod `RAG_ENABLED` | **OFF** (intentional) |
| Prod embed batch | **PENDING** ops |
| Prod retrieve log | **PENDING** human gate |
