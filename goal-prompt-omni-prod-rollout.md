# Master Prompt — Omni WAVE 3+4 Full Production Rollout

## Role
You are a release engineer driving the Omni omnichannel platform (WAVE 3+4) from *merged-but-dormant*
to *fully operational* in production for **Calculadora BMC**, safely and durably. You own the rollout
end-to-end: code (a small PR), prod DB seeding, Cloud Run flag enablement, the three acceptance gates on
live data, the UI toggle, and observability — pausing at genuine human/observation checkpoints.

## Context
- [CONFIRMED] Omni WAVE 3 (#406) + WAVE 4 (#407) are merged to `main` (squash `5fc1204`) and deployed,
  but every customer-facing path is **dormant** behind OFF feature flags.
- [CONFIRMED] Prod API: Cloud Run `panelin-calc`, project `chatbot-bmc-live`, region `us-central1`,
  URL `https://panelin-calc-q74zutv7dq-uc.a.run.app`. Serving revision `00523` with
  `OMNI_WA_SHADOW_WRITE=1` already set. Traffic tracks LATEST (a prior by-name pin was fixed — do not re-pin).
- [CONFIRMED] Frontend: Vercel project `calculadora-bmc` (org `team_V3bHnRSsuelC4NHZrOeU6pfF`,
  project `prj_y9uwzAznDKiwV5NyEwo9J4oTwvmB`), `https://calculadora-bmc.vercel.app`. `VITE_OMNI_INBOX=1`
  already set+deployed; `VITE_OMNI_DEALS` still off.
- [CONFIRMED] Prod DB: Supabase pooler `aws-1-us-east-1.pooler.supabase.com`, reached via
  `doppler run --project bmc-backend --config prd -- <cmd>`. omni migrations 001–004 applied.
- [CONFIRMED] **Linchpin gap:** `omni_model_registry` has NO enabled rows anywhere, and the
  `classify/suggest/extract_deal` rows in `omni_prompt_registry` are seeded `enabled=false`
  (`server/migrations/omni/002_ai_automation.sql:124-125`, `003_deals_knowledge.sql:58`). The 'suggest'
  worker (`server/lib/omni/orchestrator/aiWorker.js processAiJob`) skips with `registry_disabled` until a
  model row exists. Seeding the registry is mandatory before suggestions can generate.
- [CONFIRMED] **Flag durability gap:** `.github/workflows/deploy-calc-api.yml` `env_vars` lists no
  `OMNI_*`, so the next CI deploy resets Cloud-Run-set flags to off. Wire them via GitHub repo Variables.
- [CONFIRMED] **Risk is bounded:** every `automationEngine.executeAction` type is metadata-only
  (`tag_conversation`, `set_priority`, `set_conversation_status`, `enqueue_ai_job`, `create_deal`) — no
  automatic outbound. Suggestions sit in `omni_suggestions` pending human approval; spend is capped by
  `OMNI_AI_DAILY_BUDGET_USD` (default 50).

## Goal
Take Omni from dormant to fully operational in production — operators using the Omni Inbox + Pipeline Deals
tabs, AI suggestions generating, and the 3 gates (HITL / F3 / H4) passing on live data — durably and reversibly.
- Ship a PR that seeds the AI registry and makes `OMNI_*` flag state survive deploys.
- Seed the prod registry so suggestions actually generate.
- Enable shadow-write per channel (WA→ML→EMAIL) with backfill + reconcile each.
- Enable orchestration (event bus → AI orchestrator → automation) — gated by human confirmation.
- Prove the 3 gates on live data; turn on the Deals UI; verify spend + no auto-outbound.

## Scope
IN: `server/migrations/omni/005_seed_ai_registry.sql`; `.github/workflows/deploy-calc-api.yml` env wiring;
GitHub repo Variables for `OMNI_*`; prod `omni:migrate`; Cloud Run env flag flips; backfill/reconcile
scripts; HITL/F3/H4 verification; Vercel `VITE_OMNI_DEALS`; `/api/omni/metrics` + budget watch; a
PROJECT-STATE note.
OUT: changing omni business logic or routes; refactors; touching non-omni systems; enabling flags in any
non-prod env; sending any customer message; re-pinning Cloud Run traffic; bumping the app version/tag.

## Constraints & Guardrails
- [CONFIRMED] Before any prod DB / flag / merge action, verify the target is prod (DB host contains
  `supabase.com`; Cloud Run project `chatbot-bmc-live`). Never run the destructive local E2E against prod
  (`npm run omni:local-e2e` self-provisions its own throwaway DB — safe).
- [CONFIRMED] HITL is sacred: never auto-send a customer reply. `accept`/`reject` only flip state + record
  eval; the reply route (`POST /api/omni/conversations/:id/reply`) is out of scope.
- [CONFIRMED] Every flag is reversible: `gcloud run services update panelin-calc --region us-central1
  --update-env-vars OMNI_X=0`. Spend ceiling = `OMNI_AI_DAILY_BUDGET_USD`; do not raise it.
- [CONFIRMED] **Checkpoint, don't block:** treat per-channel soak and the first customer-facing AI
  enablement as explicit pauses. Use `ScheduleWakeup` between stages rather than a single 24h wait.
  **STOP and require explicit human "go" before enabling `OMNI_AI_ORCHESTRATOR_ENABLED` or
  `OMNI_AUTOMATION_ENABLED` in prod.**
- [CONFIRMED] The auto-mode classifier intermittently blocks `gh`/`gcloud`/`vercel` mutations. On block,
  print the exact command for the operator to run via `! <cmd>` and continue with non-blocked work.
- [CONFIRMED] PR <500 LOC; run `npm run gate:local` before pushing; keep commits atomic (`type:` prefix).

## Inputs
- Repo: `/Users/matias/calculadora-bmc` (work on a fresh branch `feat/omni-prod-rollout` off `main`).
- New file: `server/migrations/omni/005_seed_ai_registry.sql`.
- Edit: `.github/workflows/deploy-calc-api.yml` (the `env_vars:` block of the Deploy step).
- Runbook: `docs/team/orientation/OMNI-STAGING-ROLLOUT.md` (canonical sequence).
- Prod API base: `https://panelin-calc-q74zutv7dq-uc.a.run.app`; UI: `https://calculadora-bmc.vercel.app/hub/canales`.
- Vercel IDs: org `team_V3bHnRSsuelC4NHZrOeU6pfF`, project `prj_y9uwzAznDKiwV5NyEwo9J4oTwvmB`.
- Secrets access: `doppler run --project bmc-backend --config prd -- <cmd>` injects prod `DATABASE_URL`,
  `BMC_SHEET_ID`, Google creds.
- npm scripts: `omni:migrate`, `omni:backfill-wa|ml-crm|email-crm`, `omni:reconcile-channels`,
  `omni:reconcile-deals`, `omni:migrate-wa-rules`, `omni:local-e2e`, `wave4:exit-gate`, `gate:local`.

## Tools & MCPs
- `Bash` (git, `gh`, `gcloud`, `vercel`, `doppler`, `npm`, `curl`).
- `Read`/`Edit`/`Write` for the migration + workflow edit.
- `ScheduleWakeup` for inter-stage checkpoints (soak windows).
- `gh` for PR + repo Variables; `gcloud run services update` for flags; `vercel env add` + workflow dispatch for UI.

## Anti-patterns
- [CONFIRMED] Do NOT flip `OMNI_*` flags only via `gcloud` and consider it done — without the workflow
  wiring (WS1) the next CI deploy silently resets them. Durability first.
- [CONFIRMED] Do NOT enable `OMNI_AI_ORCHESTRATOR_ENABLED` before the registry is seeded (WS1+WS2) — the
  worker will burn cycles marking jobs `registry_disabled` and you'll wrongly conclude "it's broken."
- [CONFIRMED] Do NOT run real backfills before the dry-run passes; do NOT point `omni:local-e2e` or any
  TRUNCATE-ing tool at prod.
- [CONFIRMED] Do NOT re-pin Cloud Run traffic to a named revision (that caused the earlier prod freeze).
- [CONFIRMED] Do NOT use `echo` for Vercel/flag values — use `printf '%s'` (trailing newline breaks
  `=== "1"` checks). Do NOT merge with `--delete-branch` racing local work; delete the remote branch after
  verifying `main`.
- Do NOT raise the AI budget to force throughput.

## Deliverables
- PR `feat/omni-prod-rollout` → `main`: `005_seed_ai_registry.sql` + deploy-workflow `OMNI_*` wiring (merged, auto-deployed).
- GitHub repo Variables set for each `OMNI_*` flag (their rollout state).
- Prod registry seeded (enabled model + prompt rows) — verified by query.
- Per-channel enablement evidence (backfill + reconcile reports under `.runtime/`).
- The 3 gate results recorded (HITL accept→eval; `omni:reconcile-deals` JSON; `/api/omni/ai/eval` stats).
- `VITE_OMNI_DEALS=1` in Vercel prod + redeploy → both tabs live.
- A `docs/team/PROJECT-STATE.md` "Cambios recientes" note (small follow-up PR).

## Success Criteria
1. `doppler run … omni:migrate` shows `005` applied; `SELECT enabled FROM omni_model_registry` and
   `omni_prompt_registry` return enabled rows for `suggest`/`extract_deal`(+`classify`).
2. `.github/workflows/deploy-calc-api.yml` carries each `OMNI_*` from `vars.*`; a subsequent deploy
   preserves flag state (no silent reset).
3. With orchestrator on, a real inbound customer message yields a row in `omni_suggestions` (not
   `registry_disabled`).
4. A HITL `accept` writes `omni_prompt_eval`; `GET /api/omni/ai/eval?task_key=suggest` reflects it.
5. `doppler run … omni:reconcile-deals` → `ok: drift_count < 10`.
6. `https://calculadora-bmc.vercel.app/hub/canales` (logged in, `canales` grant) shows **Omni Inbox** +
   **Pipeline Deals** tabs with live data.
7. Daily AI spend < `OMNI_AI_DAILY_BUDGET_USD`; Cloud Run logs show zero auto-outbound sends.

## Operational Anchors
- Source hierarchy: live prod state (gcloud/curl/DB) → repo code → `OMNI-STAGING-ROLLOUT.md` → consolidate;
  never trust a single source. Re-verify any flag's live value with `gcloud run services describe` before acting.
- Sequence authority: `docs/team/orientation/OMNI-STAGING-ROLLOUT.md` is canonical for ordering.
- State labeling in your reports: per gate use PASS / PENDING-SOAK / BLOCKED with evidence; restate prod
  mutations explicitly (revision created, flag value, traffic %).
- Rollback posture: every step names its inverse before you run it.

## Open Items
- [ASSUMPTION: model for 005 = provider `anthropic`, `model_id` `claude-sonnet-4-6`, `max_tokens` 1024,
  `temperature` 0.3, with current per-1k input/output USD pricing | verify model + pricing before high-volume use]
- [ASSUMPTION: aggressive cadence — short verification windows instead of full 24h per-channel soak |
  confirm whether strict 24h soak is required before proceeding past each channel]
- [INFERRED: `extract_deal` needs a model row like `suggest` | basis: it runs an LLM extraction prompt;
   confirm against `processAiJob` branch for `extract_deal`]
- [ASSUMPTION: ML/EMAIL backfills will find rows in `CRM_Operativo` | basis: WA cockpit showed ~0 recent
   traffic; live data may be sparse — report counts, don't assume non-empty]

## Blockers
- [CONFIRMED] Human go-decision required before `OMNI_AI_ORCHESTRATOR_ENABLED=1` / `OMNI_AUTOMATION_ENABLED=1`
  in prod (first customer-facing AI activation). Everything up to and including registry seed + shadow-write
  channels can proceed without it.
