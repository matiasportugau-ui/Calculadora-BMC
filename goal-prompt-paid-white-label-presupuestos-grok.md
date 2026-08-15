# Runtime (Grok)

- **Executor:** Grok Build TUI + skill `goal` (`~/.grok/skills/goal/SKILL.md`)
- **Cwd:** `/Users/matias/calculadora-bmc` — confirm `git rev-parse --show-toplevel` before any git command
- **Activate:** `/goal load goal-prompt-paid-white-label-presupuestos-grok.md`
- **Default mode:** full auto until Completion Condition holds; “just plan” = turn table + P0 gap list only (no code)
- **Not Claude Code:** do **not** `cat … | claude -p`. This prompt is for Grok.
- **SoT:** `docs/sdd/paid-white-label-presupuestos/SDD.md` — ADRs 001–008 are binding. Also load `IMPLEMENTATION-GUIDE.md` + `RECREATION-CHECKLIST.md` in that folder before the first edit.

# Role

You are the Grok implementation agent for **Modality 1 paid Comprador + white-label presupuestos** on Calculadora-BMC. You extend the already-live identity stack. You do **not** re-golive identity, invent a `paid_base` role, or integrate a payment gateway. You ship a branch + tests + runbook. You do not merge or deploy.

# Context

[CONFIRMED: Repo is `~/calculadora-bmc` / `matiasportugau-ui/Calculadora-BMC`. Vite SPA + Express 5 `panelin-calc` + Postgres `identity.*`.]
[CONFIRMED: Comprador identity is live since 2026-05-20. `IDENTITY_JWT_SECRET`, Google OAuth, `bmc_sess` cookie, schema `identity` applied. Open registration grants `calc:write` + `tareas:read`. `/` and `/calculadora` stay public.]
[CONFLICT: `docs/master-plans/user-identity-GOLIVE.md` still says migrations pending. PROJECT-STATE 2026-05-20 supersedes. Do not re-run `identity_init`.]
[CONFIRMED: Roles = `comprador|operator|admin|superadmin`. `plan_tier` today = `base|plus`. No PATCH to set plan_tier. SDD locks **new value `paid`** (ADR-001). `plus` stays CRM Plus.]
[CONFIRMED: `POST /api/me/quotes` coerces user status to `draft` only (`server/routes/identityMe.js`).]
[CONFIRMED: PDFs BMC-branded via `server/lib/quotePdf.js` inlining `bmc-logo.png`. Sheets mapper exists, `SHEETS_CLIENT_QUOTES_ENABLED` default false.]
[CONFIRMED: SDD kit exists at `docs/sdd/paid-white-label-presupuestos/` (Accepted-for-build).]
[INFERRED: Local machine may sit on an unrelated branch (e.g. `feat/panelin-argentina-tts`) | basis: prior session. Cut implementation branch from `origin/main`.]

# Goal

Ship MVP: a **manually activated** `plan_tier=paid` user generates a white-label client presupuesto (own logo, no BMC chrome) while BMC keeps an **immutable server-priced snapshot** with margin — without breaking anonymous or operator BMC-branded flows.

- P0: 15-min audit (complete path, GCS helper, `plus` usage); 10-line gap list in the runbook.
- P1: `paid` entitlement + admin PATCH + User Admin UI.
- P2: branding upload + dual-audience PDF (`client` / `bmc`).
- P3: complete + freeze `bmc_snapshot` + strip snapshot from `/api/me/quotes`.
- P4: Sheets enqueue if flag; runbook + PROJECT-STATE.
- P5: five required tests + PR **unmerged**.

## Completion Condition (Grok evaluator — all must hold)

1. Current branch is `feat/paid-white-label-presupuestos` and contains latest `origin/main` (not `feat/panelin-argentina-tts`).
2. Additive migration exists for `plan_tier` CHECK `base|plus|paid`, `users.branding`, `quotes.bmc_snapshot` + `bmc_snapshot_at`. No destructive re-apply of `identity_init`.
3. `PATCH /api/admin/users/:id/plan-tier` exists; unpaid `POST /api/me/branding` → 403; paid branding accepts png/jpeg/webp ≤1 MB and rejects SVG.
4. Paid `export.pdf?audience=client` (or HTML fixture) contains user logo and does **not** contain `bmc-logo.png` or header “BMC Uruguay”; anonymous/unpaid PDF still BMC-branded; `audience=bmc` forbidden to comprador.
5. Complete path writes `bmc_snapshot` **once** with **server** catalog prices; tampered client totals set `price_drift` and do not win; `GET /api/me/quotes` omits `bmc_snapshot`; soft-delete keeps snapshot + `quote_events`.
6. Files exist: `docs/team/runbooks/paid-white-label-mvp.md` (incl. P0 gap list + emergency SQL) and a Cambios recientes line in `docs/team/PROJECT-STATE.md`.
7. Five tests pass (unpaid branding 403; paid PDF omits BMC logo; snapshot ignores tamper; soft-delete keeps snapshot; anonymous PDF BMC). Lint clean on touched files. Prefer `npm run gate:local`; if it fails, name failures that already exist on `origin/main`.
8. PR opened to `main` **or** commits ready with conventional message `feat(identity): paid plan + white-label presupuestos + BMC immutable copy`. **Not merged. Not deployed.**

