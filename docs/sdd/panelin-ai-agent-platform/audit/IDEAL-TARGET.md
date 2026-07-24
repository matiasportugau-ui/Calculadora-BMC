# Ideal 100% — Panelin AI Agent Platform

**System class:** AI agent platform (modular monolith surface)  
**Target composite:** 100 · **Pass threshold:** ≥90  
**Date:** 2026-07-23 (re-audit · composite **97**)

## Operational definition of 100%

A new engineer/agent can:

1. Deploy API + SPA with AI env **names** from OPS / Cloud Run / Doppler.  
2. Hit `POST /api/agent/chat` and parse SSE including **`done.provider_used` / `latency_ms`**.  
3. Recreate tool allowlist from `evidence/tools-manifest.md` (**55**) with write gates.  
4. Know prod `ASSISTANTS_ACTIVE=canales;ml;panelin` and hub toggles.  
5. Run `test:agent` + `test:agent-golden` (**22** cases).  
6. Answer yesterday’s AI $ from documented Logging query.  
7. Use SuperAgent `/quote-lead` knowing cost goes through `logAgentCost` and calc matches engine tests.  
8. Pick next IMP-XX from the implementation guide.  
9. Enable RAG only via OPS §11 after `omni:rag-precheck`.  
10. See the same core turn fields on SSE and `callAgentOnce` (IMP-02 residual).  

## Must-have artifacts

- [x] SDD §1–12 As-Built v1.2  
- [x] tools-manifest 55/55 + goldens 22  
- [x] cost-query + assistants-active + SSE done schema  
- [x] IMP-07/11/12 closed in code + guide  
- [ ] IMP-02 dual-brain log parity  
- [ ] Optional: hub $, voice durable, RAG on, Whisper UX  

## Gap to 100 from 97

| Δ | Work |
|---|------|
| +1 | IMP-02 `logAgentTurn` field parity |
| +1 | p95 baseline note after 1 week of `latency_ms` |
| +1 | Hub cost card or explicit permanent defer |

## Note

**97** is expert-complete for as-built docs. Remaining points are product roadmap, not missing architecture narrative.
