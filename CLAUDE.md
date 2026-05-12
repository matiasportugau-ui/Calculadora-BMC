# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

**Calculadora BMC** (package `calculadora-bmc`, v3.1.5) is a production full-stack **quotation calculator** for insulation panels (**BMC Uruguay** / **METALOG SAS**). Business copy and operator-facing text are mostly **Spanish**; **list prices and money amounts are in USD**.

`AGENTS.md` is the long-form companion to this file and lists every npm script and operational doc. Skim it when you need a command that's not below.

## Tech stack

- **Frontend:** React 18 + **Vite 7** (dev server **:5173**)
- **API:** **Express 5** on **Node.js** (`engines.node = "24.x"`; ES modules via `"type": "module"`) — **:3001**
- **Data:** **PostgreSQL** (`pg`) for the Transportista and **WA Cockpit** flows (`DATABASE_URL`); **pgvector + provider-agnostic embeddings** power Panelin RAG retrieval; Google Sheets via service-account JSON for CRM/Finanzas; integrations for MercadoLibre OAuth, WhatsApp Cloud API, GCS, OpenAI/Anthropic.
- **Modules:** **ES modules only** (`import` / `export`) — no `require()`.

## Key commands

| Command | Purpose |
|--------|---------|
| `npm run env:ensure` | Create `.env` from `.env.example` if missing (idempotent; run once per clone). |
| `npm run dev` | Vite only (runs `version:data` first, then Vite on :5173). |
| `npm run dev:full` | API (`start:api`, :3001) + Vite (:5173) via `concurrently`. |
| `npm run start:api` | Express API only. |
| `npm run lint` | ESLint on `src/`. |
| `npm test` | Offline unit/integration suite (no server, no network). |
| `npm run test:api` | Offline API route tests (no live server). |
| `npm run test:contracts` | Live API contract validator — **requires `npm run start:api` running on :3001** (or `BMC_API_BASE`). |
| `npm run build` | Production Vite build → `dist/`. |
| `npm run gate:local` | **lint** + **test** + **test:api** — run before any PR. |
| `npm run gate:local:full` | `gate:local` + **build** — run before larger UI/build changes. |
| `npm run smoke:prod` | Smoke against the public Cloud Run API (MATRIZ CSV is the critical check). |
| `npm run pre-deploy` | Pre-deploy checklist (health, contracts, env, open `- [ ]` count in `docs/team/PROJECT-STATE.md`). |
| `npm run transportista:migrate` | Apply Postgres migrations under `transportista-cursor-package/migrations/`. |
| `npm run wa:migrate` | Apply WA Cockpit Postgres migrations under `wa-package/migrations/`. |

Running a single test: each file in `tests/` is a standalone Node script — run it directly, e.g. `node tests/validation.js` or `node tests/calcLoopbackClient.test.js`.

## Architecture

```
src/        React SPA (Vite) — calculator + /hub/* operational modules
server/     Express 5 API — mounts /calc, /api/*, /auth/*, /webhooks/*
tests/      Offline tests (CI) + live contract validator
scripts/    Automation, smoke, snapshots, tooling
docs/       Team docs, Sheets hub, procedures, panelsim/
```

### Frontend hot spots

- `src/components/PanelinCalculadoraV3_backup.jsx` — **canonical** calculator component. `src/PanelinCalculadoraV3.jsx` is a stable re-export; do not refactor away from this naming.
- `src/data/constants.js` — pricing lists, panel catalogue, scenarios, profiles.
- `src/utils/calculations.js` — pure calculation engine for techo/pared.
- `src/utils/helpers.js` — PDF/WhatsApp export, BOM, formatters.
- `src/App.jsx` — router for calculator + `/hub/wa`, `/hub/ml`, `/hub/canales`, `/hub/admin`.

### Backend hot spots

- `server/index.js` — app entry; mounts routes; exposes `GET /health` and `GET /capabilities`.
- `server/config.js` — env + feature flags (always read sheet IDs/tokens from here, never hardcode).
- `server/routes/` — one file per surface: `calc.js`, `agentChat.js` (SSE), `bmcDashboard.js` (Sheets-backed `/api/*`), `pdf.js`, `wa.js`, `mlSearch.js`, `transportista.js`, `wolfboard.js`, `superAgent.js`, etc.
- `server/lib/calcLoopbackClient.js` — agent tools call calc via loopback HTTP to `127.0.0.1:${config.port}/calc/*` (provenance `source: "ae_agent"`). See `docs/team/panelsim/AE-AGENT-CALC-CONTRACT.md`.

### Pricing model

All prices are **without IVA**; 22% IVA is applied once at the total via `calcTotalesSinIVA()`. `LISTA_ACTIVA` selects between `venta` (BMC direct, default) and `web` (public Shopify). The `p(item)` helper resolves the active price. See `docs/PRICING-ENGINE.md`.

