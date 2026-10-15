# Desk API Production Migration Runbook

**Date:** 2026-10-15  
**Owner:** Matias Portugau  
**Status:** Ready for Execution  
**Timeline:** ~30 minutes (+ 24h monitoring)

---

## Overview

This runbook executes the migration of the **Desk review queue** from legacy **Sheets-only** to **PostgreSQL backend with API-first architecture**. The new `/api/desk/*` routes enable programmatic quote review, automated routing, and price-snapshot isolation.

### Key Requirements Met

✅ **Schema Migration:** `001_desk.sql` (matriz_snapshots + desk_reviews tables)  
✅ **Routes Coded:** `GET /api/desk/queue`, `GET /api/desk/reviews/:id`, `POST /api/desk/reviews`, `PATCH /api/desk/reviews/:id`  
✅ **Business Logic:** Frozen snapshot pricing (D6), causa root-cause tracking (D10), sold amount validation (D14)  
✅ **Tests Passing:** 6/6 deskQueue tests verified  
✅ **freezeMatriz() Implementation:** Completed with idempotent snapshot capture

### No Breaking Changes

- Desk `:8787` continues reading/writing to Sheets during migration
- New API endpoints available but not yet wired to Sheets queue
- Full rollback capability (drop tables, revert Cloud Run)

---

## Pre-Migration Checklist (Verify These First)

- [ ] Postgres connection verified on Cloud Run instance
- [ ] `calculadora-bmc/.claude/worktrees/desk-api-deploy` has matrizSnapshot.js + updated desk.js
- [ ] All 6 deskQueue tests passing locally: `npm run test:core`
- [ ] No uncommitted changes in worktree
- [ ] Backup of prod Postgres database created (manual step outside this runbook)

---

## Migration Steps

### Step 1: Apply Database Schema Migration

**On Production Postgres Instance:**

```bash
# SSH to Cloud Run instance or use gcloud sql proxy
psql -h <prod-db-host> -U postgres -d calculadora_bmc << 'EOF'

-- Run the migration: create matriz_snapshots and desk_reviews tables
\i /path/to/server/migrations/desk/001_desk.sql

-- Verify table creation
\dt matriz_snapshots desk_reviews

-- Confirm zero rows (expected for first deployment)
SELECT COUNT(*) FROM matriz_snapshots;
SELECT COUNT(*) FROM desk_reviews;

EOF
```

**Expected Output:**
```
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX

 public | desk_reviews      | table | postgres
 public | matriz_snapshots  | table | postgres

count
-------
    0

count
-------
    0
```

**If Error:**
- Check migration syntax: `cat server/migrations/desk/001_desk.sql`
- Verify connection and permissions (postgres user can CREATE TABLE)
- Roll back (see **Rollback** section below)

---

### Step 2: Verify Table Schema

**On Prod Postgres:**

```bash
psql -h <prod-db-host> -U postgres -d calculadora_bmc << 'EOF'

-- Verify matriz_snapshots schema
\d matriz_snapshots

-- Verify desk_reviews schema
\d desk_reviews

-- Verify foreign key constraint
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name = 'desk_reviews' AND column_name = 'matriz_version';

EOF
```

**Expected Output:**
```
Table "public.matriz_snapshots"
 id          | bigint
 version     | text
 data        | jsonb
 source      | text
 created_by  | text
 created_at  | timestamp

Table "public.desk_reviews"
 id                  | bigint
 quote_id            | text
 conversation_id     | uuid
 contact_id          | uuid
 channel             | text
 matriz_version      | text (FK → matriz_snapshots.version)
 payload             | jsonb
 interp              | jsonb
 faltantes           | jsonb
 caused_by           | text
 sold_amount_usd     | numeric
 status              | text
 created_by          | text
 created_at          | timestamp
 updated_at          | timestamp
```

**If Missing Columns:**
- Abort migration (tables are incompatible)
- Drop tables and re-run `001_desk.sql` with corrected schema
- Verify in staging before retrying on prod

---

### Step 3: Deploy Updated Cloud Run

**Deploy to Cloud Run `panelin-calc` (prod revision):**

