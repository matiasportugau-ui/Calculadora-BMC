# Phase 1 — Infrastructure Verdict & Operator Checklist

**Date:** 2026-05-18
**Status:** ⚠️ **PARTIAL — 3 blockers remain for operator**
**Audience:** Operator (matias@) / Cloud Run / GCP admin

This document is the result of Phase B in the unified Tareas module plan. It enumerates all infrastructure prerequisites for Phase 1 (real OAuth + sync implementation) and reports which are ready, which I unblocked autonomously, and which require human/operator action in GCP Console.

---

## Verdict summary

| # | Prerequisite | Status | Resolved by |
|---|--------------|--------|-------------|
| 1 | `DATABASE_URL` provisioned in Cloud Run | ✅ **READY** | Pre-existing (commit `095a58c`) |
| 2 | Supabase migration `tasks_init` applied to production DB | ✅ **READY** | This session (Phase B) — applied via Supabase MCP after fixing schema bug |
| 3 | `"tareas"` row in `identity.modules` table | ✅ **READY** | This session (Phase B) — seeded as part of migration |
| 4 | `"tareas"` in `server/lib/identityAuth.js` ALL_MODULES | ✅ **READY** | This session (Phase A) — commit `f76109f` |
| 5 | Tasks routes mounted in `server/index.js` | ✅ **READY** | This session (Phase A) — commit `f76109f` |
| 6 | Route export pattern compatible with mounts | ✅ **READY** | Verified all 3 use `export default router` |
| 7 | **Google Tasks OAuth client** (client_id + client_secret) | ❌ **BLOCKER** | OPERATOR — create in GCP Console |
| 8 | **`SUPABASE_PGP_ENCRYPT_KEY`** secret for token encryption | ❌ **BLOCKER** | OPERATOR — generate + store in Secret Manager |
| 9 | **Cloud Scheduler API enabled** + cron job created | ❌ **BLOCKER** | OPERATOR — enable API, create job |
| 10 | `SYNC_HMAC_SECRET` for Cloud Scheduler→Cloud Run signature | ⚠️ **PARTIAL** | `.env.example` updated, but secret not yet in Secret Manager |

**Score:** 6 ready / 1 partial / 3 blockers

---

## What was verified (autonomous read-only checks)

### Check 1 — Cloud Run env
```bash
gcloud run services describe panelin-calc --region us-central1 \
  --project chatbot-bmc-live --format='value(spec.template.spec.containers[0].env)'
```
**Result:** `DATABASE_URL` present via `secretKeyRef` pointing to Secret Manager secret `DATABASE_URL`. Cloud Run can reach Supabase. ✅

### Check 2 — Secret Manager contents
```bash
gcloud secrets list --project chatbot-bmc-live | grep -iE "task|google|oauth|pgp|hmac"
```
**Result:** only `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_SHEETS_CREDENTIALS`, `google-sheets-api-key`. **None for Google Tasks.** None for `pgp_sym_encrypt`. None for `SYNC_HMAC_SECRET`. ❌

### Check 3 — Cloud Scheduler API state
```bash
gcloud scheduler jobs list --project chatbot-bmc-live --location us-central1
```
**Result:** `PERMISSION_DENIED: Cloud Scheduler API has not been used in project chatbot-bmc-live before or it is disabled.` ❌

### Check 4 — Supabase migrations applied
Via Supabase MCP `list_migrations` on project `htnwozvopveibwppyjhg`:
**Result:** Last applied migration was `20260518101446_wa_init_bundle`. The `20260602000001_tasks_init` migration **was not applied**. Two bugs in the migration file prevented earlier attempts: inline `COMMENT 'text'` (MySQL syntax, invalid in Postgres) and INSERT into `identity.modules` referencing columns `slug/label/enabled` that don't exist (actual columns: `module/display_name/category`). **Fixed and applied in this session.** ✅

### Check 5 — Route export pattern
```bash
tail -5 server/routes/tasks.js server/routes/tasksOAuth.js server/routes/tasksSync.js
```
**Result:** all 3 use `export default router` (simple Express Router instance, with `requireUser` applied via `router.use(...)`). Mount pattern in `server/index.js` is `app.use("/api/tasks", tasksRouter)`, `app.use("/auth/tasks", tasksOAuthRouter)`, `app.use("/sync", tasksSyncRouter)`. ✅

