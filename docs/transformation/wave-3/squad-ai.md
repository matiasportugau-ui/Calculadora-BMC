# Squad AI — E1–E4

**Owner:** AI Systems Architect (`bmc-panelin-chat`, `bmc-calc-specialist`)  
**ADR:** [ADR-004](../adrs/ADR-004-ai-governance.md)

---

## Items

| ID | Deliverable | Files | Flag |
|----|-------------|-------|------|
| E1 | AI job queue + classify worker | `server/lib/omni/orchestrator/aiWorker.js`, migration 002 | `OMNI_AI_ORCHESTRATOR_ENABLED` |
| E2 | Suggest job → `omni_suggestions` | Extend aiWorker, reuse `agentCore` | disable job type |
| E3 | Prompt + model registry | `omni_prompt_registry`, `omni_model_registry` | registry `enabled=false` |
| E4 | Internal AI endpoint | `POST /api/internal/omni/ai/run` | unmount route |

**Order:** E1 → (E2 ∥ E3) → E4

---

## Runtime

- Worker polls `omni_ai_jobs` with `FOR UPDATE SKIP LOCKED`
- Classify uses heuristics first (`classifyIntent` from waEnricher), LLM optional via `taskKey: classify`
- Suggest uses `callAgentOnce` with channel from conversation
- Jobs enqueued on `message.ingested` when orchestrator enabled

---

## Tests

- `tests/omniAiWorker.test.js` — job lifecycle (offline)
- `tests/omniAiRegistry.test.js` — registry helpers

---

## Rollback

```bash
OMNI_AI_ORCHESTRATOR_ENABLED=0
```

Legacy `waEnricher` + `suggestResponse` unchanged.