```bash
cd ~/calculadora-bmc

# Ensure HEAD is on main with matrizSnapshot.js + updated desk.js
git log --oneline -1  # Verify latest commit includes desk API changes

# Build and deploy to Cloud Run
npm run pre-deploy   # Green gate check locally first
gcloud run deploy panelin-calc \
  --region us-central1 \
  --project chatbot-bmc-live \
  --source .
```

**Expected Output:**
```
✓ Deploying container to Cloud Run service [panelin-calc] in region [us-central1]
✓ Routing traffic...
✓ Done
Service panelin-calc deployed
Revision: panelin-calc-xxxxx
```

**Post-Deploy Verification:**

```bash
# Check health endpoint
curl -H "Authorization: Bearer <API_TOKEN>" \
  https://panelin-calc.run.app/api/health

# Expected: {"status":"ok","db":"connected"}
```

**If Deployment Fails:**
- Check Cloud Run logs: `gcloud run logs read panelin-calc --region us-central1`
- Verify environment variables set (DB_URL, API_AUTH_TOKEN)
- Rollback to previous revision if critical error

---

### Step 4: Smoke Test — Manual Quote to Desk Review

**Objective:** Verify end-to-end flow: quote → new `/api/desk/reviews` POST → row persisted to Postgres

**Test Case:**

```bash
# 1. Create a test quote (or use existing quoteId)
QUOTE_ID="test-quote-$(date +%s)"

# 2. Capture current Matriz CSV
# (In production, this comes from actualizar-precios endpoint or Sheets)
MATRIZ_CSV=$(curl -s https://your-matriz-source/export.csv)

# 3. POST desk review with matrizCsv (triggers auto-freeze)
curl -X POST https://panelin-calc.run.app/api/desk/reviews \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "quoteId": "'$QUOTE_ID'",
    "channel": "manual",
    "matrizCsv": "'$MATRIZ_CSV'",
    "payload": {"sku": "GLDCAM", "qty": 2},
    "interp": {"user": "test-user"},
    "faltantes": []
  }'

# Expected 201 response:
# {
#   "ok": true,
#   "review": {
#     "id": 1,
#     "quote_id": "test-quote-xxx",
#     "matriz_version": "MATRIZ-20261015-142530-a1b2",
#     "status": "pending",
#     "created_at": "2026-10-15T14:25:30Z"
#   }
# }
```

**Verify in Postgres:**

```bash
psql -h <prod-db-host> -U postgres -d calculadora_bmc << 'EOF'

-- Check matriz_snapshots was created
SELECT version, created_at FROM matriz_snapshots ORDER BY created_at DESC LIMIT 1;

-- Check desk_reviews row was inserted
SELECT id, quote_id, matriz_version, status FROM desk_reviews
WHERE quote_id LIKE 'test-quote-%' ORDER BY created_at DESC LIMIT 1;

EOF
```

**Expected:**
- Row exists in both tables
- FK constraint verified (matriz_version matches an existing snapshot version)
- created_at timestamps are recent (within last minute)

**If Test Fails:**

| Error | Action |
|-------|--------|
| 401 Unauthorized | Verify API_AUTH_TOKEN in Cloud Run env vars |
| 400 matrizVersion_required | Check that matrizCsv is valid CSV (has headers + rows) |
| 503 db_unavailable | Verify Postgres connectivity from Cloud Run |
| FK violation | Frozen snapshot failed; check freezeMatriz() logs |

---

### Step 5: Monitor Desk Queue for 24 Hours

**Monitoring Checklist:**

- [ ] **Error Rate:** `/api/desk/reviews` POST requests with status 5xx → target 0%
- [ ] **Database Integrity:** No NULL matriz_version values in desk_reviews (every review has snapshot FK)
- [ ] **Latency:** Desk queue processing latency acceptable (< 500ms per review)
- [ ] **Sheets Sync:** Legacy Sheets queue still functional (fallback verification)

**Commands to Run Periodically:**