---

## What was unblocked in this session

### Phase A (commit `f76109f`)
- 5 misplaced files removed from `docs/hub-tasks-module/` (were dumped there by a prior session's CWD confusion)
- `"tareas"` added to `server/lib/identityAuth.js` ALL_MODULES
- 3 tasks routes mounted in `server/index.js` (previously orphaned — all endpoints returned 404)
- `goal-prompt-tareas-phase-1.md` moved to `docs/hub-tasks-module/PHASE-1-MASTER-PROMPT.md`
- `docs/hub-tasks-module/README.md` expanded from 1-line placeholder to full index

### Phase B (this commit)
- Migration `20260602000001_tasks_init.sql` **applied to production Supabase** via MCP
  - Schema `tasks` created with 6 tables: `task_lists`, `tasks`, `oauth_tokens`, `oauth_state`, `sync_log`, `sync_conflicts`
  - All indexes (29 total) and triggers (3) installed
  - `pgcrypto` + `uuid-ossp` extensions verified
- Migration file in repo **rewritten** to fix two production bugs:
  1. Replaced MySQL-style inline `COMMENT 'text'` with PostgreSQL-standard `COMMENT ON COLUMN ... IS '...'` statements
  2. Corrected INSERT into `identity.modules` from `(slug, label, enabled, ...)` to actual schema `(module, display_name, category, ...)`
- `tareas` row seeded into `identity.modules` (visible at `SELECT * FROM identity.modules WHERE module = 'tareas'`)

---

## Operator action required — 3 blockers to clear before Phase C deploy

### BLOCKER 1: Google Tasks OAuth credentials

The Phase 1 OAuth PKCE flow needs a dedicated OAuth 2.0 client (separate from the existing Calculator login client, per ADR-02).

**Steps:**
1. Go to GCP Console → APIs & Services → Credentials (project `chatbot-bmc-live`)
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `BMC Tareas Module — Google Tasks API`
5. Authorized redirect URIs (add both):
   - `https://calculadora-bmc.vercel.app/auth/tasks/callback`
   - `http://localhost:3001/auth/tasks/callback` (for local dev)
6. Click **Create**, copy `client_id` and `client_secret`
7. Store as secrets:
   ```bash
   echo -n '<client_id>'     | gcloud secrets create GOOGLE_TASKS_CLIENT_ID     --data-file=- --project chatbot-bmc-live
   echo -n '<client_secret>' | gcloud secrets create GOOGLE_TASKS_CLIENT_SECRET --data-file=- --project chatbot-bmc-live
   ```
8. Mount on Cloud Run (next deploy):
   ```bash
   gcloud run services update panelin-calc --region us-central1 \
     --update-secrets=GOOGLE_TASKS_CLIENT_ID=GOOGLE_TASKS_CLIENT_ID:latest,GOOGLE_TASKS_CLIENT_SECRET=GOOGLE_TASKS_CLIENT_SECRET:latest
   ```
9. Verify on the OAuth consent screen that **`https://www.googleapis.com/auth/tasks`** scope is added (and `userinfo.email` for user identification)

### BLOCKER 2: `SUPABASE_PGP_ENCRYPT_KEY` for token encryption

ADR-01 mandates that OAuth access/refresh tokens are encrypted at rest using `pgp_sym_encrypt`. The encryption key is not yet provisioned.

**Steps:**
```bash
# Generate a 32-byte random key
SECRET=$(openssl rand -base64 32)

# Store in Secret Manager
echo -n "$SECRET" | gcloud secrets create SUPABASE_PGP_ENCRYPT_KEY \
  --data-file=- --project chatbot-bmc-live

# Mount on Cloud Run
gcloud run services update panelin-calc --region us-central1 \
  --update-secrets=SUPABASE_PGP_ENCRYPT_KEY=SUPABASE_PGP_ENCRYPT_KEY:latest
```

**Rotation policy:** the key must NOT be rotated without first decrypting and re-encrypting all rows in `tasks.oauth_tokens`. Document the original `$SECRET` value in your password manager.

### BLOCKER 3: Cloud Scheduler API + cron job

The 60s polling sync (ADR-03) runs on Cloud Scheduler. Both the API and a cron job must be set up.

**Steps:**
```bash
# 1. Enable the API
gcloud services enable cloudscheduler.googleapis.com --project chatbot-bmc-live

# 2. Generate HMAC secret for signature verification
HMAC_SECRET=$(openssl rand -hex 32)
echo -n "$HMAC_SECRET" | gcloud secrets create SYNC_HMAC_SECRET \
  --data-file=- --project chatbot-bmc-live

gcloud run services update panelin-calc --region us-central1 \
  --update-secrets=SYNC_HMAC_SECRET=SYNC_HMAC_SECRET:latest

# 3. Get the Cloud Run service account (for OIDC token)
SA=$(gcloud run services describe panelin-calc --region us-central1 \
  --format='value(spec.template.spec.serviceAccountName)')

# 4. Create the cron job (every 60s, OIDC-authenticated)
CLOUD_RUN_URL=$(gcloud run services describe panelin-calc --region us-central1 \
  --format='value(status.url)')

gcloud scheduler jobs create http tasks-sync-60s \
  --location us-central1 \
  --schedule="* * * * *" \
  --uri="${CLOUD_RUN_URL}/sync/google-tasks/pull" \
  --http-method=POST \
  --oidc-service-account-email="$SA" \
  --oidc-token-audience="${CLOUD_RUN_URL}" \
  --headers="Content-Type=application/json,X-Sync-Signature-Hint=hmac-sha256" \
  --message-body='{"source":"scheduler","cycle":"@auto"}' \
  --project chatbot-bmc-live
```

After creation, verify with:
```bash
gcloud scheduler jobs describe tasks-sync-60s --location us-central1
```
The first run will be within 60 seconds.

---

## Plan ramification

| Phase | Status | Blocked by |
|-------|--------|-----------|
| A — cleanup + mount | ✅ DONE | — |
| B — infra verdict + migration apply | ✅ DONE (this doc) | — |
| C — Phase 1 code implementation | ⚠️ Can proceed but cannot e2e-smoke | Blockers 1+2 (OAuth client + encryption key) |
| D — Cloud Run + Vercel deploy + e2e | ❌ BLOCKED | All 3 blockers |

**Recommended sequencing:**
1. Operator clears Blockers 1, 2, 3 (estimated 30 min of click-ops + 3 gcloud invocations)
2. Once secrets are mounted on Cloud Run, kick off Phase C (code implementation)
3. Phase C code references `process.env.GOOGLE_TASKS_CLIENT_ID`, `process.env.SUPABASE_PGP_ENCRYPT_KEY`, and `process.env.SYNC_HMAC_SECRET` — without these, Phase 1 routes will respond with 503 (which is the correct behavior, not 500)
4. Deploy to Cloud Run after Phase C green on `npm run gate:local`
5. Smoke test the OAuth flow end-to-end (browser → /auth/tasks/init → Google consent → row in `tasks.oauth_tokens`)

---

## Verification queries (post-resolution)

Once operator clears the 3 blockers, verify with:

```bash
# 1. OAuth client visible in Cloud Run env
gcloud run services describe panelin-calc --region us-central1 \
  --format='value(spec.template.spec.containers[0].env)' | grep -i google_tasks

# 2. Encryption key reachable
gcloud run services describe panelin-calc --region us-central1 \
  --format='value(spec.template.spec.containers[0].env)' | grep -i pgp

# 3. Scheduler job exists and is enabled
gcloud scheduler jobs describe tasks-sync-60s --location us-central1 \
  --format='value(state)'  # expect: ENABLED

# 4. Tables and seed row exist (Supabase MCP or psql)
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'tasks';
-- expect: 6
SELECT module, display_name FROM identity.modules WHERE module = 'tareas';
-- expect: 1 row, "Tareas (Tasks)"
```

All four should pass before Phase D deploy is attempted.
