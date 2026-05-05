# Execution Runbook — Comprador Identity Master Plan

> Companion to [`user-identity-master-plan.md`](./user-identity-master-plan.md).
> This runbook is **copy-paste executable**: branch names, exact commands, agent prompts, acceptance gates, and rollback per phase.
> Designed for serial execution by a single developer **or** an agent orchestrator (one PR per phase).

---

## How to use this document

1. **One phase = one branch = one PR**, each branched off `main` after the prior phase merges.
2. Each phase has a fixed structure: **Inputs → Tasks → Commands → Agent prompt → Tests → Acceptance gate → PR template → Rollback**.
3. **Agent prompt** blocks are designed to be pasted verbatim into a fresh Claude Code session (specialist subagent indicated). They include all context needed without back-references to chat history.
4. Mark each TODO checkbox as you finish; do not skip the acceptance gate.
5. Phase order is **strict**: A → B → C → D → E → F → G → H → I → J. Phase A unblocks all others.

---

## Phase 0 — Prerequisites & secrets

**Inputs required before Phase A starts:**

- [ ] Supabase project access (`htnwozvopveibwppyjhg`) — `psql $DATABASE_URL` works locally.
- [ ] Google Cloud Console: confirm OAuth Client ID for the **web** app; copy `GOOGLE_OAUTH_CLIENT_ID` (used server-side for `verifyIdToken`).
- [ ] Generate `IDENTITY_JWT_SECRET` (≥32 chars random):
  ```bash
  openssl rand -base64 48
  ```
- [ ] Decide `IDENTITY_COOKIE_DOMAIN` for prod (`.calculadora-bmc.vercel.app` for previews + prod, or apex `calculadora-bmc.vercel.app`).
- [ ] Confirm Sheets tab name will be created exactly as: `Base de datos cotis de clientes` in the same spreadsheet `BMC_SHEET_ID` already uses.
- [ ] Decide whether to bridge `API_AUTH_TOKEN` as `service` principal (default: yes, see Phase G).

**Add to `.env.example` now (no value, just keys) so CI env-drift check accepts them later:**

```bash
# Identity (Comprador) auth — Phase A+
IDENTITY_JWT_SECRET=
IDENTITY_COOKIE_DOMAIN=
GOOGLE_OAUTH_CLIENT_ID=
# Sheets sync — Phase I
SHEETS_CLIENT_QUOTES_ENABLED=false
SHEETS_CLIENT_QUOTES_TAB=Base de datos cotis de clientes
```

**Acceptance gate:** `node scripts/check-env-drift.mjs` does not fail on the new keys.

---

## Phase A — DB schema (foundation)

**Branch:** `feat/identity-A-schema`
**PR title:** `feat(identity): Phase A — schema migration for identity.* tables`
**Estimated:** 0.5–1 day.

### Tasks

- [ ] Create `supabase/migrations/20260601000001_identity_init.sql` (copy header from `20260501000001_bmc_price_monitor_init.sql`).
- [ ] Define 12 tables under `identity` schema (see master plan §Phase A for column list).
- [ ] Add `touch_updated_at` trigger on `quotes`, `users`, `crm_personal_*`.
- [ ] Seed `identity.modules` catalog: `('calc'), ('wa'), ('ml'), ('admin'), ('plan-import'), ('agent-admin'), ('canales'), ('crm-personal')`.
- [ ] Add covering indexes: `users(google_sub)`, `users(email)`, `sessions(user_id, refresh_expires_at)`, `quotes(user_id, created_at desc)`, `module_grants(user_id, module)`, `notifications(user_id, read_at) where read_at is null`.

### Commands

```bash
git checkout main && git pull
git checkout -b feat/identity-A-schema

# Scaffold migration file
cp supabase/migrations/20260501000001_bmc_price_monitor_init.sql \
   supabase/migrations/20260601000001_identity_init.sql

# Edit file (see agent prompt below) — then dry-run locally
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260601000001_identity_init.sql

# Verify
psql "$DATABASE_URL" -c "\dt identity.*"
psql "$DATABASE_URL" -c "select count(*) from identity.modules;"  # expect 8
```

### Agent prompt (paste into fresh Claude Code session)

