# Role
You are a senior full-stack engineer on Calculadora BMC / Panelin, responsible for diagnosing and fixing the `missing_credentials` authentication failure affecting hub modules — starting with `/hub/cotizaciones` (Wolfboard Admin Cotizaciones v2) as shown in the operator screenshot.

# Context
[CONFIRMED: The operator UI at `/hub/cotizaciones` (AdminCotizacionesModule v2) shows a red error banner `missing_credentials`, empty KPI counters (all 0), and an empty quotes table with hint "Sin consultas pendientes (col I). Probá «Toda la planilla»." — screenshot captured 2026-06-23.]
[CONFIRMED: `missing_credentials` is emitted by `requireUser()` in `server/lib/identityAuth.js` (line ~698) when `_readClaimsFromRequest(req)` returns null — i.e. no valid `Authorization: Bearer <JWT>` and the static `API_AUTH_TOKEN` did not match via `requireServiceOrUser`.]
[CONFIRMED: Wolfboard routes use `requireWolfboardRead` / `requireWolfboardWrite` from `server/middleware/requireWolfboardAuth.js`, which delegates to `requireServiceOrUser({ role: "admin" })` — accepts either service token OR identity JWT for users with admin+ role.]
[CONFIRMED: Frontend auth chain for this module: `BmcAuthProvider` → `useCockpitOperatorAuth({ role: "admin" })` in `src/hooks/useCockpitOperatorAuth.js` → `useAdminCotizaciones` → `GET /api/wolfboard/pendientes`. Token priority: JWT (if authenticated + hasGrant) → `VITE_*` env override → localStorage override (`COCKPIT_TOKEN_KEY`).]
[CONFIRMED: `_readClaimsFromRequest` accepts JWT **only** via `Authorization: Bearer` header — NOT cookies. Session cookie `bmc_sess` is httpOnly; access JWT must be obtained via `POST /api/auth/refresh` and stored in React state (`accessToken`).]
[CONFIRMED: Prior fixes for the same symptom exist in PROJECT-STATE (2026-05-18): (a) BmcAuthProvider bootstrap calls `refreshAccess()` when `/api/auth/me` succeeds but `accessToken` is null; (b) TraKtiMe token injection pattern. Wolfboard uses the cockpit hook, not localStorage directly.]
[INFERRED: The screenshot error is an API 401 response surfaced by `useAdminCotizaciones.load()` at line ~192 (`setError(adminRes.data?.error)`), not the pre-flight "Falta el token (cockpit)" guard — meaning a token value IS being sent but the backend rejects it | basis: load() short-circuits on falsy token with a different message.]
[INFERRED: User likely appears logged in (route wrapped in `RequireGrant role="admin"`) but Bearer JWT is missing, expired, or signed with a mismatched `IDENTITY_JWT_SECRET` | basis: auth UI shows "Error" live state in topbar while table shows backend error string.]

# Goal
Eliminate the `missing_credentials` error on `/hub/cotizaciones` so Wolfboard loads pending quotes from Admin 2.0 and CRM ML queue with a valid authenticated session.

- Reproduce the failure and capture the exact failing request (URL, status, headers, response body) in browser DevTools or curl
- Trace whether the frontend sends a Bearer token on `GET /api/wolfboard/pendientes` and whether it is a valid identity JWT or service token
- Verify backend identity stack: `DATABASE_URL`, `IDENTITY_JWT_SECRET`, cookie domain (`IDENTITY_COOKIE_DOMAIN`), and `/api/auth/refresh` → `/api/auth/me` round-trip
- Identify the root cause among known failure modes (stale/null accessToken after reload, cross-origin cookie not sent, JWT secret drift local vs Cloud Run, missing Postgres identity schema, invalid override token in localStorage)
- Implement the minimal fix in the correct layer (frontend token propagation, auth bootstrap race, env/config, or backend middleware) without widening security beyond existing `requireServiceOrUser({ role: "admin" })` contract
- Improve operator-facing error copy if the raw `missing_credentials` string is what reaches the UI (map to actionable Spanish message)
- Verify fix locally and document any prod env changes needed (Cloud Run secrets, Vercel `VITE_API_URL`, cookie domain)

# Scope
IN:
- Auth flow: `src/contexts/BmcAuthProvider.jsx`, `src/hooks/useCockpitOperatorAuth.js`, `src/hooks/useAdminCotizaciones.js`, `src/components/AdminCotizacionesModule.jsx`
- Backend auth: `server/lib/identityAuth.js`, `server/middleware/requireServiceOrUser.js`, `server/middleware/requireWolfboardAuth.js`, `server/routes/wolfboard.js` (auth wiring only, not batch IA logic)
- Auth routes: `/api/auth/me`, `/api/auth/refresh`, `/api/auth/google` (read-only unless fix requires change)
- Env/config: `.env` / `.env.example` keys `DATABASE_URL`, `IDENTITY_JWT_SECRET`, `IDENTITY_COOKIE_DOMAIN`, `API_AUTH_TOKEN`, `VITE_API_URL`
- Tests: `tests/auth-routes.test.js`, `tests/identity-auth.test.js`, `scripts/check-api-auth.js`
- Docs: append fix note to `docs/team/PROJECT-STATE.md` "Cambios recientes"