When all eight hold → `update_goal` completed and stop.

# Scope

IN:
- SDD-specified APIs, migration, PDF `audience`, complete/freeze, User Admin plan_tier, `/mi-espacio` branding tab
- Tests + runbook + PROJECT-STATE
- Optional inspect/cherry-pick from `feat/pdf-customer-brand-identity` (no blind merge)
- Optional PR via `gh`

OUT:
- Payment gateway (Stripe / Mercado Pago)
- Multi-tenant catalogs, reseller margins, custom price lists
- Re-golive identity / new auth stack / gating `/`
- Changing master prices, LISTA_ACTIVA, matriz, fiscal/DGI data
- Panelin tools, PEA, Envíos, TTS branch work
- Merge to `main`, Vercel/Cloud Run deploy, setting env with `echo`

# Inputs

- Cwd: `/Users/matias/calculadora-bmc` [CONFIRMED]
- SDD: `docs/sdd/paid-white-label-presupuestos/SDD.md` [CONFIRMED]
- Guide: `docs/sdd/paid-white-label-presupuestos/IMPLEMENTATION-GUIDE.md` [CONFIRMED]
- Checklist: `docs/sdd/paid-white-label-presupuestos/RECREATION-CHECKLIST.md` [CONFIRMED]
- Identity: `server/lib/identityAuth.js`, `server/routes/identityMe.js`, `server/routes/identityAdmin.js`, `server/routes/authGoogle.js`
- PDF: `server/lib/quotePdf.js`, `server/routes/quoteExport.js`, `src/pdf-templates/`
- UI: `src/components/MySpacePage.jsx`, `src/components/admin/users/`, `src/contexts/BmcAuthProvider.jsx`
- Sheets: `server/lib/clientQuotesSheetSync.js`, `docs/sheets-mapper-clientes.md`
- Schema: `supabase/migrations/20260601000001_identity_init.sql`
- [ASSUMPTION: GCS helper for WA-media / `quotes/pdf/` is reusable for `identity-branding/{user_id}/` | verify in P0]
- [ASSUMPTION: If no server flip to `completed` exists, add `POST /api/me/quotes/:id/complete` per SDD §6 | verify in P0]

# Tools (Grok)

- `run_terminal_command`: git (inside repo only), `npm run lint`, `node --test` on new files, `npm run gate:local`; Doppler **read-only** if probing `plan_tier` counts
- `read_file` / `grep` / `list_dir` / `search_replace` / `write`: code + docs
- `update_goal`: after **every** turn — progress; `completed: true` only when all 8 conditions hold; `blocked_reason` only for real human/credential blockers
- `spawn_subagent` (`explore`): optional P0 parallel (complete path / GCS / plus counts); merge findings in main
- `gh` / GitHub MCP: open PR after local green
- Tools **not** needed: Vercel deploy, Shopify merch, metalog, payment APIs, browser unless local `doppler run -- npm run dev:full` is already up for UAT
- Web search: not required

# Constraints & Guardrails

- DO treat SDD ADRs 001–008 as binding (`paid` tier, public calc, one quote row + snapshot, server prices, GCS logos, no PSP, dual audience, no new AI).
- DO work only in `~/calculadora-bmc`. Branch from `origin/main`.
- DO reuse `identityAuth` JWT + `bmc_sess` + `requireUser`. Add `requirePaid` / `isPaidTier`.
- DO keep anonymous calculator + operator hub BMC-branded.
- DO resolve sellable unit prices server-side from catalog / `p()` / LISTA_ACTIVA.
- DO write `bmc_snapshot` once in the same transaction as `status=completed`. Soft-delete must not erase it.
- DO strip `bmc_snapshot` from `/api/me/*` JSON (paid user must not see BMC margin).
- DO limit logos: ≤1 MB; png/jpeg/webp; no SVG.
- DO NOT invent role `paid_base` or overload `plus` for white-label.
- DO NOT gate `/` behind login.
- DO NOT dual-insert two `identity.quotes` rows.
- DO NOT re-run `identity_init` “to be safe”.
- DO NOT commit secrets / `.env` / Doppler values.
- DO NOT force-push or merge `main`. Do not deploy.
- DO NOT treat zombie `panelin-api-642127786762` as live. Active API is `panelin-calc`.
- DO NOT use `echo` to set env (`printf '%s'` only if you must; prefer not setting env).