```
You are working on /home/user/Calculadora-BMC, branch feat/identity-A-schema.

Read these files first:
- docs/master-plans/user-identity-master-plan.md (Phase A section, full table list)
- supabase/migrations/20260501000001_bmc_price_monitor_init.sql (template — copy header style and trigger pattern)

Task: write supabase/migrations/20260601000001_identity_init.sql implementing the 12 tables under schema "identity" exactly as listed in the master plan Phase A. Requirements:
- Begin with `create extension if not exists "uuid-ossp";` and `create extension if not exists citext;` and `create schema if not exists identity;`
- Every PK is `uuid default uuid_generate_v4()` unless the master plan specifies otherwise
- All FKs `on delete cascade` to user, except quote_events (which preserves history)
- Add the indexes listed in the runbook Phase A "Tasks"
- Reuse the `touch_updated_at()` function defined in the price-monitor migration; do not redeclare
- Seed identity.modules with 8 rows: calc, wa, ml, admin, plan-import, agent-admin, canales, crm-personal
- Do NOT modify any other file
- Do NOT run psql; just write the SQL file

When done, output `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260601000001_identity_init.sql` for me to run, and stop.
```

### Tests

```bash
# Idempotence: re-running must not fail
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260601000001_identity_init.sql

# Schema sanity
psql "$DATABASE_URL" -c "select schemaname, tablename from pg_tables where schemaname='identity' order by tablename;"
# Expect 12 rows
```

### Acceptance gate

- [ ] 12 tables exist under `identity` schema.
- [ ] Re-running migration is a no-op (no errors).
- [ ] `npm run lint` passes (no JS changed but baseline must stay green).

### PR template

```
## Summary
- New `identity` schema with 12 tables (users, sessions, role_grants, module_grants, modules, access_requests, quotes, quote_events, special_quote_requests, notifications, crm_personal_contacts, crm_personal_leads, audit_log).
- Seeded `identity.modules` catalog with 8 known modules.

## Test plan
- [ ] `psql -f supabase/migrations/20260601000001_identity_init.sql` clean against staging
- [ ] Re-run is idempotent
- [ ] No app code changes (docs + migration only)

Ref: docs/master-plans/user-identity-master-plan.md §Phase A
```

### Rollback

```sql
drop schema identity cascade;
```

---

## Phase B — Identity lib (`server/lib/identityAuth.js`)

**Branch:** `feat/identity-B-auth-lib`
**Depends on:** Phase A merged.
**Estimated:** 1–2 days.

### Tasks

- [ ] Create `server/lib/identityAuth.js` mirroring `server/lib/waOperatorAuth.js` API surface.
- [ ] Functions: `initIdentityAuth`, `verifyGoogleAndUpsert`, `refreshTokens`, `logout`, `revokeUser`, `requireUser({ role?, module?, minLevel? })`.
- [ ] Reuse: `_signJwt`, `_sha256`, `_audit`, role-rank pattern from `waOperatorAuth.js:198-261, 419-422`.
- [ ] Wire `initIdentityAuth({ pool, logger, sendMail })` in `server/index.js` near line 989 (after `initWaOperatorAuth`).
- [ ] Add `IDENTITY_JWT_SECRET`, `IDENTITY_COOKIE_DOMAIN`, `GOOGLE_OAUTH_CLIENT_ID` to `server/config.js`.
- [ ] Add `google-auth-library` dependency: `npm install google-auth-library`.
- [ ] Tests: clone `tests/wa-operator-auth.test.js` → `tests/identity-auth.test.js` and adapt.

### Commands

```bash
git checkout main && git pull
git checkout -b feat/identity-B-auth-lib

npm install google-auth-library

# After agent finishes:
node --test tests/identity-auth.test.js
npm run lint
npm run gate:local
```

### Agent prompt