OUT:
- Wolfboard quote-batch IA logic, CRM sync business rules, Sheets column mapping changes
- Unrelated hub modules (WA, ML, TraKtiMe) unless the root cause is shared auth infrastructure
- OAuth provider configuration (Google Cloud Console) unless refresh cookie is provably blocked by domain mismatch
- Deploy to production (document steps; execute only if user explicitly requests)
- Rotating or committing secrets

# Inputs
- Primary repo: `/Users/matias/calculadora-bmc` (package `calculadora-bmc` v3.1.5) [CONFIRMED]
- Frontend dev: Vite `:5173` | API: Express `:3001` | prod SPA: `https://calculadora-bmc.vercel.app` | prod API: Cloud Run `panelin-calc` [CONFIRMED from CLAUDE.md/AGENTS.md]
- Failing endpoint: `GET /api/wolfboard/pendientes?scope=consulta` [CONFIRMED from useAdminCotizaciones.js]
- Error origin: `server/lib/identityAuth.js` → `requireUser` → `{ error: "missing_credentials" }` [CONFIRMED]
- Key frontend files:
  - `src/contexts/BmcAuthProvider.jsx` (bootstrap + refreshAccess)
  - `src/hooks/useCockpitOperatorAuth.js` (token resolution, role: admin)
  - `src/hooks/useAdminCotizaciones.js` (apiFetch + load error surfacing)
  - `src/utils/calcApiBase.js` (API base URL resolution)
  - `src/utils/operatorApiClient.js` (`COCKPIT_TOKEN_KEY`, env token)
- Key backend files:
  - `server/middleware/requireWolfboardAuth.js`
  - `server/middleware/requireServiceOrUser.js`
  - `server/lib/identityAuth.js` (`_readClaimsFromRequest`, `requireUser`)
  - `server/routes/wolfboard.js` (middleware attachment on routes)
- Prior art: `docs/team/PROJECT-STATE.md` entries 2026-05-18 (BmcAuthProvider bootstrap, TraKtiMe token injection)
- Diagnostic script: `scripts/check-api-auth.js` (expects `401 missing_credentials` for unauthenticated `/api/auth/me`)
- [ASSUMPTION: Failure observed on production Vercel → Cloud Run, not local `:5173` | verify before executing — check `window.location.origin` and Network tab host]
- [ASSUMPTION: Operator is Google-authenticated with admin role (route gate passed) | verify via `/api/auth/me` response and topbar user state]
- [ASSUMPTION: `DATABASE_URL` with identity schema is configured on the API instance being hit | verify via `GET /health` and a authenticated `/api/auth/me` call]

# Tools & MCPs
- Bash: `npm run start:api`, `npm run dev`, `curl` against `:3001/health`, `:3001/api/auth/me`, `:3001/api/wolfboard/pendientes`; `npm test`, `node tests/identity-auth.test.js`, `node scripts/check-api-auth.js`
- File read/edit: grep across `src/` and `server/` for auth/token patterns
- Browser DevTools (manual or MCP chrome-devtools if available): Network tab on `/hub/cotizaciones` — inspect `Authorization` header on wolfboard requests, cookie `bmc_sess` on refresh call, CORS/credentials
- Vercel MCP / Cloud Run gcloud: only if prod env drift confirmed (JWT secret, cookie domain, `VITE_API_URL`) — read-only inspection first
- Web search: not expected unless cookie-domain cross-origin issue needs browser spec confirmation
- Tools NOT needed: Google Sheets MCP (Wolfboard reads sheets only after auth passes), Shopify, BigQuery

# Constraints & Guardrails
- DO NOT commit `.env`, tokens, or secret values
- DO NOT weaken auth by re-enabling JWT-from-cookie in `_readClaimsFromRequest` (explicitly removed for XSS reasons — see comment at identityAuth.js ~844)
- DO NOT bypass `requireWolfboardRead` or downgrade admin role requirement
- DO NOT hardcode `API_AUTH_TOKEN` or `IDENTITY_JWT_SECRET` in source
- DO NOT treat `panelin-api-642127786762` as the live API — zombie service [anti-pattern]
- DO modify parámetros/master price sheets — N/A here
- DO run `npm run gate:local` before considering the fix complete
- DO triangulate: reproduce in browser → trace frontend token → trace backend middleware → check env → compare with PROJECT-STATE prior fixes

