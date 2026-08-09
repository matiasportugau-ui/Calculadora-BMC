# Recreation checklist — calculadora-bmc

 falsifiable items for a new team to stand up v1. Mark: `[x]` done · `[ ]` open · `N/A`.

## Stack & bootstrap

- [x] Runtime: Node **24.x** (`package.json` engines)
- [x] Package manager: npm (`package-lock.json` present; Vercel `npm install --ignore-scripts`)
- [x] Dev: `npm run env:ensure` then `npm run dev:full` → Vite `:5173` + API `:3001`
- [x] Prod UI build: `npm run build` → `dist/`
- [x] Prod API: `npm run start:api` / Cloud Run image via `deploy-calc-api` / cloudbuild

## Configuration

- [x] Env **names** listed in `evidence/surfaces.md` + `.env.example`
- [x] Secrets: Doppler (`bmc-frontend/prd`, `bmc-backend/prd`) + GCP Secret Manager (Cloud Run)
- [x] Config SoT: `server/config.js` (no hardcoded sheet IDs/tokens in app logic)
- [x] Frontend base: `FRONTEND_BASE_URL` default `https://calculadora-bmc.vercel.app`

## Data

- [x] Sheets: CRM/finanzas/matriz IDs via env; service account JSON
- [x] Postgres: `DATABASE_URL` for WA / transportista / traktime / RAG
- [x] Migrations: `migrations/`, `wa-package/migrations/`, `transportista-cursor-package/migrations/`
- [x] Seed: N/A for core calc (prices in `src/data/constants.js`); Sheets hold operational data

## Integrations

- [x] Vercel ↔ Cloud Run rewrite pattern documented
- [x] Google Sheets/OAuth/Drive named
- [x] Mercado Libre OAuth + GCS token store
- [x] Meta webhooks + WA
- [x] Anthropic/OpenAI keys
- [x] Optional Chatwoot/Shopify named

## Deploy

- [x] Prod UI: `calculadora-bmc.vercel.app`
- [x] Prod API: `panelin-calc-q74zutv7dq-uc.a.run.app`
- [x] CI: `.github/workflows/ci.yml`, deploy workflows
- [x] Smoke: `npm run smoke:prod`
- [x] Health: `GET /health`, `GET /capabilities`

## UI / routes

- [x] Main SPA routes listed (`evidence/inventory.md`, SDD §5/§2)
- [x] Auth: Google OAuth + JWT + grants; MFA optional; calculator public paths vs hub gated

## Operations

- [x] Logs: pino on server (Cloud Run logging)
- [x] Audit: Sheets `AUDIT_LOG` / activity routes (names)
- [x] Backup: Sheets version history (INFERRED ops); Postgres backup = platform responsibility — **UNKNOWN** exact schedule → SDD §11
- [x] Disk precheck + `BMC_DISK_PRECHECK_SKIP` documented

## AI recreation

- [x] §6 components listed with files
- [x] Assistant gates required before gen traffic
- [x] RAG migrations path documented

## Pass math

| Category | Items | Closed |
|----------|-------|--------|
| Stack | 5 | 5 |
| Config | 4 | 4 |
| Data | 4 | 4 |
| Integrations | 6 | 6 |
| Deploy | 5 | 5 |
| UI | 2 | 2 |
| Ops | 4 | 4 |
| AI | 3 | 3 |
| **Total** | **33** | **33 (100%)** |

**R7:** PASS (≥90%). Residual UNKNOWN (Postgres backup schedule, live OAuth completeness per channel) tracked in SDD §11 — not P0 blockers for documenting recreation of calc+API+hub skeleton.