```
You are working on /home/user/Calculadora-BMC, branch feat/identity-B-auth-lib.

Read these files first (read in this order, all of them):
- docs/master-plans/user-identity-master-plan.md (Phase B section)
- server/lib/waOperatorAuth.js (this is the template — your new file mirrors its structure)
- tests/wa-operator-auth.test.js (test template)
- server/config.js (where to add new env-keyed config fields)
- server/index.js lines 980–1000 (where to wire init)

Task: create server/lib/identityAuth.js. Requirements:
1. Same module-level singleton pattern as waOperatorAuth: `let _ctx = null; export function initIdentityAuth({pool, logger, sendMail}) { _ctx = {...}; }`
2. Reuse helpers verbatim where possible: `_sha256`, `_signJwt`, `_audit`, `_rankRole` — but rename roles to {comprador, operator, admin, superadmin}
3. JWT claims: `{ sub: user_id, email, role, plan_tier, subject_type: 'user' }`
4. `verifyGoogleAndUpsert({ idToken, accessToken, ip, userAgent })`:
   - If idToken present: use `OAuth2Client(GOOGLE_OAUTH_CLIENT_ID).verifyIdToken({idToken, audience: GOOGLE_OAUTH_CLIENT_ID})`
   - Else: GET https://www.googleapis.com/oauth2/v3/userinfo with `Authorization: Bearer ${accessToken}`
   - Upsert into identity.users by google_sub; bump last_login_at
   - Insert identity.sessions row with sha256(refresh_token) hash; return {user, accessToken (15min JWT), refreshToken (random 64 bytes hex), sessionId}
5. `refreshTokens({ refreshToken })`: lookup hashed refresh; if `revoked_at IS NOT NULL` → revoke entire user (reuse detection); rotate (insert new row, mark old `revoked_at` and `rotated_from_session_id`)
6. `requireUser(opts)` middleware: reads cookie `bmc_sess` OR `Authorization: Bearer <accessJwt>`; verifies; attaches `req.user`; supports `opts.role`, `opts.module`, `opts.minLevel`
7. Export new env keys via server/config.js: `identityJwtSecret`, `identityCookieDomain`, `googleOauthClientId`
8. Wire `initIdentityAuth(...)` in server/index.js right after `initWaOperatorAuth` block

Then create tests/identity-auth.test.js as a clone of tests/wa-operator-auth.test.js adapted for: verify→refresh rotation→reuse-detection→logout→revoke.

Run:
- `node --test tests/identity-auth.test.js` — all passing
- `npm run lint` — clean

Stop when both pass; do NOT modify routes yet (that's Phase C).
```

### Tests

```bash
node --test tests/identity-auth.test.js
npm run lint
npm run gate:local
```

### Acceptance gate

- [ ] `tests/identity-auth.test.js` passes (verify, refresh, reuse-detection, logout).
- [ ] `npm run lint` clean.
- [ ] `server/index.js` boot does not regress: `npm run dev:full` starts and `/health` returns 200.

### PR template

```
## Summary
- New `server/lib/identityAuth.js` mirrors `server/lib/waOperatorAuth.js` pattern.
- Adds `verifyGoogleAndUpsert`, `refreshTokens` with rotation/reuse detection, `requireUser` middleware.
- New env: `IDENTITY_JWT_SECRET`, `IDENTITY_COOKIE_DOMAIN`, `GOOGLE_OAUTH_CLIENT_ID`.
- Test: tests/identity-auth.test.js clones WA operator test pattern.

## Test plan
- [ ] `node --test tests/identity-auth.test.js` green
- [ ] `npm run gate:local` green
- [ ] No route changes yet (Phase C)

Ref: docs/master-plans/user-identity-master-plan.md §Phase B
```

### Rollback

`git revert <merge-sha>`. Library is unused until Phase C wires routes.

---

## Phase C — `/auth/google` upgrade + sibling routes

**Branch:** `feat/identity-C-auth-routes`
**Depends on:** Phase B merged.
**Estimated:** 1 day.

### Tasks

- [ ] Modify `server/routes/authGoogle.js`: on success, call `identityAuth.verifyGoogleAndUpsert`; set httpOnly refresh cookie; return access JWT + user.
- [ ] Add `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/me/grants` to the same router.
- [ ] CORS: set `credentials: true` for whitelisted origins in `server/config.js`.
- [ ] Add `cookie-parser` if not present; verify it's mounted in `server/index.js`.
- [ ] Tests: `tests/identity-routes.test.js` — POST /auth/google with mocked Google verify; assert Set-Cookie + JSON shape.

### Commands

```bash
git checkout main && git pull
git checkout -b feat/identity-C-auth-routes
npm ls cookie-parser || npm install cookie-parser

# After agent finishes:
node --test tests/identity-routes.test.js
npm run dev:full &
sleep 3
curl -sS -i -X POST http://localhost:3001/api/auth/google \
  -H 'Content-Type: application/json' \
  -d '{"accessToken":"<paste real token from GIS popup in browser console>"}' | head -30
kill %1 2>/dev/null
```

### Agent prompt

