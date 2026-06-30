# Runbook — WhatsApp canonical flip (`OMNI_WA_CANONICAL`)

Operator procedure to turn the WhatsApp ingest flip (ADR-009) ON in production
and roll it back. Companion to [`OMNI-STAGING-ROLLOUT.md`](../orientation/OMNI-STAGING-ROLLOUT.md).

## What the flag does

`OMNI_WA_CANONICAL` (Cloud Run env, sourced from GitHub repo Variable
`OMNI_WA_CANONICAL` via `.github/workflows/deploy-calc-api.yml`).

- **OFF (default):** today's behaviour — Meta webhook → in-memory map → 5-min
  timer → `processWaConversation` (CRM Sheets + `callAgentOnce` AF–AG + auto-learn)
  + Omni shadow-write. WhatsApp is processed twice.
- **ON:** Omni is the single path — the webhook `await`s `normalizeAndPersist`;
  the in-memory map / 5-min timer / 🚀 trigger / duplicate `callAgentOnce` are
  disabled; CRM Sheets ingest + auto-learn run as the durable `wa_crm_sync` job
  on `omni_ai_jobs` (one row per phone, per-conversation coalesced). The
  `wa_messages` mirror still runs, so the `/hub/wa` cockpit is unaffected.

## Preconditions (all must hold before setting the variable to 1)

- [ ] Prod repo Variables already ON: `OMNI_EVENT_BUS_ENABLED=1`,
      `OMNI_AI_ORCHESTRATOR_ENABLED=1` (they are — PROJECT-STATE 2026-06-23). The
      `wa_crm_sync` job only fires when the bus + orchestrator are live.
- [ ] Migration `011_wa_crm_sync_job.sql` applied to prod:
      `DATABASE_URL=<prod> npm run omni:migrate` (idempotent — widens a CHECK +
      adds a partial index; the omni tables already exist).
- [ ] `OMNI_WA_CANONICAL` is wired into `deploy-calc-api.yml` (done) so the repo
      Variable actually reaches Cloud Run.
- [ ] Owner decisions confirmed:
  - **AF–AG retirement** — under canonical mode the WA-driven AF–AG AI auto-fill
    is dropped (single AI = the Omni `suggest` job). Confirm no Sheet/wolfboard
    consumer depends on it.
  - **Upsert-by-phone** — CRM_Operativo reuses the existing row for a phone
    instead of appending. Confirm this matches how WA leads should appear.
  - **🚀 manual trigger** — disabled in canonical mode; confirm not needed.
- [ ] Staging soak passed (below).

## Validation gate (local / staging, needs Postgres)

`npm run omni:local-e2e` now includes a **WA-CANONICAL** gate (migration 011
CHECK + partial index, `wa_crm_sync` enqueue, per-conversation coalescing,
classify/suggest NOT coalesced, `enqueueIngestAiJobs` integration). Run it on any
host/container with Postgres binaries before promoting. (CI skips it cleanly when
Postgres is absent.)

## Staging soak (24h)

1. Apply migration 011 to staging.
2. Set staging repo Variable `OMNI_WA_CANONICAL=1`; redeploy the staging API.
3. Send/observe real WhatsApp traffic for 24h. Watch:
   - `omni_ai_jobs` where `job_type='wa_crm_sync'`: `completed` ≫ `dead`; no
     runaway `pending` backlog.
   - CRM_Operativo **row growth stays bounded** (one row per phone — must NOT
     balloon; that would mean upsert-by-phone isn't matching).
   - Daily AI budget (`OMNI_AI_DAILY_BUDGET_USD`) not exhausted by the new load.
   - `/hub/wa` cockpit still shows conversations (the `wa_messages` mirror).
4. Spot-check: a WA conversation produces exactly one CRM_Operativo row and an
   Omni suggestion (`omni_suggestions`), and NO legacy AF–AG write.

## Production flip

1. Confirm preconditions + soak green.
2. Set prod repo Variable `OMNI_WA_CANONICAL=1`.
3. Trigger `deploy-calc-api` (push to main or manual dispatch). Confirm the
   rendered Cloud Run env contains `OMNI_WA_CANONICAL=1`.
4. Watch the first hour: `wa_crm_sync` job throughput, CRM row count, error logs
   (`WA canonical ingest failed` should be absent — it indicates a DB problem).

## Rollback (instant, no data migration)

1. Set prod repo Variable `OMNI_WA_CANONICAL=0`.
2. Redeploy. The legacy in-memory path + 5-min timer + `processWaConversation`
   resume immediately. The `wa_messages` mirror ran in both modes, so the cockpit
   is unaffected. `omni_ingest_dedup` makes any messages ingested during the ON
   window idempotent — no double-processing on the way back.

## Notes

- A transient `/api/crm/parse-conversation` 503 (LLM providers momentarily down)
  now makes the `wa_crm_sync` job **retry** (up to attempts→`dead`), so a brief
  outage doesn't silently drop a conversation's CRM sync.
- The CRM-parse LLM spend is not counted against `OMNI_AI_DAILY_BUDGET_USD`
  (same as the legacy path); budget governs only omni-tracked `suggest`/`classify`.
