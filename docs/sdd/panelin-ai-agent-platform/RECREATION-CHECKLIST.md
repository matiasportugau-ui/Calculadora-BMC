# Recreation Checklist — panelin-ai-agent-platform

**Date:** 2026-07-23 (evolution iter-1)  
**Rubric:** sdd-reverse-engineer `RECREATION-RUBRIC.md`  
**Pass target:** ≥90% `[x]` or justified `N/A`

### Stack & bootstrap

- [x] Runtime version Node 24.x — `package.json` engines
- [x] Package manager npm; `npm install`
- [x] Dev start: `npm run env:ensure` then `doppler run -- npm run dev:full` (API `:3001`, Vite `:5173`)
- [x] Prod: Vercel SPA + Cloud Run `panelin-calc` — CLAUDE.md / OPS

### Configuration

- [x] AI env **names** listed — SDD §8 + `KB/integrations.md`
- [x] External stores: Doppler, GSM, optional GCS — OPS
- [x] Config SoT: `server/config.js`, `aiProviderConfig.js`
- [x] Assistants allowlist `ASSISTANTS_ACTIVE` — prod snapshot **`canales;ml;panelin`** — `evidence/assistants-active.md` + OPS §9

### Data

- [x] Postgres `quote_embeddings` + migrations — `evidence/data-model.md`
- [x] Training KB file/GCS — `trainingKB.js`
- [x] Quote registry GCS/memory — AE contract
- [x] Seed embeddings for RAG — **procedure documented**; required only when `RAG_ENABLED=1` (default OFF is intentional product default). Runbook: `omni-ai-orchestrator-rag-enable.md` + OPS §11. N/A while RAG stays off.

### Integrations

- [x] LLM providers + key env names — `aiProviderConfig.js`
- [x] Calc loopback contract — AE-AGENT-CALC-CONTRACT.md
- [x] Sheets / WA / Chatwoot / MCP — `KB/integrations.md`
- [x] Bridge pattern MCP stdio→HTTP — `mcp-panelin-http.mjs`

### Deploy

- [x] Hosts: Vercel + Cloud Run us-central1
- [x] Public URL probed — inventory 2026-07-23
- [x] CI: `.github/workflows` + `smoke:prod` / `pre-release`
- [x] LLM only on API (not Edge) — CONFIRMED

### UI / routes

- [x] Main AI routes table — `evidence/surfaces.md`
- [x] Auth gates: assistants middleware, JWT grants, MCP Bearer
- [x] Dev training Ctrl+Shift+D — PanelinDevPanel

### Operations

- [x] Logs: pino / Cloud Logging; costTelemetry events
- [x] Rate limits documented — 10/30/60
- [x] Runbook PANELIN-IA-OPS.md
- [x] $/day rollup **procedure** — `evidence/cost-query.md` + OPS §10 (hub UI still optional product)
- [x] Durable tool analytics — `agent_tool_calls` (B-05); voice still open → IMP-09 (product, not recreation blocker)

### AI-specific recreation

- [x] Tool inventory 55 local / 55 prod (2026-07-23) — tools-manifest
- [x] 19 golden cases indexed — goldens.md
- [x] Provider order documented
- [x] Human-gate write rules documented
- [x] Actual vs goal + implementation TODOs — guide
- [x] SuperAgent cost event name + parity target documented — SDD §6.3 / §9.5 / ADR-007

## Score (self)

| Category | Done | Open | Notes |
|----------|------|------|-------|
| Stack | 4/4 | 0 | |
| Config | 4/4 | 0 | prod ASSISTANTS pinned |
| Data | 4/4 | 0 | RAG seed = procedure / N/A default-off |
| Integrations | 4/4 | 0 | |
| Deploy | 4/4 | 0 | |
| UI/routes | 3/3 | 0 | |
| Ops | 5/5 | 0 | cost procedure closed; voice product residual |
| AI-specific | 6/6 | 0 | SuperAgent telemetry documented |

**Approx:** 34/34 checklist items closed for **recreation** ≈ **100%** of recreation rows (product IMP residual does not block rebuild of as-built default-off RAG).