```
Branch: feat/identity-C-auth-routes. Read in order:
- docs/master-plans/user-identity-master-plan.md §Phase C
- server/routes/authGoogle.js (extend, do not rewrite)
- server/lib/identityAuth.js (use verifyGoogleAndUpsert, refreshTokens, logout, requireUser)
- server/routes/wa.js (look for cookie/JWT pattern reference for /auth/refresh, /auth/logout, /auth/me — adapt)
- server/index.js (confirm router mount path; ensure cookie-parser is global before this router)
- server/config.js (CORS configuration — `credentials: true` plus echo of origin)

Task: extend server/routes/authGoogle.js to:
1. POST /auth/google — accept body `{idToken?, accessToken?}`. Call verifyGoogleAndUpsert. Set cookie `bmc_sess=<refreshToken>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000; Domain=${IDENTITY_COOKIE_DOMAIN || omitted in dev}`. Respond JSON `{ok:true, user, accessToken, accessTokenExpiresIn:900, role, plan_tier, modules}`.
2. POST /auth/refresh — read cookie bmc_sess, call identityAuth.refreshTokens, rotate cookie, return new accessToken JSON.
3. POST /auth/logout — clear cookie, call identityAuth.logout for the current session.
4. GET /auth/me — requireUser; return `{user, role, plan_tier}`.
5. GET /auth/me/grants — requireUser; return `{role, plan_tier, modules: {calc:'write', wa:'read', ...}}` derived from identity.module_grants joined with role-implied defaults.

Reuse the existing express-rate-limit at top of authGoogle.js; extend the same limiter to /auth/refresh.

Tests in tests/identity-routes.test.js:
- Mock identityAuth.verifyGoogleAndUpsert via dependency injection or by stubbing global fetch
- Spin up Express app with just this router
- Assert: 200 + Set-Cookie header on POST /auth/google
- Assert: 401 on GET /auth/me without auth
- Assert: 200 + user payload on GET /auth/me with valid Bearer

Update server/config.js CORS: when `credentials: true`, origin must be explicit (not `*`); echo allowed origin from whitelist.

Run gate:local; stop when green.
```

### Tests

```bash
node --test tests/identity-routes.test.js
npm run gate:local
# Manual smoke (after npm run dev:full):
curl -i -X POST http://localhost:3001/api/auth/google -H 'Content-Type: application/json' -d '{"accessToken":"..."}'
curl -i http://localhost:3001/api/auth/me -H 'Authorization: Bearer <accessJwt>'
```

### Acceptance gate

- [ ] `Set-Cookie: bmc_sess=...; HttpOnly; Secure; SameSite=Lax` returned on successful login.
- [ ] `GET /api/auth/me` returns 401 unauthenticated, 200 with valid Bearer.
- [ ] `tests/identity-routes.test.js` green.

### Rollback

Revert merge; the only side-effects are DB rows in `identity.users`/`identity.sessions` which are harmless idle.

---

## Phase D — Client auth hook + wizard gate

**Branch:** `feat/identity-D-wizard-gate`
**Depends on:** Phase C merged.
**Estimated:** 1.5 days.

### Tasks

- [ ] Create `src/contexts/BmcAuthProvider.jsx`, `src/hooks/useBmcAuth.js`, `src/components/auth/AuthGateModal.jsx`.
- [ ] Wrap router in `src/App.jsx:76` with `<BmcAuthProvider>`.
- [ ] Modify `src/components/PanelinCalculadoraV3_backup.jsx`:
  - Line 2633 (`advanceWizardStep`): if at Pendiente step (5) and `!user`, open modal.
  - Line 5443 (Siguiente button onClick): same guard.
- [ ] Avatar: pull from Google `picture` first, then `avatar_preset`, then default.

### Commands

```bash
git checkout main && git pull
git checkout -b feat/identity-D-wizard-gate

# After agent finishes:
npm run lint
npm run dev:full
# Manual: open http://localhost:5173, complete steps 1–5, click Siguiente unauthenticated → modal must open
```

### Agent prompt

```
Branch: feat/identity-D-wizard-gate. Read:
- docs/master-plans/user-identity-master-plan.md §Phase D
- src/components/PanelinCalculadoraV3_backup.jsx (lines 2620–2650 for advanceWizardStep, lines 5430–5460 for Siguiente button)
- src/utils/googleDrive.js (existing GIS init — reuse, do not duplicate)
- src/App.jsx (where to wrap with provider)

Task:
1. Create src/contexts/BmcAuthProvider.jsx with React context exposing { user, status, accessToken, login(), logout(), refreshAccess() }. On mount, call GET /api/auth/me with credentials:'include'; if 401 attempt POST /api/auth/refresh once; if still 401, status='anonymous'.
2. Create src/hooks/useBmcAuth.js — thin wrapper around context.
3. Create src/components/auth/AuthGateModal.jsx — Tailwind modal with title "Iniciá sesión para guardar tu cotización", primary button "Continuar con Google" that calls window.googleDrive.requestAccessToken (existing) → POST /api/auth/google → on success closes modal and resolves a Promise.
4. Wrap <BrowserRouter> in src/App.jsx:76 with <BmcAuthProvider>.
5. Edit src/components/PanelinCalculadoraV3_backup.jsx:
   - Import useBmcAuth at top
   - In advanceWizardStep (line ~2633): if `wizardStep === SOLO_TECHO_PENDIENTE_STEP_INDEX` (or equivalent constant — find it in src/data/constants.js) and `auth.user == null`, open AuthGateModal and only call setWizardStep on modal resolve
   - At line ~5443 Siguiente button: when auth gate would block, swap onClick to open modal; do not disable the button (user expects feedback)

Do NOT touch any unrelated code. After edits run `npm run lint` and visually verify in dev mode (npm run dev:full).
```

