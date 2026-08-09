# Ideal 100% — API Key Readiness & Live Provider Lights

## Target composite: 100 (pass ≥90)

## System class

**Subsystem of Calculadora BMC / Panelin** — operator-facing LLM provider readiness (format gate + live probe + green/red lights). Not a standalone product; must nest cleanly in existing Express modular monolith + Vite SPA.

## Must-have artifacts

| Artifact | Ideal state |
|----------|-------------|
| `SDD.md` (or `SDD-API-KEY-READINESS.md`) | SCHEMA-CONTRACT §§1–12, correct names/order |
| `RECREATION-CHECKLIST.md` | Separate checklist, all boxes closed or N/A justified |
| `evidence/` or inline tags | CONFIRMED / INFERRED / PROPOSED on critical claims |
| Scorecard re-run | composite ≥90 after evolution patches |

## Section-specific ideal

### §1 Introduction & Goals
Keep current problem/goals/stakeholders. Move Solution Strategy **out** to §4 (not 1.5 only).

### §2 Context & Scope (C4 L1)
Keep C4Context + external interfaces. Add auth column on interfaces table. Tag each interface PROPOSED vs CONFIRMED (existing).

### §3 Constraints
Keep stack/cost/latency/security. Add explicit env var names list and Doppler project `bmc-backend/prd`.

### §4 Solution Strategy
Elevate layers 0–4, modular-monolith choice, trade-offs (fail-open vs fail-closed), and AI integration strategy (probes only — not RAG).

### §5 Container View (C4 L2)
Keep C4Container. Note Vercel vs Cloud Run hosts explicitly on containers.

### §6 AI Architecture — Component View
Either:
- Full component table (ProbeAdapters, Readiness cache, reason mapper, lights UI), **or**
- Explicit N/A for RAG/multi-agent with evidence, **plus** probe-only AI component table.

Ideal includes: probe model table, cost, fail-open policy (already strong in current §9 — relocate).

### §7 Data Flow
Keep sequenceDiagram cold path. Add one more sequence: **chat turn updates Ready cache on success**.

### §8 Deployment View *(currently missing — required for 100%)*

Ideal content:

| Env | Host | Process | Secrets |
|-----|------|---------|---------|
| Local | Mac, `:3001` API + Vite | `doppler run --project bmc-backend --config prd -- node server/index.js` | Doppler |
| Prod SPA | Vercel `calculadora-bmc` | static | frontend env mirror |
| Prod API | Cloud Run `panelin-calc` / GSM | container | `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROK_API_KEY`, … |

Also: new env `PROVIDER_READY_TTL_MS`, `AI_OPTIONS_REQUIRE_LIVE`; no new GSM secrets beyond existing provider keys.

### §9 Crosscutting
Current Quality Attributes content + sustainability one-liner + link to smoke:prod readiness assertion.

### §10 ADRs
Keep five ADRs; add **Alternatives considered** to each; ADR format Status enum from contract.

### §11 Risks
Keep table; add residual risk “doc treats PROPOSED routes as live” until implemented.

### §12 Glossary
Keep; add `reasonCode`, `AI_OPTIONS_REQUIRE_LIVE`.

## Acceptance test (ideal recreation)

> A developer with repo access implements Phases A–C and proves:  
> (1) `GET /api/agent/providers/status` returns green for a live Gemini key and red for Anthropic without credits;  
> (2) chat header shows aggregate light;  
> (3) unit tests for reason mapping pass —  
> **using only the SDD + RECREATION-CHECKLIST + existing AGENTS.md**, in &lt; 1 day.

## Out of ideal scope

- Pasting secrets in UI  
- Auto-purchasing provider credits  
- Shared Redis readiness cache (nice-to-have P2)
