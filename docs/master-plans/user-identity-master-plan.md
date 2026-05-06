# Master Plan — Comprador Identity, RBAC, Per-User Persistence & Sheets Sync

> **Status:** Draft, approved 2026-05-05. Branch: `claude/user-identity-master-plan-hYGmq`.
> Source: refined from internal product draft (10 phases A–J) after read-only audit of the repo.

## Context

Today the calculator is mostly anonymous and the only "auth" on the API is a single shared Bearer token (`API_AUTH_TOKEN`) used by operators/CI. There is no end-user identity, no RBAC, no per-user quote history, no Wolfboard module gating, and no plan tier. Quotes live in an in-memory map in `server/routes/calc.js` and disappear after 24h.

Crucially, **most of the substrate we need already exists** and just needs to be reused/extended:

- **JWT auth pattern**: `server/lib/waOperatorAuth.js` already implements Magic Link → Access JWT (15min) + Refresh JWT (30d) with rotation-based reuse detection. We mirror it for end-users instead of inventing a parallel stack.
- **Postgres + Supabase migrations**: `pg.Pool` already connected via `DATABASE_URL`; migrations live at `supabase/migrations/` (template: `20260501000001_bmc_price_monitor_init.sql`).
- **Google login endpoint**: `POST /auth/google` (`server/routes/authGoogle.js`) already validates Google access tokens via `oauth2/v3/userinfo`. Currently returns user payload but issues no session — we extend it to upsert a `users` row, mint a JWT, and set an httpOnly refresh cookie.
- **PDF**: `server/routes/pdf.js` (puppeteer-core + @sparticuz/chromium) reused for "PDF visual" export.
- **Sheets**: full-featured Sheets integration in `server/routes/bmcDashboard.js`, helpers in `server/lib/crmOperativoLayout.js` and `server/lib/sheetColumnLetters.js`.

Outcome: Comprador identity (Google OAuth), session-gated calculator at step 5→6, per-user quote history, Wolfboard module RBAC, special-quote flow > USD 8500, base/plus plan tiers, admin-only export (CSV/JSON/PDF) and admin-only opt-in sync to a new Sheets tab «Base de datos cotis de clientes».

---

## Phase 0 — Cross-cutting decisions (assumed, flag if you disagree)

| Decision | Recommendation |
|---|---|
| Session model | Stateless access JWT (15min) + DB-backed refresh (30d) with rotation. Mirror `waOperatorAuth.js`. |
| OAuth flow | Keep GIS client-side access token for Drive scopes; **add** server-side ID-token verification (`google-auth-library` `verifyIdToken`) for identity. |
| Cookie | `bmc_sess=<refresh>; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`, domain via `IDENTITY_COOKIE_DOMAIN`. |
| Plan tiers (per draft §4) | Binary: `base \| plus`. No granular tiers in v1. |
| Operator token unification | Keep `API_AUTH_TOKEN` working as `subject_type='service'` synthetic principal; deprecate after all UI calls migrate to JWT. |
| DB schema name | `identity` (matches `bmc_price_monitor` style). Tables prefixed by schema, not table name. |
| Sheets sync trigger | On-write append (debounced 60s) when `quote.status='completed'`, plus admin-triggered reconcile for misses. |
| Anonymous→user merge | `client_quote_id` cookie set on first wizard interaction; on first login, claim any anonymous quotes with that id. |

---

## Critical files (modify or create)

**Modify**
- `server/routes/authGoogle.js` — issue session on success.
- `server/routes/calc.js:166-182,565-573` — replace in-memory `quotationRegistry` with DB-backed quotes when `req.user` present.
- `server/middleware/requireAuth.js` — wrap into `requireServiceOrUser` shim.
- `server/index.js:~989` — init `identityAuth` next to `initWaOperatorAuth`.
- `server/config.js` — add `identityJwtSecret`, `identityCookieDomain`, `googleOauthClientId`, `sheetsClientQuotesEnabled`, `sheetsClientQuotesTab` (default `Base de datos cotis de clientes`); set `credentials: true` on CORS for whitelisted origins.
- `src/components/PanelinCalculadoraV3_backup.jsx:2633,5443` — gate `advanceWizardStep` at step 5 ("Pendiente"→"Estructura") via `AuthGateModal` when `user == null`.
- `src/App.jsx:76,79-122` — wrap with `BmcAuthProvider`; route-level `<RequireGrant module="...">`.
- `src/components/BmcWolfboardHub.jsx` — gate module cards on `grants.modules[id]`.
- `vercel.json` — confirm cookie pass-through on `/api/*`.
- `.github/workflows/deploy-calc-api.yml` + `cloudbuild-api.yaml` — wire new env vars.
- `tests/validation.js`, `.github/workflows/ci.yml` — include new test files.
- `docs/team/PROJECT-STATE.md`, `AGENTS.md`, `CLAUDE.md`, `REPO_CONTEXT.md`.