### Tests

```bash
npm run lint
npm run gate:local
# Manual UI test:
# 1. Open http://localhost:5173 in incognito (no cookies)
# 2. Complete steps 1–5 of Solo Techo
# 3. Click Siguiente
# 4. Modal opens
# 5. Click Google login → wizard advances to step 6
# 6. Reload page → user persists (cookie + /api/auth/me)
```

### Acceptance gate

- [ ] Anonymous user blocked at step 5→6 with modal.
- [ ] Logged-in user advances normally; quote receives `user_id` server-side (verify in `identity.quotes`).
- [ ] Reload preserves session.

### Rollback

Revert merge; no DB impact.

---

## Phase E — RBAC for API + Wolfboard hub UI

**Branch:** `feat/identity-E-rbac`
**Depends on:** Phase D merged.
**Estimated:** 2 days.

### Tasks

- [ ] Apply `requireUser({ module, minLevel })` to `/api/wa/*`, `/api/bmc/*`, `/api/ml/*`, `/api/admin/*`.
- [ ] Create `src/hooks/useModuleGrants.js`, `src/components/auth/RequireGrant.jsx`.
- [ ] Modify `src/components/BmcWolfboardHub.jsx` — grey out cards without grant; "Solicitar acceso" button.
- [ ] Endpoint `POST /api/access-requests` → insert `identity.access_requests` + notify all `superadmin` users.
- [ ] Wrap routes in `src/App.jsx:79-122` with `<RequireGrant>`.

### Agent prompt (delegate to bmc-security subagent)

