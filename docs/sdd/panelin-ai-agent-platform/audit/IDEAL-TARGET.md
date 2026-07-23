# Ideal 100% — Panelin AI Agent Platform

**System class:** AI agent platform (modular monolith surface inside Calculadora BMC)  
**Target composite:** 100 · **Pass threshold:** ≥90  
**Date:** 2026-07-23 (post evolution iter-1 · composite **96**)

## Operational definition of 100% for *this* system

A new engineer (or coding agent) can:

1. Deploy API + SPA with all AI env **names** filled from OPS (Doppler `bmc-backend/prd` / GSM / Cloud Run).
2. Hit `POST /api/agent/chat` and parse every SSE event type including `done` / tool / `verified_quote`.
3. Recreate the full tool allowlist from `evidence/tools-manifest.md` with write-gate rules; MCP works with Bearer.
4. Know prod `ASSISTANTS_ACTIVE` (**`canales;ml;panelin`**) and toggle via hub without tribal knowledge.
5. Choose correct voice path per browser (Hands-free / Realtime / Whisper) with explicit product copy.
6. Run `test:agent` + `test:agent-golden` (19 cases) and interpret failures.
7. Answer yesterday’s AI $ from **documented** Cloud Logging query (IMP-06 docs **done**).
8. Know Actual vs Goal matrix and pick next IMP-XX from the implementation guide.
9. Rotate provider keys without fiction in the SDD; circuit breaker behavior understood.
10. Keep prod tool count synchronized with HEAD (automated or runbook).
11. Enable RAG only via OPS §11 / omni runbook (never assume default-on).
12. Include SuperAgent cost events in the same logging query (event name known; sink unified optional).

## Must-have artifacts (ideal)

- [x] `SDD.md` sections 1–12 As-Built  
- [x] `TARGET.md` + `RECREATION-CHECKLIST.md` recreation-complete  
- [x] `evidence/tools-manifest.md` living counts  
- [x] `IMPLEMENTATION-GUIDE.md` + `SDD-TARGET.md`  
- [x] Cost query + assistants snapshot + RAG enable docs  
- [ ] Optional product polish: hub $ card, SuperAgent `logAgentCost` wire, voice durable metrics  

## Gap to 100 from current 96

| Delta | Work |
|-------|------|
| +1–2 | SuperAgent code uses `logAgentCost` (IMP-07 residual) |
| +1 | p95 SSE measurement note or measured baseline (IMP-12) |
| +1 | Hub cost card or BigQuery export (optional) |
| +1 | Formal C4 Component diagram (nice-to-have) |

## Ideal artifacts already present

As-built SDD v1.1 + recreation checklist closed for docs + tools 55/55 + cost/assistants/RAG ops evidence → **pass ≥90 with headroom (96)**. Remaining points are productization, not schema salvage.