**Create**
- `supabase/migrations/20260601000001_identity_init.sql`
- `server/lib/identityAuth.js` (mirrors `server/lib/waOperatorAuth.js`)
- `server/middleware/requireServiceOrUser.js`
- `server/routes/quoteExport.js`
- `server/lib/clientQuotesSheetSync.js`
- `src/hooks/useBmcAuth.js`
- `src/hooks/useModuleGrants.js`
- `src/contexts/BmcAuthProvider.jsx`
- `src/components/auth/AuthGateModal.jsx`
- `src/components/auth/RequireGrant.jsx`
- `src/components/MySpacePage.jsx` (Mi espacio + bandeja + avatar)
- `src/components/MyQuotesPage.jsx`
- `src/components/SpecialQuoteRequestForm.jsx` (>USD 8500)
- `src/components/admin/UserManagementPage.jsx` (rol Admin)
- `src/components/admin/SheetsSyncPanel.jsx`
- `src/components/crm/PersonalCrmPage.jsx` (gris + "Mejorar plan" si `plan='base'`)
- Tests: `tests/identity-auth.test.js`, `tests/identity-routes.test.js`, `tests/quote-persistence.test.js`, `tests/sheets-sync.test.js`
- `docs/identity-auth.md`

---

## Phases

### Phase A — DB schema (foundation)

`supabase/migrations/20260601000001_identity_init.sql`:
- `create schema identity;` + `create extension if not exists citext;`
- `identity.users` (`user_id uuid pk`, `google_sub text unique`, `email citext unique`, `email_verified bool`, `name`, `picture_url`, `avatar_preset text`, `user_type text`, `plan_tier text default 'base'`, `status text default 'active'`, `consent_terms_at`, `consent_marketing_at`, `created_at`, `last_login_at`, `last_active_at`, `jwt_revoked_at`, `metadata jsonb`).
- `identity.sessions` (`session_id uuid pk`, `user_id fk`, `refresh_token_hash`, `refresh_expires_at`, `ip`, `user_agent`, `created_at`, `rotated_from_session_id`, `revoked_at`).
- `identity.role_grants` (`user_id`, `role text` ∈ `{comprador, operator, admin, superadmin}`, `granted_by`, `granted_at`, pk composite).
- `identity.modules` (catalog: `module text pk`, `display_name`, `category`).
- `identity.module_grants` (`user_id`, `module`, `level text` ∈ `{none, read, write, admin}`, `granted_by`, `granted_at`).
- `identity.access_requests` (`request_id`, `user_id`, `module`, `status text` ∈ `{pending, granted, denied}`, `created_at`, `resolved_by`, `resolved_at`).
- `identity.quotes` (`quote_id uuid pk`, `user_id fk nullable`, `client_quote_id text`, `payload jsonb`, `total_usd numeric`, `pdf_id`, `pdf_url`, `gcs_uri`, `drive_file_id`, `wizard_step int`, `status text` ∈ `{draft, completed, exported}`, `sheet_synced_at`, `sheet_row_id text`, `created_at`, `updated_at`).
- `identity.quote_events` (`event_id`, `quote_id fk`, `kind`, `actor_user_id`, `at`, `payload jsonb`).
- `identity.special_quote_requests` (`request_id`, `quote_id fk`, `user_id fk`, `notes text`, `status text`, `created_at`, `resolved_by`, `resolved_at`).
- `identity.notifications` (`notification_id`, `user_id fk`, `kind`, `title`, `body`, `read_at`, `created_at`, `payload jsonb`).
- `identity.crm_personal_contacts`, `identity.crm_personal_leads` (only consumed when `plan='plus'`).
- `identity.audit_log` (mirror `wa_audit_log` shape).
- Triggers: `touch_updated_at` on quotes/users (copy from `20260501000001_bmc_price_monitor_init.sql`).