## Conventions (project-specific)

- **Error semantics for Sheets-backed routes:** `503` = Sheets unavailable; `200` + empty payload = no data; **never `500`** for Sheets failures. The frontend depends on this.
- **API routes** belong in `server/routes/*.js`, mounted under `/api` (Sheets/CRM) or `/calc`, `/auth`, `/webhooks`.
- **Secrets** live only in `.env` (see `.env.example` for variable names). Sheet IDs, tokens, and production URLs must come from `config.*` or `process.env.*` — never hardcoded.
- **Logging:** use `pino` / `pino-http` in `server/`; no `console.log` in production paths.
- **CORS:** open in dev; restricted to known origins in prod.
- Commit messages: concise, English, `type:` prefix (`feat`, `fix`, `refactor`, `docs`).
- **PR size:** PRs >500 LOC adds → DRAFT obligatorio. Splitear en commits atómicos antes de marcar ready (atrapa lo que branch protection no puede forzar a nivel LOC).

## What to read before non-trivial work

1. `docs/team/PROJECT-STATE.md` — **canonical** live state, recent changes, pending items.
2. `AGENTS.md` — full command catalogue and operational procedures.
3. `docs/team/knowledge/<role>.md` if your task maps to a defined agent role.
4. `docs/google-sheets-module/README.md` for any Sheets/CRM change (mapping canon in `MAPPER-PRECISO-PLANILLAS-CODIGO.md`).

When you finish a task that changes behavior, append a line under "Cambios recientes" in `docs/team/PROJECT-STATE.md`.

## Deployment

- **Frontend:** Vercel — https://calculadora-bmc.vercel.app (config in `vercel.json`).
- **API:** Google **Cloud Run** — service `panelin-calc`, region `us-central1`. Sheets credentials are mounted from Secret Manager (`./scripts/cloud-run-matriz-sheets-secret.sh`).
- **CI:** `.github/workflows/ci.yml` runs lint, tests, build, env-drift, smoke (push to `main`), `channels_pipeline`, `voice_health`, `knowledge_antenna`.

## Agent ecosystem (Claude Code)

Twelve agent definitions in **`.claude/agents/`**:

| Agent | Role |
|-------|------|
| `bmc-orchestrator` | Coordinates full team runs |
| `bmc-calc-specialist` | Pricing, BOM, panel calculations |
| `bmc-panelin-chat` | Chat UI, training KB, dev mode |
| `bmc-panelin-mcp` | External MCP surface (22 tools: calc, catalog, state, PDF, CRM, WhatsApp, telemetry) |
| `bmc-api-contract` | API response drift detection |
| `bmc-security` | OAuth, CORS, credential audits |
| `bmc-deployment` | Vercel + Cloud Run deploy/rollback |
| `bmc-fiscal` | IVA / IRAE / BPS oversight |
| `bmc-docs-sync` | `PROJECT-STATE.md` and `docs/` sync |
| `bmc-judge` | Run reports, agent rankings |
| `bmc-sheets-mapping` | Google Sheets CRM integration |
| `calculo-especialist` | 2D roof plan SVG dimensioning |

## Workflow modes

- **Contribut mode** — two-phase input refinement: agent returns a structured draft first, executes only after `ACEPTO BORRADOR`. Invoke with `/contribut` or type `CONTRIBUT ON`. Protocol: `.claude/commands/contribut.md`.
- **Project slash commands** in `.claude/commands/`: `/nxt` (workspace snapshot & next steps), `/bmc-claude-workspace` (multi-terminal Claude workspace), `/live-devtools-narrative-mcp`, `/live-devtools-transcript-action-plan`, `/note-lm-video-tutorial`.

## Non-obvious caveats

- **Disk precheck pre-hook:** `npm run dev` and `npm run build` both run `disk:precheck` via `predev`/`prebuild`. On cloud/CI with unusual filesystems it can false-fail — set `BMC_DISK_PRECHECK_SKIP=1` (also `BMC_DISK_MIN_FREE_MIB`, `BMC_DISK_PRECHECK_MODE=warn`).
- **Linux `easymidi`:** `npm install` needs `libasound2-dev` (ALSA headers) before the native `midi` addon will build. macOS users are unaffected.
- **Node 24.x is required** — `engines.node = "24.x"` (aligns Vercel with `@sparticuz/chromium >=22.17.0`). The README badge still says Node 20; trust `package.json`.
- **`npm audit fix --force` is forbidden** without explicit approval — it has broken Vite in this repo before.
- **`/health` without credentials:** `hasSheets` and `hasTokens` will be `false` until `.env` is populated with Google service-account JSON and ML OAuth keys. Most calc/UI code paths work without them; CRM, Finanzas, ML, and AI suggestions do not.
