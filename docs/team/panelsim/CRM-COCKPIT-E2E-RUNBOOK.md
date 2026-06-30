# CRM Cockpit — Interactive E2E Runbook

Operational guide for `scripts/cockpit-e2e.spec.ts`: an interactive end-to-end test
of the WA Cockpit (`/hub/wa`) that runs **against production** with a single,
configurable **aggressiveness knob**.

> **Why prod, and why "local" is no safer:** `dev:full`'s `DATABASE_URL` points at the
> same Supabase Postgres and the cockpit reads/writes the same shared `CRM_Operativo`
> Google Sheet as prod. Running locally does **not** isolate real data. The safety lever
> is *which endpoints the test calls* (the level), not *where it runs*.

## The aggressiveness ladder (`COCKPIT_E2E_LEVEL`)

| Level | What runs | Mutates? | Required config (else the run ABORTS before any write) |
|------|-----------|----------|--------------------------------------------------------|
| **0** (default) | Load `/hub/wa`, exercise queue reads (`ml-queue`, `wa-queue`, `unified-queue`, `/consultations`). Assert no 401/403/5xx, no console errors. | No | `TOUR_SESSION_COOKIE` |
| **1** | + `approval` / `quote-link` / `mark-sent` against ONE sentinel row; snapshot→restore in teardown. Never `send-approved`/`sync-*`. | Sheet cells AH/AI/AJ of the sentinel row only (auto-restored) | + `COCKPIT_E2E_TEST_ROW` (≥4), `GOOGLE_APPLICATION_CREDENTIALS`, `BMC_SHEET_ID` |
| **2** | + `send-approved`, only after verifying the row's destination matches the controlled target. | + a **real** message to the controlled target | + `COCKPIT_E2E_TEST_TARGET` |

The fail-closed guards live in `beforeAll`: a level requested without its required
config **throws before the browser opens**. CI's read-only job is handed *only* the
session-mint secrets, so even a tampered level can't escalate.

## How auth works (don't fight it)

The cockpit API requires `Authorization: Bearer <access-JWT>`, **not** a cookie.
`bmc_sess` is only the *refresh* cookie. The harness:

1. injects `bmc_sess` into the browser context,
2. navigates to `/hub` **once** so the SPA performs its single `POST /auth/refresh`,
3. captures the `accessToken` from that response and uses it as the Bearer for all
   in-page `fetch` calls.

Never trigger a second refresh (the refresh token rotates with reuse-detection — a
second use kills the session). That is why the whole run shares **one** context/page.

## Reserve the sentinel row (one-time, for levels 1–2)

Pick a row in `CRM_Operativo` (≥4) that is **not a real customer** and set:

- **col C (`cliente`)** → must contain the literal marker `[E2E-SENTINEL]`
  (the harness refuses to mutate any row whose `cliente` lacks this marker).
- **col D (`telefono`)** / **col F (`origen`)** → for **level 2**, set these so the row's
  resolved destination equals `COCKPIT_E2E_TEST_TARGET` (a phone you own / a sandbox
  `Q:id` / a test email). The harness compares the row's actual destination to
  `COCKPIT_E2E_TEST_TARGET` and aborts on mismatch — a stranger can't be messaged.
- Leave **col AK (`bloquearAuto`)** = `No` and **col AJ (`enviadoEl`)** empty so the row
  is in a sendable state.

Document the chosen row number; reserve it exclusively (a concurrent operator editing
it could race the snapshot/restore).

## Running it

```bash
# 0) Mint a session (prints the bmc_sess value to stdout)
export TOUR_SESSION_COOKIE="$(node scripts/mint-tour-session.mjs)"
#    requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN

# Level 0 — read-only (safe anywhere)
npm run test:e2e:cockpit

# Level 1 — sentinel-row writes
export COCKPIT_E2E_TEST_ROW=<n>
export BMC_SHEET_ID=<crm-spreadsheet-id>
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
npm run test:e2e:cockpit:writes

# Level 2 — guarded real send (sends ONE real message to the controlled target)
export COCKPIT_E2E_TEST_TARGET=<phone | Q:id | email>
npm run test:e2e:cockpit:send
```

## CI

- **`.github/workflows/ci.yml` → `cockpit_e2e_readonly`** runs **level 0** on push to
  `main`, `continue-on-error: true` (prod-health signal, not a deploy gate). It reuses the
  **existing** `TOUR_GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN` secrets (same ones
  `product-docs.yml` uses) — **no new secrets to provision**. Missing those → empty cookie →
  spec skips all → green no-op.
- **`.github/workflows/cockpit-e2e-writes.yml`** runs levels 1–2 **only** via
  `workflow_dispatch`, behind the protected `cockpit-e2e-writes` environment (set required
  reviewers in *Settings → Environments*). It reuses existing `TOUR_GOOGLE_*`, `GCP_SA_JSON`
  and `BMC_SHEET_ID`; the **only new** environment-scoped secrets are `COCKPIT_E2E_TEST_ROW`
  and `COCKPIT_E2E_TEST_TARGET`.

## Teardown & emergency restore

Teardown restores the sentinel row's **AH:AK** gate cells from a snapshot captured at
setup (FORMULA-rendered, so a HYPERLINK in AH survives). It runs even if a write fails
mid-run, because it uses the service account, independent of the browser session.

If a run is killed before teardown, restore manually:

```bash
# Capture BEFORE experimenting (prints {"row":N,"tail":[AH,AI,AJ,AK]})
node scripts/lib/cockpit-sentinel-restore.mjs --row <n> --capture

# Restore after (paste the 4-cell array)
node scripts/lib/cockpit-sentinel-restore.mjs --row <n> --restore '["=HYPERLINK(...)","No","","No"]'
```

**Irreversible by design:** level 2's external effects (the real message, the KB entry,
the Omni outbound mirror) cannot be undone — which is exactly why level 2 is gated on the
destination matching a target you control.

## Known limits

- `send-approved` cannot fire twice (post-send `enviadoEl` is set → re-run 400s). `retries=0`.
- Sheets `503`/no-config is treated as an environmental skip, not a failure (repo "never
  500 for Sheets" rule).
- `GET /api/crm/cockpit/row/:n` parses a HYPERLINK AH cell to `null` (display label, not a
  URL) — that's why the snapshot reads AH via the service account with `FORMULA` rendering.
