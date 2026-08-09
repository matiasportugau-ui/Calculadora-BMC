# Staging topology runbook — IMP-PEA-10

**Goal:** Isolated `panelin-calc-staging` + Postgres before L3 implement/replay in prod path (ADR-006).

## Prerequisites

- GCP project with Cloud Run + Cloud SQL (or Neon/Supabase staging DB)
- Doppler config `bmc-backend/staging` (or separate secret set)
- GitHub repo vars for staging service (see below)

## Steps

1. **Postgres staging** — new database; never share prod `DATABASE_URL`.
2. **Migrate PEA schema:**
   ```bash
   DATABASE_URL='postgresql://...staging...' node scripts/pea-apply-migration.mjs
   ```
3. **Cloud Run service** `panelin-calc-staging` — copy deploy workflow or manual deploy with:
   ```
   NODE_ENV=staging
   PEA_STAGING_MODE=1
   PEA_ENABLED=1
   PEA_WORKER_ENABLED=1
   PEA_ARCHITECT_MOCK=1
   PEA_IMPLEMENT_ENABLED=1
   PEA_PROJECT_LABEL=calculadora-bmc-staging
   PEA_DB_LABEL=staging-postgres
   BMC_SHEET_ID=<staging sheet IDs only>
   ```
4. **Isolation check:**
   ```bash
   PEA_STAGING_MODE=1 BMC_PROD_SHEET_ID=<prod-id> node scripts/pea-staging-config-check.mjs
   ```
5. **Verify:**
   ```bash
   BMC_API_BASE=https://panelin-calc-staging-... npm run pea:live-probe -- --markdown
   BMC_API_BASE=... npm run test:contracts
   ```
6. **48h soak** — worker drains jobs; no pino errors; PEA budget telemetry isolated (T11).

## Human gate

Matias approves staging infra cost + secrets before oleada 6 L3 E2E.

## CI

Job `pea_staging_config` in `.github/workflows/ci.yml` runs `npm run pea:staging-check` (skips when not staging mode).