```bash
# Check for any 500+ errors in Cloud Run logs
gcloud run logs read panelin-calc --region us-central1 --limit=100 | grep -i "error\|failed\|5[0-9]{2}"

# Count desk_reviews rows created in last 24h
psql -h <prod-db-host> -U postgres -d calculadora_bmc << 'EOF'
SELECT DATE(created_at) as date, COUNT(*) as review_count
FROM desk_reviews
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE(created_at)
ORDER BY date DESC;
EOF

# Verify no orphaned desk_reviews (FK violations should be caught at INSERT, but double-check)
SELECT COUNT(*) as orphaned_reviews
FROM desk_reviews dr
WHERE NOT EXISTS (SELECT 1 FROM matriz_snapshots ms WHERE ms.version = dr.matriz_version);
```

**Success Criteria (After 24h):**
- ✓ 0 desk_reviews rows with NULL matriz_version
- ✓ 0 orphaned FK references
- ✓ No 500+ errors in logs (warnings OK)
- ✓ Desk queue processing latency stable

**If Issues Found:**

| Issue | Mitigation |
|-------|-----------|
| High error rate (> 5%) | Investigate error logs, identify root cause, rollback if severe |
| FK violations | Check freezeMatriz() idempotency; re-run migration on staging |
| Latency spike (> 1s) | Check Postgres resource usage, consider index tuning |

---

## Rollback Plan

**If Critical Issues Found During Step 4-5:**

### Rollback Option 1: Full Revert (Safest)

**On Production Postgres:**

```bash
psql -h <prod-db-host> -U postgres -d calculadora_bmc << 'EOF'

-- Drop desk_reviews first (has FK to matriz_snapshots)
DROP TABLE IF EXISTS desk_reviews;

-- Drop matriz_snapshots
DROP TABLE IF EXISTS matriz_snapshots;

-- Verify tables removed
\dt | grep -E "desk_reviews|matriz_snapshots"
-- (should return no results)

EOF
```

**On Cloud Run:**

```bash
# Revert to previous revision
gcloud run deploy panelin-calc \
  --region us-central1 \
  --project chatbot-bmc-live \
  --revision <previous-revision-id>

# Or redeploy main without desk API changes
git checkout main
npm run pre-deploy
gcloud run deploy panelin-calc --region us-central1 --project chatbot-bmc-live --source .
```

**Result:** Desk queue reverts to Sheets-only, all data safe, zero data loss

### Rollback Option 2: Partial Revert (If Only App Issue)

If Postgres migration is successful but Cloud Run deployment has a bug:

```bash
# Revert Cloud Run to previous revision (keep schema)
gcloud run revisions list --service panelin-calc --region us-central1 \
  --project chatbot-bmc-live --sort-by created_at --limit 5

gcloud run deploy panelin-calc \
  --revision <previous-working-revision> \
  --region us-central1 \
  --project chatbot-bmc-live
```

**Result:** API reverts, but schema stays (allows for hot-fix without re-migration)

---

## Post-Migration Checklist

- [ ] All 24h monitoring checks passed
- [ ] Desk queue continues processing with new API
- [ ] Zero orphaned FK references confirmed
- [ ] Legacy Sheets fallback still accessible (verification complete)
- [ ] Cloud Run revision tagged as stable (document revision ID)
- [ ] Update docs/team/PROJECT-STATE.md with D6 completion
- [ ] Update KNOWLEDGE.md with snapshot implementation details

---

## Communication

**Notify Stakeholders After Step 3:**

```
📢 Desk API now live on Postgres (Cloud Run `panelin-calc`)

✅ Completed:
- Schema migration (matriz_snapshots + desk_reviews)
- New `/api/desk/*` routes deployed
- Quote review snapshots now frozen at quote-creation time

⏱️ Monitoring for 24h — expect zero impact on Desk workflow

🔙 Rollback available if issues found

Questions? Check docs/team/procedures/DESK-API-PROD-MIGRATION.md
```

---

## Related Documentation

- [Desk API Design Doc](../../decisions/DESK-API-DESIGN.md)
- [matrizSnapshot Implementation](../../../server/lib/matrizSnapshot.js)
- [deskQueue Business Logic](../../../server/lib/deskQueue.js)
- [001 Database Migration](../../../server/migrations/desk/001_desk.sql)

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-15 | Matias | Initial runbook for production deployment |