```
Use subagent_type: bmc-security.

Branch feat/identity-E-rbac on /home/user/Calculadora-BMC. Read:
- docs/master-plans/user-identity-master-plan.md §Phase E
- server/lib/identityAuth.js (requireUser middleware)
- server/middleware/requireAuth.js (existing operator-token guard — keep as fallback alongside requireUser)
- server/routes/wa.js, server/routes/bmcDashboard.js, server/routes/mlSearch.js, server/routes/agentVoice.js (apply requireUser)
- src/App.jsx (lines 79–122 — wrap routes)
- src/components/BmcWolfboardHub.jsx (gating logic)

Task:
1. Add `requireUser({module: 'wa', minLevel: 'read'})` (or 'write' on POST/PATCH/DELETE) to wa routes; same pattern for bmc, ml, admin.
2. Server: add POST /api/access-requests (requireUser, no module gate), inserts identity.access_requests; on success insert identity.notifications rows for every user with role=superadmin.
3. Frontend: src/hooks/useModuleGrants.js fetches /api/auth/me/grants once on auth state, caches in context.
4. src/components/auth/RequireGrant.jsx: `<RequireGrant module="wa" minLevel="read"><Outlet/></RequireGrant>`. On deny render <ForbiddenPage/>.
5. BmcWolfboardHub.jsx: each card reads grants; if `none`, render greyed card with "Solicitar acceso" → POST /api/access-requests.
6. superadmin bypass already implemented in requireUser; do not duplicate UI logic.

Run `npm run gate:local` and `node --test tests/*.test.js`. Stop when green.
```

### Acceptance gate

- [ ] Comprador-only user sees only Calculadora + Mi espacio cards.
- [ ] `/hub/wa` returns 403 page for comprador; admin sees normally.
- [ ] Greyed card "Solicitar acceso" creates `access_requests` row + notification rows for superadmins.

---

## Phase F — Per-user quote persistence + Mi espacio + special-quote flow

**Branch:** `feat/identity-F-quotes`
**Depends on:** Phase E merged.
**Estimated:** 2–3 days.

### Tasks

- [ ] Modify `server/routes/calc.js:166-182,565-573` to persist into `identity.quotes` when `req.user`.
- [ ] Anonymous→user merge on `POST /auth/google` (Phase C extension): claim quotes by `client_quote_id` cookie.
- [ ] `client_quote_id` cookie set on first wizard interaction (frontend).
- [ ] New endpoints: `GET /api/me/quotes`, `GET /api/me/quotes/:id`, `DELETE /api/me/quotes/:id`, `POST /api/me/special-quote-requests`, `GET /api/me/notifications`, `PATCH /api/me/notifications/:id`.
- [ ] New pages: `MySpacePage.jsx` (route `/mi-espacio`), `MyQuotesPage.jsx`, `SpecialQuoteRequestForm.jsx` (>USD 8500 trigger).
- [ ] Global header: avatar + dropdown (Mi espacio, Cerrar sesión).

### Agent prompt (delegate to bmc-calc-specialist for calc.js, then bmc-panelin-chat for UI shell)

```
Subagent 1: bmc-calc-specialist
Branch: feat/identity-F-quotes. Read:
- docs/master-plans/user-identity-master-plan.md §Phase F
- server/routes/calc.js lines 160–200 and 555–600 (in-memory quotationRegistry)
- server/lib/identityAuth.js (requireUser optional — pass `optional:true` flag so anonymous still works)

Task: in server/routes/calc.js replace quotationRegistry.set/get calls with a thin adapter that writes to identity.quotes when req.user is present, falls back to in-memory when anonymous. Keep 24h TTL on anonymous map. Add new endpoints under server/routes/quotesMe.js:
- GET /api/me/quotes — list paginated (requireUser)
- GET /api/me/quotes/:id (requireUser, ownership check)
- DELETE /api/me/quotes/:id (requireUser, soft-delete sets status='deleted')
- POST /api/me/special-quote-requests body `{quoteId, notes}` — only allowed if quotes.total_usd > 8500. Insert identity.special_quote_requests + admin notifications.

Run `node --test tests/quote-persistence.test.js` (create from scratch using tests/auth-routes.test.js pattern).

When green, hand off to subagent 2.

---

Subagent 2: bmc-panelin-chat (or general-purpose if unavailable)
Read: src/components/PanelinCalculadoraV3_backup.jsx (header area for avatar dropdown), src/contexts/BmcAuthProvider.jsx.

Create src/components/MySpacePage.jsx, MyQuotesPage.jsx, SpecialQuoteRequestForm.jsx as described in master plan. Add route /mi-espacio in src/App.jsx. Add global header avatar dropdown with links: Mi espacio, Mis cotizaciones, Bandeja, Cerrar sesión.

Run gate:local. Stop when green.
```

### Acceptance gate

- [ ] Logged-in quote completion writes a row in `identity.quotes` with correct `user_id`.
- [ ] `/mi-espacio` lists quotes after reload.
- [ ] Quote with `total_usd > 8500` shows the special-quote CTA; submission creates rows + admin notifications.

---

## Phase G — Decouple `API_AUTH_TOKEN`

**Branch:** `feat/identity-G-service-principal`
**Depends on:** Phase F merged.
**Estimated:** 0.5 day.

### Agent prompt (bmc-security)

```
Subagent: bmc-security. Branch feat/identity-G-service-principal.

Read:
- server/middleware/requireAuth.js (current token-only guard)
- server/lib/identityAuth.js (requireUser)
- All route files using `requireAuth` (grep `from .*requireAuth`)

Task:
1. Create server/middleware/requireServiceOrUser.js — accepts EITHER static API_AUTH_TOKEN (synthesizes req.user = {role:'service', subject_type:'service', module_grants: ALL_ADMIN}) OR a valid user JWT.
2. Convert server/middleware/requireAuth.js to a thin re-export of requireServiceOrUser for backward compat.
3. Add seed migration supabase/migrations/20260601000002_identity_seed_superadmins.sql — insert identity.users + role_grants for known internal operator emails (read from a server/config.js list `internalSuperadminEmails`).
4. Document deprecation in docs/identity-auth.md (create the doc).

Tests must pass; do not break any existing route.
```

### Acceptance gate

- [ ] Existing scripts using `Authorization: Bearer $API_AUTH_TOKEN` keep returning 200.
- [ ] User JWT calls also pass on the same routes.
- [ ] No 500s in `npm run gate:local`.

---

## Phase H — Admin export engine

**Branch:** `feat/identity-H-export`
**Depends on:** Phase G merged.
**Estimated:** 1.5 days.

### Tasks

- [ ] `server/routes/quoteExport.js` — `POST /api/admin/export` (multi-entity × multi-format → ZIP).
- [ ] User-self export: `GET /api/me/quotes/:id/export.{csv,json,pdf}`.
- [ ] PDF reuses `server/routes/pdf.js` puppeteer pipeline.
- [ ] Frontend: `src/components/admin/ExportPanel.jsx`.
- [ ] New dependency: `npm install jszip`.

### Agent prompt

```
Branch feat/identity-H-export. Read:
- docs/master-plans/user-identity-master-plan.md §Phase H
- server/routes/pdf.js (puppeteer pipeline — reuse, do not reimplement)

Task: create server/routes/quoteExport.js with endpoints listed in the master plan. POST /api/admin/export must:
- Accept body `{entities: string[], formats: string[], ids?: string[], dateRange?: {from, to}}`
- Build a JSZip with `<entity>.<format>` files
- Stream the zip via res.setHeader('Content-Disposition', 'attachment; filename=...')

Add tests/export.test.js: assert ZIP structure with entities=['quotes'], formats=['csv','json'].

Frontend src/components/admin/ExportPanel.jsx with multi-select grid; gated by RequireGrant role='admin'.
```

### Acceptance gate

- [ ] Admin selects users + quotes × CSV + PDF → ZIP with 4 files; mime type `application/zip`.
- [ ] Non-admin gets 403.

---

## Phase I — Sheets sync «Base de datos cotis de clientes»

**Branch:** `feat/identity-I-sheets-sync`
**Depends on:** Phase H merged.
**Estimated:** 2 days.

### Tasks

- [ ] Pre-step: manually create the tab `Base de datos cotis de clientes` in the `BMC_SHEET_ID` spreadsheet with the v1 column header row.
- [ ] `server/lib/clientQuotesSheetSync.js` — debounced 60s queue + idempotent upsert by `quote_id`.
- [ ] Trigger from `quote.status='completed'`.
- [ ] Admin endpoints: `POST /api/admin/sheets/clientes/reconcile`, `POST /api/admin/sheets/clientes/sync/:quote_id`.
- [ ] Env: `SHEETS_CLIENT_QUOTES_ENABLED`, `SHEETS_CLIENT_QUOTES_TAB`.
- [ ] Frontend: `src/components/admin/SheetsSyncPanel.jsx`.
- [ ] Doc: `docs/sheets-mapper-clientes.md` with column contract v1.

### Agent prompt (bmc-sheets-mapping)

```
Subagent: bmc-sheets-mapping. Branch feat/identity-I-sheets-sync. Read:
- docs/master-plans/user-identity-master-plan.md §Phase I
- server/routes/bmcDashboard.js (Sheets client init, batch update pattern, retry logic)
- server/lib/sheetColumnLetters.js
- server/lib/googleAuthCache.js
- docs/MAPPER-PRECISO-CRM-OPERATIVO.md (style reference for new mapper doc)

Task:
1. Pre-flight check: read SHEETS_CLIENT_QUOTES_TAB; if missing, return clear error with admin instructions (do NOT auto-create — humans confirm tab name first).
2. clientQuotesSheetSync.js exports:
   - syncQuote(quoteId) — idempotent upsert (column A is quote_id)
   - reconcile() — query identity.quotes where sheet_synced_at IS NULL AND status='completed', call syncQuote each
   - enqueue(quoteId) — debounced 60s aggregate flush
3. Wire enqueue() into the calc.js completion path from Phase F.
4. Admin endpoints behind requireUser({role:'admin'}).
5. Write rows audit row in identity.audit_log per sync run with batch_id.
6. Create docs/sheets-mapper-clientes.md following the style of docs/MAPPER-PRECISO-CRM-OPERATIVO.md.

Tests/sheets-sync.test.js: stub Sheets API, assert idempotency (same quote_id → 1 row, not 2).
```

### Acceptance gate

- [ ] Completing a quote → row appears in Sheets within 60s (`SHEETS_CLIENT_QUOTES_ENABLED=true`).
- [ ] Re-running reconcile is idempotent.
- [ ] Audit log records every sync batch.

---

## Phase J — CRM personal Plus + hardening + ship

**Branch:** `feat/identity-J-ship`
**Depends on:** Phase I merged.
**Estimated:** 2 days.

### Tasks

- [ ] CRM personal page + endpoints; greyed UI when `plan_tier='base'`.
- [ ] All four test files green (`identity-auth`, `identity-routes`, `quote-persistence`, `sheets-sync`).
- [ ] CI: `.github/workflows/ci.yml` runs new tests; env-drift accepts new keys.
- [ ] Deploy workflow + Cloud Build secrets wired.
- [ ] Rate-limit `/api/auth/*` and `/api/admin/sheets/*`; tighten CORS in prod.
- [ ] Update PROJECT-STATE.md, AGENTS.md, CLAUDE.md, REPO_CONTEXT.md.

### Agent prompts (parallel where possible)

```
Subagent A: bmc-deployment
Update .github/workflows/deploy-calc-api.yml + cloudbuild-api.yaml: wire env vars IDENTITY_JWT_SECRET, GOOGLE_OAUTH_CLIENT_ID, IDENTITY_COOKIE_DOMAIN, SHEETS_CLIENT_QUOTES_ENABLED, SHEETS_CLIENT_QUOTES_TAB. Use Secret Manager pattern existing for WA_JWT_SECRET. Run a dry deploy to staging.

Subagent B: bmc-docs-sync
Update docs/team/PROJECT-STATE.md, AGENTS.md, CLAUDE.md, REPO_CONTEXT.md to reflect the new identity subsystem. Add a section to AGENTS.md noting requireUser middleware and the deprecation of API_AUTH_TOKEN.

Subagent C: general-purpose
Build src/components/crm/PersonalCrmPage.jsx with greyed/active states keyed on plan_tier. Add tests/quote-persistence.test.js coverage if any gaps remain.
```

### Final ship checklist

- [ ] `npm run gate:local:full` green
- [ ] `npm run smoke:prod` green after Cloud Run deploy
- [ ] `GET /api/auth/me` on prod returns 401 unauthenticated
- [ ] Production GIS login from prod UI sets cookie on `*.calculadora-bmc.vercel.app`
- [ ] Quote completion writes to DB and Sheets
- [ ] PROJECT-STATE.md reflects "identity v1 shipped" entry dated.

---

## Cross-phase commands cheat sheet

```bash
# Branch off main cleanly
git checkout main && git pull && git checkout -b feat/identity-<phase>-<slug>

# Local DB sanity per phase
psql "$DATABASE_URL" -c "\dt identity.*"
psql "$DATABASE_URL" -c "select count(*) from identity.users;"
psql "$DATABASE_URL" -c "select count(*) from identity.quotes;"

# Local API smoke
npm run dev:full
curl -i http://localhost:3001/health

# Test tiers (fastest → slowest)
node --test tests/identity-auth.test.js   # unit
npm test                                  # validation suite
npm run gate:local                        # lint + test
npm run gate:local:full                   # lint + test + build

# Push + open PR
git push -u origin HEAD
# (PR auto-templated from runbook section above)

# After merge, clean up
git checkout main && git pull && git branch -d feat/identity-<phase>-<slug>
```

## Cross-phase rollback strategy

| Phase | Rollback | Side effects |
|---|---|---|
| A | `drop schema identity cascade;` | DB lost (none in use) |
| B | `git revert` | none |
| C | `git revert` | sessions in DB become stale (ignored) |
| D | `git revert` | none |
| E | `git revert` | none |
| F | `git revert` + `delete from identity.quotes;` | user-side history lost |
| G | `git revert` | none — both auth modes coexist |
| H | `git revert` | none |
| I | `git revert` + delete Sheets tab | Sheet rows lost; re-syncable via reconcile if rolled forward |
| J | `git revert` | none — docs/CI only |

---

## Final go/no-go gate (post-Phase J)

Run end-to-end before announcing the feature:

```bash
# 1. DB schema present
psql "$DATABASE_URL" -c "\dt identity.*" | wc -l   # ≥ 12

# 2. API health
curl -fsS https://panelin-calc-642127786762.us-central1.run.app/health
curl -fsS https://panelin-calc-642127786762.us-central1.run.app/api/auth/me
# expect 401 unauthenticated — proves route is mounted

# 3. Frontend live
curl -fsSI https://calculadora-bmc.vercel.app/ | head -1   # 200

# 4. Smoke
npm run smoke:prod

# 5. Manual UAT script (5 min)
#    - incognito → wizard step 1–5 → modal → Google login → step 6 → /mi-espacio shows quote
#    - admin login → ExportPanel → ZIP download
#    - admin SheetsSyncPanel → row appears in tab «Base de datos cotis de clientes»
#    - access request as comprador → notification visible to superadmin
```

If all gates green → mark `docs/team/PROJECT-STATE.md` with the ship date and announce.
