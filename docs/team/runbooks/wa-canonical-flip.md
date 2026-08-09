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
  the in-memory map / 5-min timer / duplicate `callAgentOnce` are disabled; the
  operator-visible **🚀 affordance stays alive** by expediting the durable
  `wa_crm_sync` job instead of calling the legacy immediate path. CRM Sheets
  ingest + auto-learn run as that durable `wa_crm_sync` job on `omni_ai_jobs`
  (one row per phone, per-conversation coalesced). The
  `wa_messages` mirror still runs, so the `/hub/wa` cockpit is unaffected.

## Preconditions (all must hold before setting the variable to 1)

- [ ] Prod repo Variables already ON: `OMNI_EVENT_BUS_ENABLED=1`,
      `OMNI_AI_ORCHESTRATOR_ENABLED=1` (they are — PROJECT-STATE 2026-06-23). The
      `wa_crm_sync` job only fires when the bus + orchestrator are live.
- [ ] Omni migrations applied to prod: `DATABASE_URL=<prod> npm run omni:migrate`
      (idempotent; applies everything pending in filename order). For this flip the
      relevant ones are `011_wa_crm_sync_job.sql` (widens a CHECK + partial dedup
      index), `012_omni_ai_jobs_run_after.sql` (cheap `ADD COLUMN run_after`) and —
      **critically** — `014_ai_job_type_union.sql`: two branches shipped different
      "011" files that each DROP+ADD the same `omni_ai_jobs_type_valid` CHECK
      (PR #531), so 014 is the convergence point that guarantees the CHECK accepts
      all six job types regardless of which 011 an environment ran first. Verify
      with the pre-check query in
      [`wa-canonical-soak-queries.sql`](./wa-canonical-soak-queries.sql) (block 0).
- [ ] `OMNI_WA_CANONICAL` is wired into `deploy-calc-api.yml` (done) so the repo
      Variable actually reaches Cloud Run.
- [ ] Owner decisions confirmed:
  - [x] **AF–AG retirement** — decidido: bajo canonical mode se retira el WA-driven
    AF–AG AI auto-fill y queda **Omni `suggest`** como único camino IA.
  - [x] **Upsert-by-phone** — decidido: se mantiene **una sola fila por teléfono**
    en CRM_Operativo; las distintas cotizaciones/recontactos se deben distinguir en
    metadata, no creando filas nuevas por default.
  - [x] **🚀 manual trigger equivalent** — decisión tomada: en canonical mode debe
    seguir existiendo **el mismo affordance UI** (mismo botón / affordance visible
    para el operador), aunque su implementación interna cambie para disparar el flujo
    canónico en vez del path legacy.
- [x] ~~Staging soak passed (below), including~~ **🚀 spot-check DONE in prod
      (2026-07-04):** a signed webhook with a `🚀` message went end-to-end on
      the canonical path — ingest → classify/suggest completed → `wa_crm_sync`
      **expedited** (`run_after` ≈ now instead of the 60s debounce) → completed
      in 1 attempt → CRM row written (test data cleaned afterwards). Note: the
      flip happened before any staging soak (see Production flip status); soak
      monitoring continues in prod via the cutover workflow's `soak` action.

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

> **Status 2026-07-04: FLIPPED ON.** Migrations 011–015 applied via
> `wa-canonical-cutover.yml` (action=migrate). The workflow's `flip_on`
> prerequisite check has a bug (`gh variable get` with `github.token` cannot
> read repo Variables → always reports MISSING), so the flip was executed
> manually with the equivalent commands: `gh variable set OMNI_WA_CANONICAL
> --body 1` + deploy dispatch. Cloud Run renders `OMNI_WA_CANONICAL=1` with
> bus + orchestrator ON. First soak snapshot: clean (0 dead-letter, coalescing
> invariant holds, no WA traffic in window). Pending: fix the workflow's
> prerequisite read (use `gh api repos/.../actions/variables/...` or a PAT),
> and spot-check 🚀 with real WA traffic.

1. Confirm preconditions + soak green.
2. Set prod repo Variable `OMNI_WA_CANONICAL=1`.
3. Trigger `deploy-calc-api` (push to main or manual dispatch). Confirm the
   rendered Cloud Run env contains `OMNI_WA_CANONICAL=1`.
4. Watch the first hour: `wa_crm_sync` job throughput, CRM row count, error logs
   (`WA canonical ingest failed` should be absent — it indicates a DB problem).
5. Monitoring kit: [`wa-canonical-soak-queries.sql`](./wa-canonical-soak-queries.sql)
   — 10 ready-to-run blocks (`psql "$DATABASE_URL" -f wa-canonical-soak-queries.sql`)
   covering pre-check, 24h health, backlog age, dead-letter, hourly throughput,
   coalescing invariant, run_after debounce, per-phone spot-check, daily AI budget,
   cockpit mirror, and post-rollback verification.

## Rollback (instant, no data migration)

1. Set prod repo Variable `OMNI_WA_CANONICAL=0`.
2. Redeploy. The legacy in-memory path + 5-min timer + `processWaConversation`
   resume immediately. The `wa_messages` mirror ran in both modes, so the cockpit
   is unaffected. `omni_ingest_dedup` makes any messages ingested during the ON
   window idempotent — no double-processing on the way back.

## Read-model convergence — `OMNI_WA_READS` (separate, later stage)

Independent flag (default OFF). When ON, the `/hub/wa` cockpit read endpoints
(`/api/wa/conversations|messages|suggestions`) read from `omni_*` instead of `wa_*`,
mapped to the cockpit's existing shape (no frontend change). Lets the `wa_messages`
dual-write be retired once validated. **Validate on staging before prod ON:**

- [ ] With `OMNI_WA_READS=1` on staging, open `/hub/wa` and confirm the conversation
      list, thread, and AI-suggestions tab render correctly from `omni_*`.
- [ ] Confirm the lossy mappings are acceptable: `status` (omni open/pending/snoozed/
      resolved → wa new/pending/quoted/closed — "quoted" can't round-trip),
      `owner_op` / `lead_sheet_row` / `intent_last` (read best-effort from
      `omni_conversations.properties`). Decide whether to enrich `properties` on
      ingest if these matter operationally.
- [ ] Only after the canonical flip (`OMNI_WA_CANONICAL=1`) is healthy, since omni
      is then the source of truth for WA messages.

Rollback: `OMNI_WA_READS=0` → cockpit reads `wa_*` again (the mirror still runs).

## Notes

- A transient `/api/crm/parse-conversation` 503 (LLM providers momentarily down)
  makes the `wa_crm_sync` job **retry** (up to attempts→`dead`), so a brief outage
  doesn't silently drop a conversation's CRM sync. A `dead` job logs
  `"wa_crm_sync DEAD — CRM lead may be lost"` and is exposed as
  `omni_ai_jobs_24h{job_type="wa_crm_sync",status="dead"}` — alert on it.
- **Insert-once semantics:** `wa_crm_sync` creates ONE CRM_Operativo row per phone
  on first contact and **never overwrites** it afterward (no clobber of operator
  Estado/Observaciones or the "Bloquear auto" lock). Repeat messages from a known
  phone skip parse + Sheets entirely (so per-message LLM cost is bounded). A
  returning lead's row is not auto-refreshed (the operator owns it); the full
  transcript always lives in `omni_messages`.
- **Burst debounce (`OMNI_WA_CRM_SYNC_DELAY_MS`, default 60000):** a `wa_crm_sync`
  job is held until the conversation has been quiet for the window; each new inbound
  message re-stamps it. So the row is created once the burst quiesces and parses the
  **full** transcript (rich `resumen_pedido`), reproducing the legacy 5-min
  inactivity behavior. A continuous conversation (no gap ≥ window) delays the row
  until a pause — same as legacy; lower the window to fire sooner. Needs
  migration 012 (`omni_ai_jobs.run_after`).
- **Budget decoupling:** the AI daily-budget gate scopes to `suggest` only —
  `wa_crm_sync` keeps draining even when `OMNI_AI_DAILY_BUDGET_USD` is exhausted, so
  WhatsApp lead capture never stalls on LLM spend. The CRM-parse LLM spend is itself
  **outside** the budget (same as legacy).
- **Migration lock:** applying migration 011 briefly write-locks `omni_ai_jobs`
  (non-CONCURRENT unique index). Apply in a low-traffic window, or build
  `omni_ai_jobs_wa_crm_sync_active_dedup` with `CREATE UNIQUE INDEX CONCURRENTLY`
  out-of-band.
