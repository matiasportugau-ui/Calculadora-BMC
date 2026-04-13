# 01 — System inventory (Calculadora-BMC)

## Executive Findings

The repository is a **dual-surface product**: a **Vite + React** quoting SPA (`src/`) and an **Express 5** API (`server/`) that also serves calculator routes under `/calc`, dashboard JSON under `/api`, OAuth/webhooks, and static SPAs for some paths. **Deploy automation is split** between **Vercel** (`vercel.json`) and **Google Cloud Run** (multiple workflows), which increases the need for an explicit “canonical production topology” document. **No TypeScript**; validation relies on **Node test scripts**, **ESLint on `src/` only**, and **manual/structural contract checks**.

## Evidence Reviewed

- `package.json` — name `calculadora-bmc`, version `3.1.5`, `type: "module"`, scripts for dev, API, gates, smoke, contracts, panelsim, omni-related tooling.
- `vite.config.js` — React plugin, `server.proxy` `/api` + `/calc` → `http://localhost:3001`, `base` from `VITE_BASE`.
- `server/index.js` — Express app, CORS, security headers, raw JSON body for webhooks, `pino-http`, routes for `/capabilities`, `/health`, ML OAuth + `/ml/*`, webhooks, `app.use("/calc", calcRouter)`, multiple `/api` routers, static/calculadora mounts (partial read + `rg` route list).
- `server/config.js` — central env mapping including **default** `bmcMatrizSheetId` when env unset.
- `.github/workflows/ci.yml`, `deploy-calc-api.yml`, `deploy-frontend.yml`, `knowledge-antenna-*.yml`.
- `vercel.json` — Vite build to `dist`, catch-all rewrite to `index.html`.
- `eslint.config.js` — flat config, **ignores** `src/components/PanelinCalculadoraV3_backup.jsx`.
- `docs/openapi-calc.yaml`, `docs/openapi-email-gpt.yaml`.
- `server/agentCapabilitiesManifest.js` — `DASHBOARD_ROUTES` list + `buildAgentCapabilitiesManifest`.
- `scripts/validate-api-contracts.js`, `scripts/smoke-prod-api.mjs`, `scripts/pre-deploy-check.sh`.
- `.env.example` — extensive integration surface (Sheets, ML, Shopify, WhatsApp, AI keys, Vite vars).
- `.cursor/rules/*.mdc` (9 files) — listing via `ls .cursor/rules`.

## Current State

### Repository layout (high level)

| Area | Role |
|------|------|
| `src/` | React UI, calculator UX, utilities (`src/utils/calculations.js`, etc.) |
| `server/` | Express API, route modules (`server/routes/*`), libs (`server/lib/*`), migrations under `server/migrations/` |
| `tests/validation.js` | Large consolidated test suite (imports from `src/`, `server/`, and `docs/.../prototype` libs) |
| `scripts/` | Operational automation: smoke, contracts, deploy helpers, knowledge antenna, panelsim, etc. |
| `docs/` | Team process, Sheets hub, OpenAPI YAML, dashboard modernization docs |
| `.cursor/` | Rules, skills, agents for Cursor multi-agent workflows |

### Stack

- **Frontend:** React 18, Vite 7, `react-router-dom`, Three.js stack for some components.
- **Backend:** Express 5, `cors`, `pino`/`pino-http`, `googleapis`, `pg`, cloud storage client, AI SDKs (`openai`, `@anthropic-ai/sdk`, `@google/generative-ai`).
- **Data / integrations:** Google Sheets; optional Postgres paths; GCS for tokens/evidence; Mercado Libre; Shopify; Meta WhatsApp webhooks.

### Runtimes and package manager

- **npm** with `package-lock.json`.
- **Local shell during audit:** Node `v24.11.1`, npm `11.12.0` (see `docs/audit/audit-summary.json`).
- **CI (`ci.yml`):** `node-version: '20'` — **version skew** vs local optional.

### Build

- `npm run build` → `vite build` → `dist/` (preceded by `disk:precheck` + `version:data`).

### Lint / typecheck

- **ESLint** on `src/` (`npm run lint`). **No** `tsc`/TypeScript project detected in inventory pass.

### Tests

- `npm test` → `node tests/validation.js` (very large single file).
- **Playwright** present in `devDependencies`; no dedicated Playwright test tree identified in this audit pass (mark as **inventory gap** if tests exist elsewhere).

### Deploy / hosting artifacts

