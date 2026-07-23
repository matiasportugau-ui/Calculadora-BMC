# Actual vs Goal — Panelin AI Agent Platform

**Date:** 2026-07-23  
**Purpose:** Single matrix for SDD-driven development (as-built fact vs north-star goal).

## Legend

| Tag | Meaning |
|-----|---------|
| **DONE** | Live in code + deployable |
| **PARTIAL** | Code exists; not default-on / incomplete productization |
| **GAP** | Target not met; needs implementation |
| **UNKNOWN** | Needs ops/prod evidence |

## Matrix

| ID | Goal (objective) | Actual (as-built) | Status | Gap / solution pointer |
|----|------------------|-------------------|--------|------------------------|
| OG-01 | Single shared brain for all channels | `agentCore.callAgentOnce` for ML/WA/Omni/email; **chat SSE has own streaming loop** | PARTIAL | Unify observability events; keep SSE loop for tools streaming (ADR) — see IMP-02 |
| OG-02 | Multi-provider failover never kills chat | Chain claude→grok→gemini→openai→openrouter + circuit breaker | DONE | Monitor OpenRouter prod enablement (UNKNOWN) |
| OG-03 | Zero invented panel prices | Tools + loopback `/calc` + prompt hard rule + goldens | DONE | SuperAgent parallel path must stay contract-aligned — IMP-07 |
| OG-04 | Human gates on all writes | `user_confirmed` + intent classifier + MCP auth set | DONE | Expand channel goldens for write refusals — IMP-11 |
| OG-05 | Full tool catalog documented for MCP/GPT | Local 55 + OpenAPI + manifest; prod **55** | DONE | Keep IMP-01 CI/doc hygiene; drift closed 2026-07-23 |
| OG-06 | Assistants control plane kill-switch | `ASSISTANTS_ACTIVE` + hub UI + `seam` always on | DONE | Prod snapshot **`canales;ml;panelin`** — evidence/assistants-active.md (IMP-03 docs closed) |
| OG-07 | RAG similar quotes in every quote turn | Code + migrations; **default `RAG_ENABLED=false`** | PARTIAL | Enable runbook documented; product enable remains IMP-04 |
| OG-08 | Training KB + autolearn closes quality loop | Dev panel + training routes + extractor | PARTIAL | Prod KB sync + miss dashboard — IMP-05 |
| OG-09 | Measurable cost $/day | `costTelemetry` + SuperAgent events; Omni cap 50 | PARTIAL | **Query path DONE** (cost-query.md / OPS §10); hub UI still open |
| OG-10 | Voice works Safari+Chrome Hands-free; Firefox fallback | Dual path Hands-free + Realtime; Whisper route exists | PARTIAL | Productize Whisper fallback UX — IMP-08 |
| OG-11 | Goldens + eval gate releases | 19 goldens + `GOLDEN_REQUIRED=1` in pre-release | DONE | Expand packs WA/ML/email — IMP-11 |
| OG-12 | MCP external agents drive calc safely | `mcp:panelin` + exec-tool auth | DONE | Keep agent docs tool counts in sync — IMP-01 |
| OG-13 | Persistent tool/voice analytics | Tool calls dual-write to `agent_tool_calls` when `DATABASE_URL` (B-05 2026-07-22); voice errors still mostly in-memory | PARTIAL | Voice metrics + hub rollup — IMP-09 |
| OG-14 | Hybrid RAG + training KB ranking | Separate retrieve paths | GAP | Rank fusion in chat prompt inject — IMP-10 |
| OG-15 | p95 first SSE token &lt; 2.5s | Streaming exists; SLO not measured | GAP | Emit latency on `done` + dashboard — IMP-12 |
| OG-16 | Single canonical platform SDD for SDDD | This bundle (2026-07-23) | DONE | Keep child chat SDD linked; re-audit quarterly |

## North-star statement

> Operators get a Spanish-first, tool-grounded, multi-channel AI commercial agent with safe writes, measurable quality/cost, and docs that a new engineer can recreate and extend without tribal knowledge.

## Inherited from child GAP-PLAN (`panelin-chat-agent`)

| Child ID | Status in this refresh |
|----------|------------------------|
| G-01 tools inventory | **CLOSED** → `evidence/tools-manifest.md` (55) |
| G-02 goldens list | **CLOSED** → `evidence/goldens.md` (19) |
| G-03 health probe | **CLOSED** → local + prod health snippets in inventory |
| G-04 rate limits | **CLOSED** → 10/30/60 cited in surfaces |
| G-05 target-state SDD | **OPEN** → `SDD-TARGET.md` + `IMPLEMENTATION-GUIDE.md` |
| G-06 cost $/day | **PARTIAL** → query path closed; hub UI optional |
| G-07 prompt hash process | **OPEN** → IMP-13 |
