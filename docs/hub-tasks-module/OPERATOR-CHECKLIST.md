# Operator Checklist — Tareas Phase 1 Infrastructure Provisioning

**Status:** ⏸ **BLOCKED** — Phase 1 implementation is ready but cannot ship until these 3 prerequisites are provisioned.

**Created:** 2026-05-18  
**Verified by:** Phase B infrastructure audit  
**Operator:** [BMC SRE/DevOps]

---

## Summary

Phase B verification found that **3 critical new secrets + 1 API** do not yet exist in the production infrastructure. These must be created before Phase 1 can be deployed.

| Item | Status | Blocker? | Owner |
|------|--------|----------|-------|
| Google Tasks OAuth Client (GOOGLE_TASKS_CLIENT_ID / SECRET) | ❌ Missing | YES | Operator |
| SUPABASE_PGP_ENCRYPT_KEY (token encryption) | ❌ Missing | YES | Operator |
| Cloud Scheduler API + Cron Job | ❌ Missing | YES | Operator |
| DATABASE_URL | ✅ Exists | NO | — |

---

## Pre-Requisites

- GCP project `chatbot-bmc-live` with write access to Secret Manager
- Google Cloud Console access with OAuth 2.0 Client creation permissions
- `gcloud` CLI authenticated and configured for `chatbot-bmc-live`

```bash
# Verify setup
gcloud config get-value project
# Should return: chatbot-bmc-live

gcloud secrets list --project chatbot-bmc-live | head -5
# Should return existing secrets (e.g., GOOGLE_APPLICATION_CREDENTIALS)
```

---

## Step 1: Create Google Tasks OAuth Client

### 1.1 Create the OAuth Client in GCP Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → select `chatbot-bmc-live`
2. Navigate to **APIs & Services** → **Credentials**
3. Click **+ Create Credentials** → **OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Name: `Calculadora-BMC-Tareas` (or similar)
6. **Authorized redirect URIs**: Add exactly one:
   ```
   https://panelin-calc.run.app/auth/tasks/callback
   ```
   (Replace `panelin-calc` with your actual Cloud Run service name if different)
