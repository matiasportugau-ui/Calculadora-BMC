# Evidence — inventory (R1)

**Captured:** 2026-07-19  
**Target:** `/Users/matias/calculadora-bmc`  
**Tags:** CONFIRMED unless noted.

## Top-level layout (selected)

| Path | Role |
|------|------|
| `src/` | React 18 + Vite SPA |
| `server/` | Express 5 API (`server/index.js`) |
| `tests/` | Offline Node test scripts |
| `scripts/` | Smoke, deploy helpers, Playwright |
| `docs/` | Team docs, harness, Sheets mapping |
| `migrations/` | pgvector / quote embeddings |
| `transportista-cursor-package/migrations/` | Transportista Postgres |
| `wa-package/migrations/` | WA Cockpit Postgres |
| `Dockerfile` | Multi-stage: Node 24 deps/build → nginx:1.27 runtime :8080 |
| `vercel.json` | Vite build → `dist`; rewrites to Cloud Run |
| `.github/workflows/` | CI, deploy-calc-api, deploy-vercel, smoke-related |
| `cloudbuild*.yaml` | GCP Cloud Build for API/frontend |

**Skip noise:** `node_modules/`, `dist/`, `.git/`, zip archives.

## Manifest

- **CONFIRMED** `package.json`: name `calculadora-bmc`, version `3.1.5`, `"type": "module"`, `engines.node = "24.x"`.
- **CONFIRMED** scripts: `dev` (Vite :5173), `start:api` / `dev:full` (API :3001), `build`, `gate:local`, `smoke:prod`, `test` suites.

## Entrypoints

| Layer | File | Evidence |
|-------|------|----------|
| SPA | `index.html` → Vite → `src/App.jsx` | routes `/`, `/hub/*`, `/calculadora` |
| Calculator UI | `src/components/PanelinCalculadoraV3_backup.jsx` (~8144 LOC) | CLAUDE.md: canonical component |
| Calc engine | `src/utils/calculations.js` (~1497 LOC) | pure techo/pared |
| API | `server/index.js` | mounts `/calc`, `/api/*`, `/auth/*`, `/webhooks/*` |
| Config | `server/config.js` | env → typed `config` object |
| PDF templates | `src/pdf-templates/` | 13+ layouts + `index.js` |

## Deploy topology (prod)

| Surface | Host | Evidence |
|---------|------|----------|
| Frontend | Vercel `calculadora-bmc.vercel.app` | HTTP 200 on `/` (2026-07-19) |
| API | Cloud Run `panelin-calc-q74zutv7dq-uc.a.run.app` | `/health` `ok:true`, `hasSheets:true`, `hasTokens:true` |
| Proxy | Vercel rewrites `/api`,`/calc`,`/auth`,`/sync`,`/ml` → Cloud Run | `vercel.json:6-26` |

## Route inventory (SPA) — CONFIRMED `src/App.jsx`

`/`, `/calculadora`, `/hub`, `/hub/ml`, `/hub/ml-manager`, `/hub/wa`, `/hub/canales`, `/hub/tareas`, `/hub/clientes`, `/hub/proyecto`, `/hub/admin`, `/hub/admin/users`, `/hub/admin/analytics`, `/hub/admin/assistants`, `/hub/cotizaciones`, `/hub/admin-ingreso`, `/hub/bugs`, `/hub/planos`, `/mi-espacio`, `/hub/traktime/*`, `/hub/finanzas/*`, `/hub/agent-admin`, `/hub/marketing`, `/logistica`, `/conductor`, `/inspector`, `/especificaciones`, `/presentacion-licitacion`, `/fichas`, `/preview/pdf`, `/panelin/live`, …

## Server route modules — CONFIRMED `ls server/routes` (54 files)

Includes: `calc.js`, `bmcDashboard.js`, `agentChat.js`, `wa.js`, `omni.js`, `transportista.js`, `traktime.js`, `wolfboard.js`, `pdf.js`, `quotes.js`, `authGoogle.js`, `authMfa.js`, `mlSearch.js`, `shopify.js`, `marketing.js`, `banco.js`, …

## CI workflows (sample)

`ci.yml`, `deploy-calc-api.yml`, `deploy-vercel.yml`, `codeql.yml`, `matriz-sync.yml`, `cockpit-e2e-writes.yml`, Gemini triage/dispatch family.

## Local ports

| Service | Port | Command |
|---------|------|---------|
| Vite | 5173 | `npm run dev` |
| API | 3001 | `npm run start:api` / `dev:full` |
