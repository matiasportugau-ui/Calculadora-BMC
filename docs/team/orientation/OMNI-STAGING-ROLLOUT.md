# Omni WAVE 2 → WAVE 3 — Staging Rollout Procedure

**PR:** [#406](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/406) (`feat/omni-wave3`)  
**Date:** 2026-06-22  
**Canonical wave doc:** [`docs/transformation/21-wave-execution.md`](../../transformation/21-wave-execution.md)

---

## Pre-merge local validation (completed)

| Check | Result | Notes |
|-------|--------|-------|
| `npm run gate:local` | PASS | 2026-06-22 |
| `npm run wave3:exit-gate` | PASS | `ready_for_wave4: true`; use `SKIP_SMOKE_OMNI=1` if API not up |
| `npm run test:omni:parity` | PASS | WA 2, Email 6, ML 2 |
| `npm run omni:migrate` | PASS | `001_core`, `002_ai_automation`, `003_deals_knowledge` applied on dev DB |
| `npm run omni:backfill-wa -- --dry-run --limit 5` | PASS | 0 rows (empty WA DB) — report in `.runtime/omni-backfill-wa-report-*.json` |
| `npm run omni:migrate-wa-rules -- --dry-run` | PASS | 0 wa_rules |
| `npm run smoke:prod` | PASS | MATRIZ CSV OK |

**Blocked locally (needs staging env):**

- `omni:backfill-ml-crm` / `omni:backfill-email-crm` — require `BMC_SHEET_ID` + Sheets creds
- Shadow flag soak (24h per channel) — Cloud Run / staging env only
- `GET /api/omni/metrics` live smoke — needs API + auth on staging

---

## WAVE 2 exit (staging operator checklist)

Run **after PR #406 merge** on staging Cloud Run (`panelin-calc` preview or staging service).

1. **Migrate:** `DATABASE_URL=<staging> npm run omni:migrate`
2. **Enable one channel at a time** (env on Cloud Run, default OFF in prod):

   | Flag | Value |
   |------|-------|
   | `OMNI_WA_SHADOW_WRITE` | `1` |
   | `OMNI_ML_SHADOW_WRITE` | `1` |
   | `OMNI_EMAIL_SHADOW_WRITE` | `1` |

3. **Backfills (dry-run first):**
   ```bash
   npm run omni:backfill-wa -- --dry-run
   npm run omni:backfill-ml-crm -- --dry-run
   npm run omni:backfill-email-crm -- --dry-run
   ```
4. **Parity:** `npm run test:omni:parity`
5. **API smoke:** `GET /api/omni/health`, `GET /api/omni/conversations` (Bearer + `canales:read`)
6. **Soak:** 24h per channel, error rate &lt; 0.1% — record in `.runtime/omni-wave2-soak-<channel>.md`

**Do not proceed to WAVE 3 until all three channels pass soak.**

---

## WAVE 3 exit (staging operator checklist)

**Entry:** WAVE 2 exit green.

1. **Migrate 002:** `npm run omni:migrate` (idempotent)
2. **Enable staging flags:**

   | Flag | Value |
   |------|-------|
   | `OMNI_EVENT_BUS_ENABLED` | `1` |
   | `OMNI_AI_ORCHESTRATOR_ENABLED` | `1` |
   | `OMNI_AUTOMATION_ENABLED` | `1` |

3. **WA rules:** `npm run omni:migrate-wa-rules` (dry-run first)
4. **Metrics:** `GET /api/omni/metrics` → 200
5. **Exit gate:** `BMC_API_BASE=<staging> npm run wave3:exit-gate`
6. **Reconcile:** `npm run omni:reconcile-channels`
7. **Manual (1h+):**
   - E1+E2 classify/suggest on ingest verified
   - F2 automation error rate &lt; 10% over 1h
   - Runbooks RB-OMNI-001/003 exercised

---

## Production deploy (post-UAT)

1. Merge PR #406
2. `npm run pre-deploy` (fix `.env` line 301 if script fails locally)
3. Deploy API — **all `OMNI_*` flags OFF** (see `.env.example`)
4. `DATABASE_URL=<prod> npm run omni:migrate` (DDL only)
5. **Do not** enable shadow or WAVE 3 flags until operator UAT on staging complete

---

## WAVE 4 gates (deals + HITL + eval)

PR [#407](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/407) is gated by 3 checks. Each gate's
**code path** is verified offline by the self-provisioning E2E; the gates themselves still need real
staging data (real suggestions to review, real deals vs the CRM Sheet).

**Local pre-check (sandbox-only, run anywhere):**
```bash
npm run omni:local-e2e
```
Stands up a throwaway Postgres, applies omni migrations, exercises HITL accept/reject + H4 eval stats +
F3 reconcile drift, then tears down. Triple-guarded (dedicated `OMNI_E2E_DATABASE_URL`, local host, db
name must contain `e2e`, must differ from `DATABASE_URL`) so it can never touch a real DB. Also runnable
as part of the exit gate with `OMNI_E2E=1 npm run wave4:exit-gate` (off by default).

**The 3 staging gates (run against staging Cloud Run with `OMNI_AI_ORCHESTRATOR_ENABLED=1`):**
- **HITL accept/reject E2E** — `GET /api/omni/suggestions` → `POST /api/omni/suggestions/:id/accept` and
  `/reject` with a `canales:write` Bearer. NOTE: accept/reject only flip `approval_state` + record eval;
  they do **not** send a channel reply (that's the separate `POST /api/omni/conversations/:id/reply`).
- **F3 dual-write reconcile drift < 10** — `DATABASE_URL=<staging> BMC_SHEET_ID=<id> npm run omni:reconcile-deals`
  → JSON `{ drift_count, ok: drift_count < 10 }`.
- **H4 eval report** — `GET /api/omni/ai/eval?task_key=suggest` → `{accepted, rejected, ...}` per prompt_version.

Tier B (full HTTP+auth+route) was validated locally against the identity schema with a minted JWT; that
path is not automated because it requires reconstructing Supabase roles/RLS (environment-specific).

## References

- [`docs/transformation/wave-3/README.md`](../../transformation/wave-3/README.md)
- [`scripts/wave3-exit-gate.mjs`](../../../scripts/wave3-exit-gate.mjs)
- [`PROCEDIMIENTO-PRE-PR-LOCAL.md`](../PROCEDIMIENTO-PRE-PR-LOCAL.md)
