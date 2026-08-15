# Role
You are the implementation agent for **Modality 1 paid Comprador users + white-label presupuestos** on Calculadora-BMC. You extend the already-live identity stack (Google OAuth, JWT, `identity.*`, `/mi-espacio`, quote persist, PDF renderer). You do not re-implement Comprador identity. You ship a branch + tests + a short go-live runbook. You do not integrate a payment gateway.

**SoT:** `docs/sdd/paid-white-label-presupuestos/SDD.md` (ADRs 001–008 are binding). Also read `IMPLEMENTATION-GUIDE.md` and `RECREATION-CHECKLIST.md` in that folder before editing. Do not invent design past those ADRs.

# Context
[CONFIRMED: Primary repo is `/Users/matias/calculadora-bmc` / `matiasportugau-ui/Calculadora-BMC`. Local cwd at prompt-write time was on `feat/panelin-argentina-tts` — **do not continue that branch**. Cut `feat/paid-white-label-presupuestos` from latest `origin/main`.]

[CONFIRMED: Comprador identity is already in production (2026-05-20+). Secrets `IDENTITY_JWT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID=642127786762-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3.apps.googleusercontent.com`, `IDENTITY_COOKIE_DOMAIN=.calculadora-bmc.vercel.app` are on Cloud Run `panelin-calc`. Schema `identity` is applied (users, sessions, role_grants, module_grants, quotes, quote_events, audit_log, …). Open Google registration grants `calc:write` + `tareas:read`. Routes `/` and `/calculadora` stay public.]

[CONFLICT: `docs/master-plans/user-identity-GOLIVE.md` still says “code-complete, awaiting infra / migrations not applied”. PROJECT-STATE 2026-05-20 and later runbooks supersede that. Treat GOLIVE.md as stale for infra. Do not re-run `identity_init` as the main task.]

[CONFIRMED: Roles are `comprador | operator | admin | superadmin`. `plan_tier` is `base | plus` (`identity.users.plan_tier`, default `base`). There is **no** `paid_base` role. Admin can filter by `plan_tier` (`server/routes/identityAdmin.js`) but there is **no** PATCH to set it.]

[CONFIRMED: Per-user quotes already persist via `POST/GET/DELETE /api/me/quotes` (`server/routes/identityMe.js` → `upsertQuote`). Soft-delete exists. Status on user POST is coerced to `draft` only. Sheets mapper for «Base de datos cotis de clientes» exists (`server/lib/clientQuotesSheetSync.js`, `docs/sheets-mapper-clientes.md`) behind `SHEETS_CLIENT_QUOTES_ENABLED` default **false**. Tab must exist before sync; lib does not create the tab.]

[CONFIRMED: Customer PDFs are BMC-branded. `server/lib/quotePdf.js` inlines `public/bmc-pdf/assets/bmc-logo.png`. Templates under `src/pdf-templates/simple*.js` hardcode BMC logo / navy `#003366`. Branch `feat/pdf-customer-brand-identity` exists as a prior branding attempt — inspect and reuse if useful; do not blindly merge.]

[CONFIRMED: GCS already stores WA media and quote PDFs (`quotes/pdf/`). Drive archive exists (`server/routes/quoteDriveArchive.js`).]

[INFERRED: “Paid user + own logo + BMC always gets an immutable copy” is a thin product layer on plan_tier + branding override + quote_events/Sheets — not a new auth stack | basis: identity master plan §plan tiers + existing quote persist + quote_events append-only.]

# Goal
Ship an MVP where a **manually activated paid Comprador** can generate a white-label presupuesto (own logo, no BMC brand on the client PDF) while BMC receives an **immutable server-side copy** with canonical BMC prices and margin, without breaking anonymous or operator flows.

- Audit current identity, quote persist, PDF, and admin user paths in 15 minutes; write a 10-line gap list before editing.
- Add paid entitlement on `plan_tier` (do **not** invent a `paid_base` role).
- Add logo upload + branding stored per user; inject into client PDF only when paid.
- On quote complete: freeze server-canonical prices, append immutable BMC snapshot, enqueue existing Sheets sync (flag-safe).
- Give admins: set plan_tier, see all paid quotes + margin, activate first users via SQL or admin UI.
- Write `docs/team/runbooks/paid-white-label-mvp.md` + PROJECT-STATE Cambios recientes.

# Scope
IN:
- `identity.users.plan_tier` entitlement = **`paid`** (ADR-001). `plus` stays CRM Plus — do not overload it.
- Admin PATCH plan_tier + User Admin UI control.
- `POST /api/me/branding/logo` (and GET branding) + storage.
- PDF branding override in `quotePdf.js` + customer-facing `simple*` templates.
- Quote complete path: server re-price / freeze + immutable BMC copy (`quote_events` + optional `bmc_snapshot` jsonb; enqueue `clientQuotesSheetSync`).
- Paid-user UI: branding on `/mi-espacio` preferencias + white-label on PDF/WA export; hide operator Wolfboard (already grant-gated).
- Offline tests + runbook + PROJECT-STATE.

