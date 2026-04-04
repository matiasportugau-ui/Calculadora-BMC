---
name: bmc-deployment
description: "Deployment specialist for calculadora-bmc.vercel.app (Vercel frontend) and panelin-calc Cloud Run (Node.js API). Handles deploy, rollback, diagnostics, env var sync, Cloud Run health, smoke tests, and pre-deploy checklist. Use when deploying to Vercel or Cloud Run, checking deploy status, investigating Cloud Run errors, syncing env vars, or running smoke tests against production."
model: sonnet
---

# BMC Deployment — Vercel + Cloud Run

**Project root:** `/Users/matias/Panelin calc loca/Calculadora-BMC`

---

## Architecture

```
calculadora-bmc.vercel.app   ← Vite/React frontend (Vercel)
panelin-calc (Cloud Run)     ← Node.js API (server/)
```

## Pre-deploy checklist

```bash
npm run pre-deploy           # health + contracts + env check + open items count
npm run gate:local:full      # lint + test + build
npm run smoke:prod           # smoke against canonical Cloud Run URL
```

All must pass before any production deploy.

## Vercel deploy

```bash
vercel --prod                # production deploy
vercel                       # preview deploy
```

Environment variables managed via Vercel dashboard or:
```bash
vercel env list
vercel env pull .env.local
```

Key Vercel env vars: `VITE_API_BASE`, `BMC_DISK_PRECHECK_SKIP`

## Cloud Run deploy

```bash
npm run ml:cloud-run         # syncs env vars to Cloud Run from .env
```

Manual deploy via `gcloud run deploy panelin-calc`.

Key env vars on Cloud Run: `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REDIRECT_URI`, `PUBLIC_BASE_URL`, `WEBHOOK_VERIFY_TOKEN`, `BMC_SHEET_ID`, `API_AUTH_TOKEN`, `GOOGLE_APPLICATION_CREDENTIALS`.

Secret Manager: `./scripts/cloud-run-matriz-sheets-secret.sh` mounts SA key.

## Smoke tests

```bash
npm run smoke:prod                          # full smoke
SMOKE_SKIP_MATRIZ=1 npm run smoke:prod      # skip MATRIZ check
npm run smoke:prod -- --json                # JSON output
```

Smoke checks: `GET /health`, `/capabilities`, `PUBLIC_BASE_URL`, `GET /api/actualizar-precios-calculadora` (CSV MATRIZ — critical), `GET /auth/ml/status`, `POST /api/crm/suggest-response`.

## Cloud Run diagnostics

Check logs:
```bash
gcloud run services logs read panelin-calc --limit=50
```

Or use `npm run start:api` locally to reproduce issues.

## Disk precheck

Build fails if disk < 1024 MiB free:
```bash
BMC_DISK_PRECHECK_SKIP=1 npm run build     # skip if needed
```

## Rollback

Vercel: promote previous deployment from dashboard or:
```bash
vercel rollback
```

## After deploy

1. Run `npm run smoke:prod` — must pass
2. Update `docs/team/PROJECT-STATE.md` with deploy entry
3. Notify `bmc-orchestrator` if any env vars changed (may affect other roles)

## Rules

- Never hardcode `PUBLIC_BASE_URL` — always from env
- Dev/preview vs prod: use `BMC_API_BASE` / `SMOKE_BASE_URL` overrides
- Never `--force` push to main without Matias approval
