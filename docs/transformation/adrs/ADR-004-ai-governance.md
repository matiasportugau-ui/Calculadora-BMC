# ADR-004: AI Governance and agentCore Reuse

**Status:** Proposed  
**Date:** 2026-06-22  
**Deciders:** AI Systems Architecture  
**Related:** [06-ai-governance.md](../06-ai-governance.md)

---

## Context

AI is **PARTIAL (50/100)**:

- `agentCore.js` shared across chat, CRM suggest, WA enricher
- No central omni orchestrator over unified message stream
- RAG disabled by default (`RAG_ENABLED=false`)
- `POST /api/crm/suggest-response` unauthenticated
- Per-channel classifiers: regex/heuristic + separate `mlAutoAnswer` pipeline

**Evidence:**
- Source: `docs/discovery/06-ai-map.md`, `docs/discovery/09-scorecard.md` §AI
- Section: No central omni AI orchestrator — NOT_FOUND
- Reasoning: agentCore invoked per-channel without unified queue

---

## Decision

1. **Reuse `agentCore`** — no second AI stack (aligns with OMNI-HUB IP-3)
2. Event-driven orchestrator on `message.ingested` → `omni_ai_jobs` queue
3. **Postgres registries:** `omni_prompt_registry`, `omni_model_registry` (versioned)
4. **AI run record:** store `prompt_version`, `model_version`, `confidence`, `latency_ms`, `cost_usd`, `approval_state`, `human_feedback`
5. **Internal endpoint:** `POST /api/internal/omni/ai/run` (Bearer `API_AUTH_TOKEN`) for connector/extension — never duplicate provider chain
6. **Human-in-the-loop:** suggestions require explicit accept/reject before outbound send (existing cockpit pattern extended)

Job types v1: `classify`, `suggest`, `extract_deal`, `embed`

---

## Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| **New AI stack (LangChain-only, separate service)** | Duplicates provider chain, cost, governance |
| **Per-channel prompts forever** | Inconsistent taxonomy; no eval framework |
| **LLM classify everything** | Cost spike; heuristics OK for spam/short messages |
| **No registry — env vars only** | No replay, no audit, no A/B |

---

## Consequences

**Positive:**
- Unified classification taxonomy → `body_ai_category`
- Eval framework can compare prompt_version A vs B
- Cost attribution per channel/conversation

**Negative:**
- Migration of waEnricher intents to omni taxonomy required
- Registry adds DB migrations and admin UI (Phase 2)

---

## Risks

| Risk | Mitigation |
|------|------------|
| AI cost spike | Rate limits per channel; skip classify for low-signal |
| Prompt injection via customer message | Sanitize + system prompt boundaries; no tool exec on ingest |
| Model provider outage | Existing 4-provider chain fallback |

---

## Rollback Strategy

1. `OMNI_AI_ORCHESTRATOR_ENABLED=0` — legacy waEnricher + suggestResponse unchanged
2. Drain `omni_ai_jobs` pending queue
3. Suggestions table optional — WA path uses `wa_suggestions` if omni disabled

---

## References

- [10-architecture-review.md](../../discovery/10-architecture-review.md) §6
- [06-ai-map.md](../../discovery/06-ai-map.md)