**Acceptance**: `supabase db push` clean; `list_tables` shows the schema.

---

### Phase B — Identity lib (`server/lib/identityAuth.js`)

Mirror `server/lib/waOperatorAuth.js` API:
- `initIdentityAuth({ pool, logger, sendMail })`
- `verifyGoogleAndUpsert({ idToken | accessToken, ip, userAgent }) → { user, accessToken, refreshToken, sessionId }`
- `refreshTokens({ refreshToken })` with rotation + reuse detection (writes to `identity.sessions`)
- `logout({ userId, sessionId })`
- `revokeUser({ userId, actorId })`
- `requireUser({ role?, module?, minLevel? })` middleware
- JWT claim shape: `{ sub: user_id, email, role, plan_tier, subject_type:'user' }`

Reuse from `waOperatorAuth.js`: `_signJwt`, `_sha256`, `_audit`, rotation logic at lines 198–261, role-rank at 419–422.

New env: `IDENTITY_JWT_SECRET` (≥32 chars), `IDENTITY_COOKIE_DOMAIN`, `GOOGLE_OAUTH_CLIENT_ID`.

Wire `initIdentityAuth(...)` near `server/index.js:~989`.

**Acceptance**: `tests/identity-auth.test.js` (cloned from `tests/wa-operator-auth.test.js`) covers verify→refresh→reuse-detection→logout.

---

### Phase C — `/auth/google` upgrade + sibling routes

Modify `server/routes/authGoogle.js:26-70`:
- Keep current userinfo path; **add** `verifyIdToken` path when `idToken` supplied.
- On success → `identityAuth.verifyGoogleAndUpsert` → upsert `identity.users`, insert `identity.sessions`.
- `Set-Cookie: bmc_sess=<refresh>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`.
- Response body: `{ ok, user, accessToken, accessTokenExpiresIn, role, plan_tier, modules }`.

Add to same router: `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/me/grants`.

CORS: `credentials: true` on whitelist origins (`server/config.js`).

Rate limiter at `authGoogle.js:18-24` reused; extend to refresh route.

**Acceptance**: `curl -X POST /api/auth/google` → `Set-Cookie: bmc_sess=...` + `accessToken` in JSON; `GET /api/auth/me` with Bearer → user object.

---

### Phase D — Client auth hook + wizard gate (step 5→6)

- `src/contexts/BmcAuthProvider.jsx` — `{ user, status, login(), logout(), refreshAccess() }` exposed via context. Wrap in `src/App.jsx:76`.
- `src/hooks/useBmcAuth.js` — consumes context; on `login()` calls GIS (existing `src/utils/googleDrive.js`), then `POST /api/auth/google`, then stores access JWT in memory.
- `src/components/auth/AuthGateModal.jsx` — opened by wizard when not logged in.
- Modify `src/components/PanelinCalculadoraV3_backup.jsx`:
  - At `:2633` (`advanceWizardStep`): if current step is the **Pendiente** step (5) and `!user`, open modal instead of `setWizardStep(next)`.
  - At `:5443` ("Siguiente" button onClick): same guard + tooltip when disabled.
  - On modal success → resume `advanceWizardStep`.

Avatar source priority: Google OAuth picture → user-chosen preset → animated default (commercial / residential / constructor / barraca) — matches Panelin aesthetic per draft §5.3.

**Acceptance**: dev mode — clicking "Siguiente" at step 5 unauthenticated opens modal; after Google login the wizard advances to step 6 and the quote is associated with `user_id`.

---

### Phase E — RBAC for API + Wolfboard hub UI

- Server: apply `requireUser({ module, minLevel })` to `/api/wa/*`, `/api/bmc/*`, `/api/ml/*`, `/api/admin/*`, alongside (not replacing) existing operator/service guards.
- `GET /api/auth/me/grants` returns `{ role, plan_tier, modules: { calc:'write', wa:'read', ... } }`.
- Frontend: `src/hooks/useModuleGrants.js`; `src/components/BmcWolfboardHub.jsx` greys out cards where `grants.modules[id] === 'none'` and shows "Solicitar acceso" button → `POST /api/access-requests` → notification to all `superadmin` users.
- `src/components/auth/RequireGrant.jsx` wraps protected routes in `src/App.jsx:79-122`; renders 403 page on deny.
- `superadmin` bypass: `requireUser` short-circuits all checks when `role === 'superadmin'`.