# Anti-patterns

- DO NOT re-golive identity (JWT secrets, cookie domain, full schema apply).
- DO NOT leave BMC logo + user logo stacked on the client PDF.
- DO NOT put BMC RUT / navy wordmark / bmcuruguay.com.uy on paid `audience=client`.
- DO NOT trust wizard payload totals for admin margin.
- DO NOT skip tests because “it’s just branding”.
- DO NOT edit from `feat/panelin-argentina-tts`.
- DO NOT fall back to Claude Code piping mid-run.

# Deliverables

- Branch `feat/paid-white-label-presupuestos`
- Additive migration under `supabase/migrations/`
- `PATCH /api/admin/users/:id/plan-tier` + User Admin UI
- `GET/POST /api/me/branding` (POST paid-only)
- `quotePdf` + templates: `audience=client|bmc`
- Complete/freeze path + `quote_events.kind=completed`
- `/mi-espacio` branding UI
- Tests covering the five cases in Completion Condition #7
- `docs/team/runbooks/paid-white-label-mvp.md`
- `docs/team/PROJECT-STATE.md` Cambios recientes
- Commit(s) + optional unmerged PR

# Success Criteria

Maps 1:1 to **Completion Condition**. Re-evaluate after each turn.

# Turn plan (Grok goal discipline)

| Turn | Work | Primary artifacts |
|------|------|-------------------|
| 1 | Bootstrap: `git fetch` + branch from `origin/main`; read SDD + guide; P0 audit | runbook stub with 10-line gap list |
| 2 | P1 entitlement: migration + `requirePaid` + PATCH + admin UI | 403 unpaid branding |
| 3 | P2 branding + PDF audiences | fixture / test: paid client omits BMC logo |
| 4 | P3 complete + snapshot + strip on me GET | tamper + immutability tests |
| 5 | P4 Sheets enqueue (flag-safe) + runbook + PROJECT-STATE | runbook complete |
| 6 | P5 lint + five tests + commit + optional PR; final evaluator | Completion Condition 1–8 |

Merge turns only if cheap; still emit the turn block.

**Required output format after each turn:**

```
=== TURN N — [short description] ===
Condition check: [which of 1–8 met / not met + reason]
Artifacts produced:
- path/…
Current state summary: (1–3 sentences)
Next step: …
```

Then `update_goal` with progress (or `completed: true` / `blocked_reason`).

**Hard bound:** stop after 8 turns or if blocked on missing `DATABASE_URL` / GCS credentials for a step that cannot be tested offline. Offline unit tests with mocks are enough to satisfy #7; live UAT is bonus, not required for completion.

# Operational Anchors

- Source hierarchy for this task: **SDD + repo runtime** > PROJECT-STATE > GOLIVE.md (stale infra).
- State labeling: `hecho confirmado` / `inferencia` / `duda abierta` (or `[CONFIRMED]` / `[INFERRED]` / `[ASSUMPTION]`).
- Triangulation: SDD ADR → code path → test. Do not trust a single source.
- Read-only: master prices, Sheets parámetros/logs/automation, fiscal data.
- If `plus` vs `paid` conflicts in prod data: surface counts, do not silently remap (ADR-001).

# Open Items

- [ASSUMPTION: Logo store = GCS `identity-branding/{user_id}/` | verify helper in P0]
- [ASSUMPTION: Complete path may need new `POST /api/me/quotes/:id/complete` | verify in P0]
- [ASSUMPTION: Completion does **not** require production deploy or payment | confirmed by SDD]
- [ASSUMPTION: First paid users activated by Matias (superadmin), not self-serve | SDD ADR-006]
- [ASSUMPTION: Do not strip existing `tareas:read` grants | verify — only new default can omit tareas]

---

## How to run (Grok)

```text
cd ~/calculadora-bmc
# In Grok Build TUI:
/goal load goal-prompt-paid-white-label-presupuestos-grok.md
```

Optional: “just plan” first (Turn 1 only), then “full auto” until Completion Condition 1–8 hold.
