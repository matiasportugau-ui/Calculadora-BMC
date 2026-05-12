# Comprador identity — auth flow & deprecation

> Companion to the master plan. Phases A→I shipped on branch
> `claude/user-identity-master-plan-hYGmq` (PR #137).

## Why a new auth tier

`server/middleware/requireAuth.js` originally validated a single shared
`API_AUTH_TOKEN` — fine for operators/CI, useless for **end-user identity**.
The Comprador feature requires per-user sessions, RBAC by module, plan tier,
and quote ownership — all of which need a real user model.

We chose to **extend the existing WA Cockpit JWT pattern** rather than
introducing a parallel auth stack:

- `server/lib/waOperatorAuth.js` already implements Magic Link → Access JWT
  (15min) + Refresh (30d) with rotation-based reuse detection. We mirrored
  that file as `server/lib/identityAuth.js` adapted for end-users.
- Postgres connection (`pg.Pool` + Supabase migrations) was already wired
  for Transportista / WA — Comprador identity slots into a new `identity`
  schema beside `bmc_price_monitor` and `wa_*`.
- The pre-existing `POST /auth/google` endpoint (validated tokens against
  `oauth2/v3/userinfo` but issued no session) was extended to upsert
  `identity.users`, mint a JWT, and set the httpOnly `bmc_sess` cookie.

## Flow

```
┌────────────┐        idToken/accessToken       ┌─────────────────────┐
│  Browser   │ ───────────────────────────────► │  POST /auth/google  │
│  (GIS)     │                                  │ identityAuth.verify │
└────────────┘                                  │  + upsert + session │
       ▲                                        └─────────────────────┘
       │ Set-Cookie: bmc_sess=<refresh>;                │
       │ JSON: { user, accessToken, modules }            │
       │                                                ▼
       │                               ┌────────────────────────┐
       └────────── Bearer accessJwt ──►│  /api/me/* /admin/*    │
                                       │  requireUser middleware│
                                       └────────────────────────┘
```

**Refresh rotation**: `POST /auth/refresh` validates the cookie, looks up
`identity.sessions` by `sha256(refresh)`. If the matched session has
`revoked_at IS NOT NULL`, **reuse detection** triggers: every session for
that user is revoked AND `identity.users.jwt_revoked_at` is bumped (which
invalidates any access JWT issued before that timestamp).

**Logout**: revokes the current session (or all sessions if no `sid` claim
in the access JWT) and clears the cookie.

## Roles & module grants

Roles are stored in `identity.role_grants` (one user can have multiple).
Top role priority: `superadmin > admin > operator > comprador`.

Module access is the merge of:

1. **Role-derived defaults** (in code, `_roleDefaults` in identityAuth.js):
   - `superadmin` → admin on every module
   - `admin` → write everywhere, admin on `admin`
   - `operator` → write on calc/wa/ml; read on agent-admin/canales
   - `comprador` → write on `calc`
2. **Explicit overrides** in `identity.module_grants` (e.g. an admin grants
   `wa: read` to a specific comprador after they fill out an access request).

`requireUser({module, minLevel})` middleware enforces this server-side.
`<RequireGrant module=… />` enforces it client-side (route level).

`superadmin` short-circuits both checks.

## API_AUTH_TOKEN deprecation timeline

Phase G introduced `requireServiceOrUser` — every existing route that
imports `requireAuth` now ALSO accepts a valid identity JWT. Static-token
callers (CI/cron/legacy clients) keep working without changes.

| Phase | Status | Action |
|-------|--------|--------|
| Today | live   | Both auth modes coexist. UI starts moving to JWT. |
| +30d  | planned | All UI paths use JWT exclusively; tools use static token. |
| +60d  | planned | Internal scripts migrate to per-user service tokens. |
| +90d  | planned | Static `API_AUTH_TOKEN` becomes opt-out per route; alert on use. |
| TBD   | planned | Remove the static token branch from `requireServiceOrUser`. |

## DB schema

See `supabase/migrations/20260601000001_identity_init.sql` for the full
schema (13 tables + indexes + RLS + module seed). Top-level tables:

- `identity.users` — Comprador profile (Google sub, email, plan tier, status)
- `identity.sessions` — refresh-token-hashed rows (rotation source of truth)
- `identity.role_grants` — coarse role per user
- `identity.module_grants` — fine-grained per-module level overrides
- `identity.modules` — catalog
- `identity.access_requests` — module access tickets
- `identity.quotes` — per-user quote history (replaces in-memory registry)
- `identity.quote_events` — append-only audit per quote
- `identity.special_quote_requests` — total > USD 8500 follow-ups
- `identity.notifications` — in-app inbox
- `identity.crm_personal_contacts` / `_leads` — Plus tier
- `identity.audit_log` — security events

`supabase/migrations/20260601000002_identity_seed_superadmins.sql` seeds
superadmin role for an editable list of internal emails so the first
Google login of an admin lands with full access.

## Environment

| Var | Required? | Notes |
|-----|-----------|-------|
| `IDENTITY_JWT_SECRET` | yes (≥32 chars) | Falls back to `WA_JWT_SECRET` for staging convenience. |
| `IDENTITY_COOKIE_DOMAIN` | prod | `.calculadora-bmc.vercel.app` for Vercel previews + prod. |
| `IDENTITY_COOKIE_NAME` | optional | Default `bmc_sess`. |
| `GOOGLE_OAUTH_CLIENT_ID` | yes | Audience for `verifyIdToken`. |
| `INTERNAL_SUPERADMIN_EMAILS` | optional | Comma-separated. Seeded by migration 20260601000002. |
| `SHEETS_CLIENT_QUOTES_ENABLED` | optional | Default `false`. Set `true` to enable Phase I sync. |
| `SHEETS_CLIENT_QUOTES_TAB` | optional | Default `Base de datos cotis de clientes`. |

## End-to-end manual UAT

1. `curl -X POST $API/api/auth/google -H 'Content-Type: application/json' -d '{"idToken":"<google_id_token>"}'` →
   200 with `Set-Cookie: bmc_sess=...` and `accessToken`.
2. `curl $API/api/auth/me -H "Authorization: Bearer $ACCESS"` → 200, returns
   user payload.
3. In incognito browser, complete wizard steps 1–5 anonymously → "Siguiente"
   on step 5 opens the auth modal.
4. Login → wizard advances; `identity.quotes` row exists with that `user_id`.
5. As `comprador`, GET `/hub/wa` → 403 with "Solicitar acceso".
6. POST request → row in `identity.access_requests` + notifications for
   every superadmin user.
7. Complete a quote with `total_usd > 8500` → CTA "Solicitar presupuesto
   especial" appears in `/mi-espacio`.
8. As admin: `POST /api/admin/sheets/clientes/reconcile` → tab «Base de
   datos cotis de clientes» receives rows; `identity.quotes.sheet_synced_at`
   bumps.

## Next (out of scope of this PR)

- CRM personal Plus UI (Phase J — backend tables exist; UI page is a stub)
- Special-quote admin queue UI (backend endpoint exists; admin page TODO)
- Browser-tested PDF export (currently HTML-only in the ZIP bundle)
- Vercel preview cookie domain handling (single domain assumed for now)