**Acceptance**: a `comprador`-only user sees only the `Calculadora` and `Mi espacio` cards on `/hub`; `/hub/wa` returns 403; clicking a greyed card creates an `access_request` row and a notification for superadmins.

---

### Phase F — Per-user quote persistence + Mi espacio + special-quote flow

- Modify `server/routes/calc.js:166-182,565-573`:
  - When `req.user` present → upsert `identity.quotes` keyed by `(user_id, client_quote_id)`; insert `identity.quote_events`.
  - When anonymous → keep in-memory map (24h) keyed by `client_quote_id`.
- New endpoints: `GET /api/me/quotes`, `GET /api/me/quotes/:id`, `DELETE /api/me/quotes/:id`, `POST /api/me/special-quote-requests`, `GET /api/me/notifications`, `PATCH /api/me/notifications/:id` (mark read).
- New page `src/components/MySpacePage.jsx` (route `/mi-espacio`) — sections: Avatar, Mis cotizaciones, Bandeja, Solicitudes, Preferencias, T&C/consent.
- `src/components/MyQuotesPage.jsx` lists + filters; CTA "Solicitar presupuesto especial" appears when `total_usd > 8500`.
- Anonymous→user merge: on `POST /auth/google` success, claim `identity.quotes` rows whose `client_quote_id` cookie matches and `user_id IS NULL`.
- Global header (top right): user icon + avatar + dropdown (Mi espacio, Mis cotizaciones, Bandeja, Cerrar sesión).

Reuse `server/lib/gcsUpload.js` and `server/lib/driveUpload.js` — only the URIs land in DB.

**Acceptance**: complete a quote logged in → reload `/mi-espacio` → quote listed; quote with `total_usd > 8500` shows the "Solicitar presupuesto especial" CTA; submitting the form creates a `special_quote_requests` row + notification to all `admin` users.

---

### Phase G — Decouple `API_AUTH_TOKEN` (operator → service principal)

- New `server/middleware/requireServiceOrUser.js` accepts either:
  - Static `API_AUTH_TOKEN` → synthesizes `req.user = { role:'service', subject_type:'service' }` with full module access.
  - User JWT (Phase B).
- `server/middleware/requireAuth.js` becomes a thin shim around it (keeps backward compat).
- Seed migration: insert `identity.users` rows with `role='superadmin'` for current internal operator emails so they can log in via Google and get full access without the static token.
- Document deprecation timeline in `docs/identity-auth.md`. Keep `API_AUTH_TOKEN` valid for CI/cron until all UI callers migrate.

**Acceptance**: existing scripts using `Authorization: Bearer $API_AUTH_TOKEN` keep working; new UI calls use cookie + access JWT only.

---

### Phase H — Admin export engine (CSV / JSON / PDF visual)

- New `server/routes/quoteExport.js`:
  - `POST /api/admin/export` (gated `requireUser({ role:'admin' })`) — body: `{ entities: ['users','quotes','crm_contacts','special_requests','sync_logs'], formats: ['csv','json','pdf'], ids?: [...], dateRange?: {...} }` → returns ZIP download or array of presigned URLs.
  - Per-format helpers reused for `GET /api/me/quotes/:id/export.{csv,json,pdf}` (user-self).
- PDF visual: reuse `server/routes/pdf.js` puppeteer pipeline with a templated HTML shell.
- Frontend `src/components/admin/ExportPanel.jsx` — multi-select entities × formats grid.

**Acceptance**: admin selects "users + quotes" × "CSV + PDF" → downloads ZIP with 4 files correctly named and content-typed.

---

### Phase I — Opt-in admin sync → Sheets tab «Base de datos cotis de clientes»

- New `server/lib/clientQuotesSheetSync.js`:
  - Append/upsert to tab named exactly **`Base de datos cotis de clientes`** (literal per draft §7) on the same spreadsheet used by `bmcDashboard.js`.
  - Idempotency key: `quote_id` (column A); upsert via row lookup.
  - Triggers: (a) on `quote.status='completed'` (debounced 60s queue), (b) admin-triggered `POST /api/admin/sheets/clientes/reconcile`, (c) admin-triggered single-quote retry `POST /api/admin/sheets/clientes/sync/:quote_id`.
  - Schema (v1, versioned in code + `docs/sheets-mapper-clientes.md`): `quote_id | user_email | user_name | created_at | scenario | total_usd | total_uyu | pdf_url | drive_file_id | sync_batch_id | wizard_payload_json`.
  - Audit row in `identity.audit_log` per sync run.