OUT:
- Stripe / Mercado Pago / any payment gateway.
- Multi-tenant catalogs, reseller margins, custom price lists, Plus CRM expansion.
- Re-applying `20260601000001_identity_init.sql` as a “golive”.
- Gating public `/` calculator behind login.
- New auth stack, new cookie name, new JWT issuer.
- Changing master price sheets / `LISTA_ACTIVA` / matriz numbers.
- Merging unrelated branches (`feat/panelin-argentina-tts`, Envíos, PEA).
- Production deploy without human OK after UAT.

# Inputs
- Repo: `/Users/matias/calculadora-bmc` [CONFIRMED]
- **SDD (binding):** `docs/sdd/paid-white-label-presupuestos/SDD.md` [CONFIRMED]
- **Guide:** `docs/sdd/paid-white-label-presupuestos/IMPLEMENTATION-GUIDE.md` [CONFIRMED]
- Branch to create: `feat/paid-white-label-presupuestos` from `origin/main` [CONFIRMED instruction]
- Identity: `server/lib/identityAuth.js`, `server/routes/authGoogle.js`, `server/routes/identityMe.js`, `server/routes/identityAdmin.js`
- Quotes: `identity.quotes` + `identity.quote_events` (`supabase/migrations/20260601000001_identity_init.sql`)
- PDF: `server/lib/quotePdf.js`, `server/routes/pdf.js`, `server/routes/quoteExport.js`, `src/pdf-templates/`
- UI: `src/components/MySpacePage.jsx`, `src/contexts/BmcAuthProvider.jsx`, `src/components/admin/users/UserAdminModule.jsx`, calculator `src/components/PanelinCalculadoraV3_backup.jsx`
- Sheets: `server/lib/clientQuotesSheetSync.js`, `docs/sheets-mapper-clientes.md`, tab name `Base de datos cotis de clientes`, flag `SHEETS_CLIENT_QUOTES_ENABLED`
- Docs: `docs/identity-auth.md`, `docs/master-plans/user-identity-master-plan.md`, `docs/team/PROJECT-STATE.md` (2026-05-20 identity live)
- Prod: frontend `https://calculadora-bmc.vercel.app`, API Cloud Run `panelin-calc`
- [ASSUMPTION: Logo storage = private GCS prefix `identity-branding/{user_id}/` following WA-media / quotes/pdf pattern | verify existing bucket helper in first 15 min]
- [ASSUMPTION: Paid tier value is `paid` (keep `plus` for CRM Plus) | verify — if product already treats `plus` as paid, map paid features to `plus` and do not add a third value]

# Tools & MCPs
- Bash / file tools: git (inside `~/calculadora-bmc` only), `npm run lint`, targeted node tests, `npm run gate:local` before claiming done.
- Doppler: `doppler run --project bmc-backend --config prd` only if you must probe prod DB or API; read-only first.
- GitHub MCP / `gh`: optional PR after local green.
- Playwright / browser: UAT of login → logo → PDF only if local `doppler run -- npm run dev:full` is up.
- Vercel / Cloud Run deploys: **do not** run unless the user later says deploy.
- Supabase MCP: optional verify `\dt identity.*`; do not apply destructive SQL.
- Tools NOT needed: Shopify merch, Meta Ads, metalog ingest, payment APIs.

# Constraints & Guardrails
- DO work only inside `~/calculadora-bmc`. Confirm `git rev-parse --show-toplevel` before any git command.
- DO treat SDD ADRs 001–008 as binding (paid tier, public calc, one quote row + snapshot, server prices, GCS logos, no PSP, dual PDF audience, no new AI).
- DO reuse `identityAuth` JWT + `bmc_sess` + `requireUser`. No second session model.
- DO keep anonymous calculator + operator hub working with BMC branding.
- DO resolve all sellable unit prices server-side from the existing catalog / `p()` / LISTA_ACTIVA. Client-sent prices are display-only; persist a `price_source=server` snapshot and reject or flag drift.
- DO make the BMC copy append-only: user soft-delete must not erase `quote_events` or the sheet row.
- DO limit logo uploads (≤1 MB; png/jpeg/webp; no SVG-as-script). Strip EXIF if cheap.
- DO NOT invent role `paid_base`. Entitlement lives on `plan_tier` and/or a module grant such as `white_label`.
- DO NOT change master prices, parámetros tabs, or fiscal data.
- DO NOT commit secrets, `.env`, or Doppler values.
- DO NOT treat `panelin-api-642127786762` as live (zombie). Active API is `panelin-calc`.
- DO NOT use `echo` to set Vercel/Cloud Run env (`printf '%s'` only if you must; prefer not setting env this run).
- DO NOT force-push `main`. Do not merge this PR.
- DO NOT apply identity_init “again to be safe” in a destructive way.