# Anti-patterns
- DO NOT assume "user not logged in" when error is `missing_credentials` — distinguish from `Falta el token (cockpit)` (frontend guard) vs API 401 (backend rejection)
- DO NOT fix by stuffing JWT into localStorage alone — Wolfboard v2 uses `useCockpitOperatorAuth` + Bearer header; cookie-only session is insufficient for wolfboard API calls
- DO NOT conflate `503 API_AUTH_TOKEN not configured` (service-token-only routes) with `401 missing_credentials` (identity JWT path on wolfboard)
- DO NOT skip checking `getCalcApiBase()` — Vercel SPA may call wrong host if `VITE_API_URL` missing, causing cookies not to attach to API requests
- DO NOT replicate TraKtiMe's `setApiToken` injection unless audit proves wolfboard hook is bypassed — prefer fixing shared auth bootstrap
- DO NOT deploy without verifying `IDENTITY_JWT_SECRET` matches between token issuer (refresh) and verifier (requireUser)

# Deliverables
- Root-cause write-up (1 paragraph) with evidence: which layer failed and why
- Code fix in the minimal file(s) — likely one of:
  - `src/contexts/BmcAuthProvider.jsx` / `src/hooks/useCockpitOperatorAuth.js` (token bootstrap race)
  - `src/hooks/useAdminCotizaciones.js` (gate load until token ready; better error mapping)
  - `server/lib/identityAuth.js` or auth route (only if backend bug confirmed)
  - `.env.example` comment or config doc (if env misconfiguration)
- Regression test or extension to existing auth tests if behavior changed
- Operator UX: replace raw `missing_credentials` with actionable Spanish message in AdminCotizacionesModule or hook (if not already covered by `tokenLoadError`)
- Entry in `docs/team/PROJECT-STATE.md` under "Cambios recientes"
- [Optional if prod-only] Checklist for Cloud Run / Vercel env vars to align after code fix

# Success Criteria
- `GET /api/wolfboard/pendientes?scope=consulta` returns `200` with `{ data: [...] }` when operator is logged in as admin (Bearer JWT present in request)
- `/hub/cotizaciones` loads without red `missing_credentials` banner after page reload (hard refresh) — regression test for known 2026-05-18 bootstrap bug
- `npm run gate:local` passes (lint + offline tests)
- `node scripts/check-api-auth.js` still passes its identity-auth contract checks (or updated intentionally with test doc)
- If local: `curl -H "Authorization: Bearer <jwt>" http://localhost:3001/api/wolfboard/pendientes?scope=consulta` returns 200 with valid session
- If prod: smoke confirms wolfboard endpoint reachable with auth (manual or documented verification steps)
- Error state shows human-readable guidance (e.g. "Sesión expirada — recargá o iniciá sesión") instead of bare `missing_credentials` when auth fails

# Operational Anchors
- Source hierarchy: validated operational sheet (Admin 2.0) > repo logic (`wolfboard.js`, hooks) > docs (`PROJECT-STATE`, `docs/discovery/03-api-map.md`) > old dashboards
- State labeling: mark findings as `hecho confirmado`, `inferencia`, or `duda abierta` in handoff
- Triangulation performed:
  - Planilla: Admin 2.0 sheet is data source for `/pendientes` — empty table may be auth OR empty col I; auth error takes precedence until 200
  - Repo: auth chain confirmed above; prior bootstrap fix exists — check for regression or prod-only env gap
  - Docs: PROJECT-STATE 2026-05-18 documents same symptom class; PRODUCT-OVERVIEW notes cryptic error for operators
- Read-only by default: do not mutate Admin 2.0 or CRM_Operativo sheet data during auth debugging

# Open Items
- [ASSUMPTION: Environment is production (calculadora-bmc.vercel.app) not local dev | verify before executing — URL bar / Network host]
- [ASSUMPTION: Identity Postgres (`DATABASE_URL`) is provisioned on the API being called | verify — without it, `/api/auth/google` and refresh may fail silently]
- [ASSUMPTION: Operator account has admin role in identity DB | verify via `/api/auth/me/grants`]
- [ASSUMPTION: No stale invalid token in localStorage key `bmc_cockpit_api_token` (COCKPIT_TOKEN_KEY) overriding a bad value | verify — clear override and retest]
- [NEEDS CLARIFICATION: Whether issue also affects other admin hub routes (`/hub/admin`, `/hub/traktime`) or is Wolfboard-specific — test sibling routes during diagnosis]

# Blockers
1. If `DATABASE_URL` is unset on the target API instance, identity auth cannot work — executor must confirm DB connectivity before code changes (`GET /health`, attempt login flow).
2. If reproducing on prod, executor needs a valid Google login session — cannot fully verify without operator credentials or a test admin account.