- New env: `SHEETS_CLIENT_QUOTES_ENABLED` (boolean, default false), `SHEETS_CLIENT_QUOTES_TAB` (override).
- Frontend `src/components/admin/SheetsSyncPanel.jsx` — manual run button + last-sync metadata + failure list.

Reuse: Sheets client init in `bmcDashboard.js`, column-letter helper `server/lib/sheetColumnLetters.js`, auth cache `server/lib/googleAuthCache.js`.

**Acceptance**: completing a quote logged in → within 60s the Sheets tab shows a row with matching `quote_id`; re-running sync does not duplicate; admin reconcile picks up rows where `sheet_synced_at IS NULL`.

---

### Phase J — CRM personal Plus + hardening + ship

- CRM personal: `identity.crm_personal_contacts` + `_leads` + UI page `src/components/crm/PersonalCrmPage.jsx`. When `user.plan_tier='base'` → render greyed UI + "Mejorar plan" CTA. When `'plus'` → operative.
- Tests: `tests/identity-auth.test.js`, `tests/identity-routes.test.js`, `tests/quote-persistence.test.js`, `tests/sheets-sync.test.js` (pattern from `tests/auth-routes.test.js`).
- CI (`.github/workflows/ci.yml`): include new tests; `scripts/check-env-drift.mjs` accepts new vars.
- Deploy (`.github/workflows/deploy-calc-api.yml` + `cloudbuild-api.yaml`): wire `IDENTITY_JWT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`, `IDENTITY_COOKIE_DOMAIN`, `SHEETS_CLIENT_QUOTES_ENABLED`, `SHEETS_CLIENT_QUOTES_TAB`.
- Rate-limit `/api/auth/*` and `/api/admin/sheets/*`; tighten CORS in prod.
- Docs: `docs/identity-auth.md` (flow diagram), `docs/sheets-mapper-clientes.md` (column contract v1); update `docs/team/PROJECT-STATE.md`, `AGENTS.md`, `CLAUDE.md`, `REPO_CONTEXT.md`.

**Acceptance**: `npm run gate:local:full` green; smoke `GET /api/auth/me` on prod → 401 unauthenticated, 200 after login; PROJECT-STATE.md updated.

---

## Verification (end-to-end)

1. **Migration**: `supabase db push` → all `identity.*` tables created.
2. **Local API**: `npm run dev:full`. `curl -X POST :3001/api/auth/google -d '{...}'` returns `Set-Cookie` + `accessToken`.
3. **Wizard gate**: in browser at :5173, complete steps 1–5 anonymously → click Siguiente → modal opens → Google login → step 6 reached → `identity.quotes` row exists with that `user_id`.
4. **RBAC**: log in as a `comprador`-only user → `/hub` shows only Calculadora + Mi espacio; `/hub/wa` shows 403; click greyed card → `identity.access_requests` row + notification on superadmin's `/mi-espacio` bandeja.
5. **>USD 8500 flow**: complete a quote with total > 8500 → CTA visible → submit → `special_quote_requests` row + admin notification.
6. **Export**: as admin, multi-select export → ZIP downloads correctly typed.
7. **Sync**: as admin enable `SHEETS_CLIENT_QUOTES_ENABLED=true` → complete a quote → within 60s the Sheets tab «Base de datos cotis de clientes» shows the row; re-run reconcile → no duplicate.
8. **Plus gate**: `plan_tier='base'` → CRM personal greyed with "Mejorar plan"; `plan_tier='plus'` → operative.
9. **Tests**: `npm run gate:local:full` green; `node --test tests/identity-*.test.js tests/quote-persistence.test.js tests/sheets-sync.test.js` green.
10. **Prod smoke** (post-deploy): `GET /api/auth/me` → 401 (proves route mounted); GIS login from prod UI → cookie set on `*.calculadora-bmc.vercel.app`; quote completion writes to DB and Sheets.