7. Click **Create**
8. A popup shows **Client ID** and **Client Secret** — **copy both immediately** (they won't be shown again)

### 1.2 Store in Secret Manager

```bash
# Set your client ID and secret (from the popup above)
CLIENT_ID="YOUR_CLIENT_ID_HERE"
CLIENT_SECRET="YOUR_CLIENT_SECRET_HERE"

# Create GOOGLE_TASKS_CLIENT_ID secret
echo -n "$CLIENT_ID" | gcloud secrets create GOOGLE_TASKS_CLIENT_ID \
  --project chatbot-bmc-live \
  --replication-policy automatic \
  --data-file -

# Create GOOGLE_TASKS_CLIENT_SECRET secret
echo -n "$CLIENT_SECRET" | gcloud secrets create GOOGLE_TASKS_CLIENT_SECRET \
  --project chatbot-bmc-live \
  --replication-policy automatic \
  --data-file -

# Verify both were created
gcloud secrets list --project chatbot-bmc-live | grep GOOGLE_TASKS
```

### 1.3 Grant Cloud Run service account access

```bash
# Get the Cloud Run service account (usually default Compute Engine SA)
SA_EMAIL=$(gcloud iam service-accounts list --project chatbot-bmc-live --format='value(email)' | grep -i "compute@")

# Grant secret accessor role on both secrets
gcloud secrets add-iam-policy-binding GOOGLE_TASKS_CLIENT_ID \
  --project chatbot-bmc-live \
  --member serviceAccount:${SA_EMAIL} \
  --role roles/secretmanager.secretAccessor

gcloud secrets add-iam-policy-binding GOOGLE_TASKS_CLIENT_SECRET \
  --project chatbot-bmc-live \
  --member serviceAccount:${SA_EMAIL} \
  --role roles/secretmanager.secretAccessor
```

**Status after step 1:** ✅ Operator has created OAuth client  
**Time estimate:** 5 min

---

## Step 2: Create SUPABASE_PGP_ENCRYPT_KEY

This key encrypts Google Tasks access tokens at rest in Supabase (the `oauth_tokens.access_token` column uses `pgp_sym_encrypt()`).

```bash
# Generate a random 32-byte base64-encoded key
PGP_KEY=$(openssl rand -base64 32)
echo "Generated key: $PGP_KEY"

# Create the secret in GCP Secret Manager
printf '%s' "$PGP_KEY" | gcloud secrets create SUPABASE_PGP_ENCRYPT_KEY \
  --project chatbot-bmc-live \
  --replication-policy automatic \
  --data-file -

# Verify creation
gcloud secrets versions access latest --secret SUPABASE_PGP_ENCRYPT_KEY --project chatbot-bmc-live
# Should print the key (copy and save securely for reference)

# Grant Cloud Run SA access
SA_EMAIL=$(gcloud iam service-accounts list --project chatbot-bmc-live --format='value(email)' | grep -i "compute@")
gcloud secrets add-iam-policy-binding SUPABASE_PGP_ENCRYPT_KEY \
  --project chatbot-bmc-live \
  --member serviceAccount:${SA_EMAIL} \
  --role roles/secretmanager.secretAccessor
```

**Status after step 2:** ✅ Operator has created encryption key  
**Time estimate:** 3 min

---

## Step 3: Enable Cloud Scheduler API + Create Sync Job

### 3.1 Enable the Cloud Scheduler API

```bash
gcloud services enable cloudscheduler.googleapis.com \
  --project chatbot-bmc-live
```

### 3.2 Generate HMAC Secret for Scheduler

Cloud Scheduler will call `/sync/google-tasks/pull` with an HMAC signature for verification.

```bash
# Generate a random 32-byte secret
HMAC_SECRET=$(openssl rand -base64 32)
echo "Generated HMAC secret: $HMAC_SECRET"

# Create the secret
printf '%s' "$HMAC_SECRET" | gcloud secrets create SYNC_HMAC_SECRET \
  --project chatbot-bmc-live \
  --replication-policy automatic \
  --data-file -

# Grant Cloud Run SA access
SA_EMAIL=$(gcloud iam service-accounts list --project chatbot-bmc-live --format='value(email)' | grep -i "compute@")
gcloud secrets add-iam-policy-binding SYNC_HMAC_SECRET \
  --project chatbot-bmc-live \
  --member serviceAccount:${SA_EMAIL} \
  --role roles/secretmanager.secretAccessor
```

### 3.3 Create Cloud Scheduler Job (runs every 60 seconds)

```bash
# Variables
SERVICE_URL="https://panelin-calc.run.app"  # Replace if different
SYNC_HMAC=$(gcloud secrets versions access latest --secret SYNC_HMAC_SECRET --project chatbot-bmc-live)
LOCATION="us-central1"

# Create the cron job (NOTE: Cloud Run HTTP targets use 'http', not 'app-engine')
gcloud scheduler jobs create http tasks-sync-60s \
  --project chatbot-bmc-live \
  --location ${LOCATION} \
  --schedule "* * * * *" \
  --uri "${SERVICE_URL}/sync/google-tasks/pull" \
  --http-method POST \
  --headers "X-Sync-Signature=${SYNC_HMAC}"

# Verify job was created
gcloud scheduler jobs list --project chatbot-bmc-live --location ${LOCATION}
```

**Troubleshooting 3.3:**
- If you get "Scheduler API not enabled", run step 3.1 and wait 30 seconds
- If you get "app-engine not found", use `--location us-central1` (or your preferred region)
- To test the job without waiting 60s: `gcloud scheduler jobs run tasks-sync-60s --project chatbot-bmc-live --location us-central1`

**Status after step 3:** ✅ Operator has configured Cloud Scheduler  
**Time estimate:** 5 min

---

## Step 4: Deploy Cloud Run with New Secrets Mounted

Once all secrets are created, the Cloud Run service must be re-deployed to mount them.

```bash
# From the calculadora-bmc repository root:
cd /Users/matias/calculadora-bmc

# Deploy (this picks up the new secrets automatically)
gcloud run deploy panelin-calc \
  --source . \
  --region us-central1 \
  --project chatbot-bmc-live \
  --allow-unauthenticated

# Verify deployment succeeded
gcloud run services describe panelin-calc \
  --project chatbot-bmc-live \
  --region us-central1 \
  --format='get(status.conditions[0])'
```

---

## Verification Checklist

After all steps complete, verify:

- [ ] **Step 1 verification:**
  ```bash
  gcloud secrets list --project chatbot-bmc-live | grep GOOGLE_TASKS
  # Should show both GOOGLE_TASKS_CLIENT_ID and GOOGLE_TASKS_CLIENT_SECRET
  ```

- [ ] **Step 2 verification:**
  ```bash
  gcloud secrets versions access latest --secret SUPABASE_PGP_ENCRYPT_KEY --project chatbot-bmc-live
  # Should print a non-empty base64 string
  ```

- [ ] **Step 3 verification:**
  ```bash
  gcloud scheduler jobs describe tasks-sync-60s \
    --project chatbot-bmc-live \
    --location us-central1
  # Should show the job with schedule "* * * * *" and state "ENABLED"
  ```

- [ ] **Step 4 verification:**
  ```bash
  curl -i https://panelin-calc.run.app/health
  # Should return 200 OK
  ```

- [ ] **OAuth flow manual test:**
  1. Visit https://calculadora-bmc.vercel.app/hub/tareas
  2. Click "🔗 Conectar Google Tasks"
  3. Complete Google consent flow
  4. Should be redirected to `/hub/tareas` with at least 1 task list visible

- [ ] **Sync verification (5 min after OAuth):**
  ```bash
  gcloud scheduler jobs run tasks-sync-60s \
    --project chatbot-bmc-live \
    --location us-central1
  
  # Then check Supabase
  psql $DATABASE_URL -c "SELECT COUNT(*) FROM tasks.sync_log WHERE created_at > now() - interval '5 min';"
  # Should return ≥ 1
  ```

---

## Rollback (if needed)

If something fails and you need to undo:

```bash
# Delete secrets
gcloud secrets delete GOOGLE_TASKS_CLIENT_ID --project chatbot-bmc-live
gcloud secrets delete GOOGLE_TASKS_CLIENT_SECRET --project chatbot-bmc-live
gcloud secrets delete SUPABASE_PGP_ENCRYPT_KEY --project chatbot-bmc-live
gcloud secrets delete SYNC_HMAC_SECRET --project chatbot-bmc-live

# Delete scheduler job
gcloud scheduler jobs delete tasks-sync-60s --project chatbot-bmc-live --location us-central1

# Delete OAuth client (manual step in GCP Console)
```

---

## What Happens Next

Once operator completes this checklist and all verifications pass:

1. Engineer runs: `npm run build` && `npm run gate:local`
2. Engineer pushes commit: `docs(project-state): Phase 1 infrastructure provisioned`
3. Phase 1 implementation begins (OAuth PKCE, CRUD, sync handler, UI wiring)
4. All code is pushed with atomic commits, each passing `npm run gate:local`
5. Final deploy to production

**Do not proceed with Phase 1 implementation until this checklist is 100% complete.**

---

## Questions?

Refer to:
- `docs/hub-tasks-module/PHASE-1-INFRASTRUCTURE.md` — Detailed infrastructure design rationale
- `docs/hub-tasks-module/04-roadmap.md` — Full Phase 0–4 roadmap and blockers
- `docs/hub-tasks-module/05-decisions.md` — ADRs including "why PGP encryption" and "why Cloud Scheduler"