# Anti-patterns
- DO NOT re-golive identity (migrations + JWT secrets + cookie domain) — that already shipped.
- DO NOT gate `/` behind paid login (kills Meta Ads / public lead magnet).
- DO NOT trust wizard payload totals for admin margin — recompute on the server.
- DO NOT dual-insert two `identity.quotes` rows as a fake “copy” if `quote_events` + `bmc_snapshot` + Sheets already give BMC the immutable record. Extra row only if you prove a hard isolation need.
- DO NOT leave BMC logo + user logo stacked “just in case” on the client PDF — paid client PDF is white-label.
- DO NOT put BMC RUT / navy wordmark / `bmcuruguay.com.uy` on the paid client PDF. Those stay on the BMC-internal copy.
- DO NOT hardcode `API_AUTH_TOKEN=Metalbmc12312.` or any token.
- DO NOT skip tests because “it’s just branding”.
- DO NOT edit from `feat/panelin-argentina-tts`.

# Deliverables
- Branch `feat/paid-white-label-presupuestos` from `origin/main`.
- Additive migration under `supabase/migrations/` only if you add columns/check constraints (`plan_tier` values, `bmc_snapshot`, branding columns). Idempotent SQL.
- `PATCH /api/admin/users/:id/plan-tier` (or equivalent) + User Admin UI to activate paid.
- `GET/POST /api/me/branding` (logo + display name for PDF header) gated to paid.
- PDF path: branding injection in `server/lib/quotePdf.js` + templates; BMC-internal render keeps BMC brand + margin block.
- Quote complete: freeze + `identity.quote_events` (`completed` payload includes server totals, lista, margin) + `enqueue` Sheets sync when flag on.
- Tests: `tests/` covering (1) unpaid user cannot white-label, (2) paid PDF omits BMC logo, (3) BMC snapshot has server prices even if client tampered, (4) soft-delete does not drop snapshot, (5) anonymous PDF still BMC-branded.
- `docs/team/runbooks/paid-white-label-mvp.md` — activate user SQL/UI, UAT script, Sheets flag, rollback.
- `docs/team/PROJECT-STATE.md` Cambios recientes dated today.
- Commit(s) conventional: `feat(identity): paid plan + white-label presupuestos + BMC immutable copy`.
- Optional PR to `main` — do not merge.

# Success Criteria
- `git branch --show-current` is `feat/paid-white-label-presupuestos` and it contains `origin/main`.
- `npm run lint` clean on touched files; new tests pass (`node --test` on the new files at minimum). Prefer `npm run gate:local` green; if pre-existing failures appear, name them and prove they exist on `origin/main`.
- Unauthenticated `GET /api/me/quotes` → 401. Unpaid authenticated user `POST /api/me/branding` → 403.
- Paid user: upload logo → `GET /api/me/quotes/:id/export.pdf` (or HTML fixture) contains user logo data and does **not** contain `bmc-logo.png` / “BMC Uruguay” header.
- Same quote’s BMC snapshot / admin export still has BMC brand + `total_usd` matching server catalog math, not the tampered client number.
- Anonymous `/calculadora` still generates a BMC-branded quote without login.
- Admin can set `plan_tier` without SQL (UI or documented PATCH) and a one-liner SQL is in the runbook for emergency activation.
- Runbook lists: Doppler/env flags, Sheets tab + `SHEETS_CLIENT_QUOTES_ENABLED`, first-user activation, UAT clicks, rollback (`plan_tier` back to `base`).

# Operational Anchors
- Source hierarchy: **repo runtime** (identityAuth, identityMe, quotePdf) > PROJECT-STATE (identity live) > master-plan / GOLIVE.md (stale infra bits). Never treat GOLIVE “migrations pending” as current.
- State labeling: every claim you write in the runbook or chat is `hecho confirmado`, `inferencia`, or `duda abierta`.
- Triangulation: code path → test → runbook. Do not trust a single source for “identity is down”.
- Read-only: master prices, Sheets parámetros/logs/automation, fiscal data.
- If `plus` vs `paid` conflicts, surface it, pick one, and write the decision in the runbook before implementing.

# Open Items
- [ASSUMPTION: New `plan_tier='paid'` rather than overloading `plus` | verify in first 15 min against CRM Plus usage]
- [ASSUMPTION: GCS `identity-branding/` is the logo store | verify bucket helper; Drive-only is acceptable fallback if GCS write is not already wired for user uploads]
- [ASSUMPTION: “Today functional” means code + local/staging UAT + manual DB activation — not payment, not prod merge | verify with user before any production deploy]
- [ASSUMPTION: Sheets tab «Base de datos cotis de clientes» may be missing in prod | verify; leave flag off and document human tab-create if absent]
- [ASSUMPTION: First paid users are activated by Matias (superadmin), not self-serve | verify]
- [ASSUMPTION: Paid users keep default `calc:write`; they do not need new `tareas:read` going forward | verify — do not strip existing grants]
