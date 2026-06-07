# Email ingest cron — runbook

Last updated: 2026-05-14
Owner: Matías Portugau · drives Step 7 of the Admin Cot F1 plan (Gap 3b).

## What this does

The endpoint `POST /api/crm/ingest-email` (`server/routes/bmcDashboard.js:2440`) accepts a parsed email body and writes the lead to **CRM_Operativo**, which is then surfaced to `/hub/cotizaciones` by the admin module.

The CLI script `scripts/email-snapshot-ingest.mjs` (npm script: `email:ingest-snapshot`) loops over a snapshot JSON (one entry per inbound email), dedupes against `.email-ingest/processed-ids.json`, and POSTs each eligible one.

This runbook describes how to schedule that loop so emails into the 6 `@bmcuruguay.com.uy` accounts land in CRM without anyone running the script manually.

## Data flow

```
inbox @ Netuy IMAP
        │
        ▼
sibling repo: conexion-cuentas-email-agentes-bmc
   - polls IMAP, normalizes message envelopes
   - writes data/snapshot-latest.json   (~30 MB)
        │
        ▼ (HOW? → see "Wiring options" below)
        │
GitHub Actions job: .github/workflows/email-ingest-scheduled.yml
   - downloads snapshot (or skips gracefully)
   - runs scripts/email-snapshot-ingest.mjs
        │
        ▼
POST /api/crm/ingest-email  (Cloud Run, panelin-calc)
        │
        ▼
CRM_Operativo Sheets (rows with Estado=Nuevo)
        │
        ▼
Admin module surfaces them once Gap 3a (Step 5) is also merged.
```

## Current status (2026-05-14)

- ✅ Workflow file scaffolded with `workflow_dispatch` (manual trigger).
- ⏸ **Cron schedule commented out** (line `# - cron: …`) until the snapshot source is reachable from GitHub Actions runners.
- ✅ Script and endpoint already production-ready (see `tests/emailIngestAuth.test.js`).

## Wiring options to enable the schedule

Pick **one** of these and document the choice here:

### Option A — Snapshot via signed URL (recommended for simplicity)

1. Have the sibling repo upload `snapshot-latest.json` to a private GCS bucket on every refresh (e.g. `gs://bmc-email-snapshots/snapshot-latest.json`).
2. Generate a signed URL valid 24h (rotate via another cron or Cloud Function).
3. Store as **GitHub repo secret** `BMC_EMAIL_SNAPSHOT_URL`.
4. Uncomment the `schedule:` block in the workflow.

**Pros:** zero coupling to a second GitHub repo; works whether the sibling repo lives on GitHub or only on your dev box.
**Cons:** signed URL must be rotated (or use a workload-identity OIDC mount).

### Option B — Sibling repo as private GitHub repo

1. Push `conexion-cuentas-email-agentes-bmc` to GitHub (private, same org `matiasportugau-ui`).
2. Create a PAT or use a GitHub App with repo access.
3. Modify `.github/workflows/email-ingest-scheduled.yml` to checkout the sibling repo into `../conexion-cuentas-email-agentes-bmc/` and set `BMC_EMAIL_SNAPSHOT_PATH` to its `data/snapshot-latest.json`.
4. Uncomment the `schedule:` block.

**Pros:** single source of truth; same auth model as the rest of the org.
**Cons:** the snapshot is **30 MB binary-ish JSON** — pushing it to git on every refresh churns history; consider Git LFS or a daily snapshot artifact instead of committing.

### Option C — Run from a local launchd / Mac cron on the dev box

1. Keep the sibling repo as a local-only thing.
2. Create a `launchd` plist on the BMC dev Mac (`~/Library/LaunchAgents/com.bmc.email-ingest.plist`) that runs `npm run email:ingest-snapshot` every 30 min while the laptop is on.
3. **Don't** enable the GitHub schedule.

**Pros:** zero new infra; works today.
**Cons:** coupled to a single physical machine being on.

## Required secrets (whichever option you pick)

- `EMAIL_INGEST_TOKEN` — Bearer token expected by `requireEmailIngestAuth` (see `server/lib/emailIngestAuth.js`). Already used by humans running the script manually; can be reused.
- `API_AUTH_TOKEN` — fallback if `EMAIL_INGEST_TOKEN` is not set; covers most existing API surfaces.
- `BMC_EMAIL_SNAPSHOT_URL` — only if you pick Option A.

Plus repo variable (no need to be secret):

- `BMC_API_BASE_PROD` — the Cloud Run prod URL. Default is hardcoded in the workflow as `https://panelin-calc-q74zutv7dq-uc.a.run.app` per existing patterns (see `smoke-prod-scheduled.yml`).

## Testing the workflow manually

```bash
# Via the GitHub UI:
#   Actions → Email ingest — scheduled → Run workflow
#   Inputs:
#     api_base: (blank to use prod default)
#     limit:    3            # small batch
#     dry_run:  1            # set to 1 first; flip to 0 once you trust it

# Via gh CLI:
gh workflow run "Email ingest — scheduled" \
  -f limit=3 \
  -f dry_run=1
```

Watch the run output:

- If `BMC_EMAIL_SNAPSHOT_URL` is unset, you'll see `::warning::Skipped — set BMC_EMAIL_SNAPSHOT_URL secret…` and the run exits green (so a non-wired cron doesn't spam red Xes).
- If the URL is set but auth fails, the script prints `POST /api/crm/ingest-email requiere auth…` and exits 1.

## Local development equivalent

```bash
# Make sure the sibling repo's snapshot is fresh:
ls -la "../conexion-cuentas-email-agentes-bmc/data/snapshot-latest.json"

# In one terminal, run the API:
npm run start:api

# In another, run the ingest:
EMAIL_INGEST_TOKEN=<token> npm run email:ingest-snapshot -- --limit 3 --dry-run
```

The script's dedupe file `.email-ingest/processed-ids.json` is gitignored — same set of IDs persists across dry-run and real runs, so do `--dry-run` first to inspect.

## Cadence rationale

Default cron (`*/30 12-22 * * 1-5`) = every 30 min during UY business hours (Mon-Fri 09:00-19:00 local = 12-22 UTC). ~100 runs/week. With the API ~50ms latency and Sheets append in <1s per email, a typical run completes in well under a minute. Free GitHub Actions minutes for private repos handle this easily.

If you find:
- **Too many duplicate "no new messages" runs** → bump cadence down to hourly (`0 12-22 * * 1-5`).
- **Too much latency on leads** → bump up to every 10 min (`*/10 12-22 * * 1-5`).

## Next steps (not in this PR)

- Gap 3a (Step 5 of F1): make `/hub/cotizaciones` actually surface CRM_Operativo rows with `Estado=Nuevo` in the admin queue. Until Gap 3a lands, ingested emails will sit in CRM but won't appear in the admin table.
- Move the sibling repo to GitHub (Option B), OR set up the GCS pipe (Option A) — pick one before flipping the cron on.