- **Vercel:** `vercel.json` (SPA hosting pattern).
- **Cloud Run:** `Dockerfile`, `Dockerfile.bmc-dashboard`, `nginx.conf`; workflows `deploy-calc-api.yml` (`SERVICE_NAME: panelin-calc`) and `deploy-frontend.yml` (`panelin-calc-web`).
- **Implication:** at least **two legitimate “frontends”** (Vercel vs Cloud Run static) may exist; API is Cloud Run–centric in smoke scripts.

### Spec / contract artifacts

- `docs/openapi-calc.yaml` — calculator/GPT surface.
- `docs/openapi-email-gpt.yaml` — reduced surface for email GPT.
- `GET /capabilities` — runtime manifest (`server/agentCapabilitiesManifest.js`).
- `docs/api/AGENT-CAPABILITIES.json` — snapshot from `npm run capabilities:snapshot`.

### Cursor / agent assets

- `.cursor/rules/*.mdc` — scoped always-on / requestable rules (team sync, calculator edits, human gates, etc.).
- `.cursor/skills/**` — extensive skills library (deploy, sheets, security, etc. per repo culture).
- Root `AGENTS.md` + `docs/AGENTS.md` — operational handbook for agents and humans.

## Gap Analysis

See `docs/audit/04-gap-analysis-2026.md`. At inventory level, the largest structural gap is **fragmentation of authority**: multiple hosts in scripts/docs/runtime manifest, and **dual deploy pipelines** without a single diagrammatic SSOT in repo (beyond prose in AGENTS/skills).

## Master Implementation Plan

Consolidated phased plan: **`docs/audit/05-master-implementation-plan.md`**. This inventory file does not duplicate phase sequencing.

## Risks

- **Operational:** wrong `PUBLIC_BASE_URL` or `VITE_API_URL` silently breaks OAuth, GPT Actions, or SPA→API calls.
- **Engineering:** mega-test file increases coupling and makes spec isolation expensive.
- **Security:** broad CORS in API + many secret-bearing env vars — correct for dev, needs strict production config.

## Next Actions

1. Freeze a **host authority table** (prod API URL, prod SPA URL(s), OAuth callback hosts) and link it from `AGENTS.md`.
2. Align **Node major** between developer docs, CI, and local (20 vs 24 decision).
3. Split **`tests/validation.js`** along domain boundaries as prep for contract CI.

---

### Finding: Dual deploy surfaces (Vercel + Cloud Run) without repo-local SSOT diagram

- **Severity:** Yellow
- **Evidence:**
  - `vercel.json` exists with SPA rewrites.
  - `.github/workflows/deploy-frontend.yml` deploys **Docker** frontend to **Cloud Run** `panelin-calc-web`.
  - `AGENTS.md` references `https://calculadora-bmc.vercel.app` as production app URL in multiple operational flows.
- **Impact:** Agents and humans can apply the wrong checklist (wrong build args, wrong smoke base, wrong static origin).
- **Recommendation:** Add `docs/audit/host-authority.md` (or extend deploy skill) with a single table: artifact → service → URL → required env vars.
- **Verification:** New contributor can answer “where is prod SPA?” in < 2 minutes using only repo docs; smoke default matches `GET /capabilities` `public_base_url`.

### Finding: ESLint ignores primary calculator variant file

- **Severity:** Yellow
- **Evidence:** `eslint.config.js` line with `ignores: [..., "src/components/PanelinCalculadoraV3_backup.jsx"]`.
- **Impact:** Regressions in a likely user-facing bundle can ship without lint signal.
- **Recommendation:** Remove ignore after incremental lint cleanup, or rename file to experimental and exclude via path convention with explicit policy doc.
- **Verification:** `npm run lint` includes the file; CI lint job fails on new violations.

### Finding: Default MATRIZ sheet id in server code

- **Severity:** Yellow
- **Evidence:** `server/config.js` sets `bmcMatrizSheetId` default when `BMC_MATRIZ_SHEET_ID` unset; `AGENTS.md` states sheet IDs must not be hardcoded.
- **Impact:** Conflicting “source of truth” policy; accidental coupling to a specific workbook.
- **Recommendation:** Fail fast in production if unset, or load from secure config; keep default only for local dev behind explicit flag.
- **Verification:** Production deployment requires explicit env; staging logs show no silent default in prod.

---

## #ZonaDesconocida

- Exact **Vercel project** linkage and **env var values** in Vercel production (not readable from repo).
- Whether **Playwright** tests exist outside default discovery paths.
- Full route inventory from `server/routes/bmcDashboard.js` without automated extraction (manual sync risk called out elsewhere).
