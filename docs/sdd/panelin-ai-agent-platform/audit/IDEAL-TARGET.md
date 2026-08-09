# Ideal 100% — Panelin AI Agent Platform

**Date:** 2026-07-26  
**Target composite:** 100 (pass ≥90)  
**System class:** Multi-provider commercial AI agent platform (monolith API + SPA clients)

## Operational definition of 100% (this system)

An SDD is **100%** for Panelin AI Agent Platform when:

1. **Schema complete** — §1–12, frontmatter, no placeholders (already met).
2. **C4 accurate** — L1 + L2 include every live AI surface (chat, channels, SuperAgent, **PAOS**, voice).
3. **Recreation** — RECREATION-CHECKLIST 100% accurate (no stale open items after closed IMPs).
4. **Interfaces** — every external: direction, protocol, auth; LLM keys **names only**.
5. **Deploy** — Vercel + Cloud Run, GSM secret names, ASSISTANTS_ACTIVE, Doppler `prd`.
6. **AI depth** — dual brain, 55 tools groups, RAG default-off + enable runbook, training KB, goldens, cost events, **PAOS** lifecycle.
7. **ADRs** — dual orchestration, calc loopback, HITL writes, RAG opt-in, SuperAgent, **PAOS canary/promote**.
8. **Evidence** — prod probes ≤14 days old for tools count, health, ASSISTANTS, provider smoke.
9. **Ops** — cost $/day query + optional hub card; p95 latency baseline recorded.
10. **Agent-ready** — coding agent can implement/fix without “where is PAOS / how rotate keys?” gaps.

## Must-have artifacts

| Artifact | Ideal state |
|----------|-------------|
| `SDD.md` | v current As-Built, §1–12 + appendices |
| `RECREATION-CHECKLIST.md` | All rows green; no stale product residuals mislabeled open |
| `evidence/*` | tools-manifest, surfaces, goldens, cost-query, assistants, traces, **provider-smoke** |
| `IMPLEMENTATION-GUIDE.md` | Open IMPs only for true residual |
| `docs/team/runbooks/PANELIN-IA-OPS.md` | Secrets rotate, provider fail, RAG, cost |
| AE-AGENT-CALC-CONTRACT | Linked from §6 |

## Section-specific ideal

### §5 Containers
Include: SSE chat, agentCore, tools(55), SuperAgent, assistants CP, RAG, training KB, voice mint/transcribe, Omni worker, **PAOS evaluate/promote** (if flags exist in prod).

### §6 AI
Full component table + provider order + tool groups + cost events + RAG OFF default + voice dual path + **PAOS** (`PAOS_ENABLED`, canary, promote→KB).

### §8 Deployment
Cloud Run `panelin-calc` us-central1; secret names including `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROK_API_KEY`, `GEMINI_API_KEY`; note revision probe date.

### §9 Crosscutting
Security HITL + rate limits; reliability failover/circuit breaker; obs `logAgentTurn` + SSE `done` + toolStats + voice_events; cost-query path.

### §10 ADRs
≥ existing 001–007 **plus** PAOS supervised learning (canary, human promote, no silent price invent).

## Acceptance test

> A developer with repo + Doppler/GSM access can redeploy the AI surface, verify tools=55, run one SSE chat quote with `verified_quote`, and diagnose a dead provider using only SDD + OPS + evidence — in **&lt; 4 hours**.

## Distance from ideal (2026-07-26 post-evolution)

| Ideal item | Status |
|------------|--------|
| Schema 1–12 | Met (v1.4) |
| Tools/calc/RAG docs | Met |
| Evidence freshness | Met for tools/PAOS/Grok (2026-07-26) |
| PAOS in §6/§10/C4 | **Met** (integration + child Spec) |
| Hub $ + p95 | Optional product residual |
| RECREATION IMP-09 line | **Met** (closed) |
