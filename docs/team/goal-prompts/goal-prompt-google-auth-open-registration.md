# Role
Full-stack engineer wiring an existing, production-grade Google OAuth auth system into
the live production environment of Calculadora BMC — a business quotation SaaS for BMC Uruguay.

---

# Context

The `identity.*` auth system (Google GIS → `/api/auth/google` → JWT + httpOnly refresh cookie →
`identity.users` PostgreSQL schema) is [CONFIRMED: fully implemented and committed to main]. The
system auto-upserts any Google user with the `comprador` role on first sign-in. The problem is
that the production environment is missing the required secrets, the identity migration status
is unknown, and `App.jsx` does not apply route guards. This task wires the already-built system
into production with zero new auth code.

Repo: `/Users/matias/calculadora-bmc` [CONFIRMED: main branch, git repo]
Frontend: `https://calculadora-bmc.vercel.app` [CONFIRMED: Vercel, project matprompts-projects/calculadora-bmc]
API: Cloud Run `panelin-calc`, `us-central1`, GCP project `chatbot-bmc-live` [CONFIRMED]
Supabase project ID: `htnwozvopveibwppyjhg` [CONFIRMED: from migration files]
Service URL: `https://panelin-calc-q74zutv7dq-uc.a.run.app` [CONFIRMED: from recent deploy]

---

# Goal

Enable any Google user to sign in at `calculadora-bmc.vercel.app`, be registered as a
`comprador`, and immediately use the calculator and Tareas module — without rebuilding any
auth code.

- Audit Phase 0: verify which secrets already exist in Cloud Run and whether the
  `identity.*` Supabase tables have been created; do NOT create/overwrite anything yet.
- Provision missing secrets in GCP Secret Manager and mount them on `panelin-calc` Cloud Run.
- Set `VITE_GOOGLE_CLIENT_ID` in Vercel production environment (triggers a rebuild).
- Apply `identity_init.sql` and `identity_mfa.sql` migrations to Supabase if not yet applied.
- Seed default module grants (`calc: write`, `tareas: read`) in `server/lib/identityAuth.js`
  `upsertUser()` so every new `comprador` can use the calculator and Tasks module immediately.
- Register `/hub/tareas` route with `<RequireGrant module="tareas" minLevel="read">` and
  apply `<RequireGrant>` guards to `/hub/wa`, `/hub/ml`, `/hub/admin`, `/hub/canales` in `src/App.jsx`.
- Verify end-to-end: real Google sign-in → comprador role → avatar in header → hub routes gated.

---

# Scope

IN:
- GCP Secret Manager: create IDENTITY_JWT_SECRET, GOOGLE_OAUTH_CLIENT_ID, MFA_KEK_HEX,
  IDENTITY_COOKIE_DOMAIN if missing; mount on Cloud Run via `--update-secrets`
- Vercel: set VITE_GOOGLE_CLIENT_ID production env var
- Supabase: apply identity migrations (check first, apply only if missing)
- `server/lib/identityAuth.js`: add default calc+tareas grant in user upsert
- `src/App.jsx`: add /hub/tareas route + RequireGrant on hub routes
- `docs/team/PROJECT-STATE.md`: record "open registration live"
- One commit: `feat(auth): open Google registration for all users`

OUT:
- Rebuilding or refactoring BmcAuthProvider, AuthGateModal, authGoogle.js, identityAuth.js
  (other than the one default-grant addition)
- MFA enrollment UI for compradores (MFA opt-in exists in /mi-espacio; don't add it to the
  sign-in flow)
- Quote claiming / anonymous-to-user merge UI
- Supabase JS SDK migration (@supabase/supabase-js) — system uses pg pool directly
- Gating the main calculator route `/` — it stays publicly accessible to anonymous users
- Touching /auth/ml/* or /auth/tasks/* routes
- Any change to the Google Tasks OAuth client (GOOGLE_TASKS_CLIENT_ID)

---

# Inputs

**Repo files (read before editing):**
- `server/lib/identityAuth.js` — find `upsertUser()` or `verifyGoogleAndUpsert()` to add default grants
- `src/App.jsx` — all hub route declarations; BmcAuthProvider wrapper
- `src/components/auth/RequireGrant.jsx` — understand props: `module`, `minLevel`, `role`
- `supabase/migrations/20260601000001_identity_init.sql` [CONFIRMED: exists]
- `supabase/migrations/20260601000004_identity_mfa.sql` [CONFIRMED: exists]
- `vercel.json` [CONFIRMED: /api/:path* → Cloud Run rewrite exists; no /auth/* rewrite needed]
- `.env.example` [CONFIRMED: has IDENTITY_JWT_SECRET, GOOGLE_OAUTH_CLIENT_ID, MFA_KEK_HEX,
  IDENTITY_COOKIE_DOMAIN, VITE_GOOGLE_CLIENT_ID variable names]

**GCP resources:**
- GCP project: `chatbot-bmc-live`
- Cloud Run service: `panelin-calc`, region `us-central1`
- Cloud Run SA: [ASSUMPTION: default Compute Engine SA — verify with `gcloud iam service-accounts list`]

**OAuth client IDs (TWO different clients — do not confuse):**
- Web app login client: `642127786762-6rkar09l6902jog9dvnal6e6m3a44p76.apps.googleusercontent.com`
  [INFERRED: from .env.example pre-filled VITE_GOOGLE_CLIENT_ID | basis: agent exploration]
  → This is GOOGLE_OAUTH_CLIENT_ID and VITE_GOOGLE_CLIENT_ID
- Google Tasks sync client: `642127786762-p7siclqkr1c7spm24423t4313tqvv8ul.apps.googleusercontent.com`
  [CONFIRMED: created in last session as GOOGLE_TASKS_CLIENT_ID]
  → DO NOT use this for user login

**Supabase:**
- Project ref: `htnwozvopveibwppyjhg`
- Supabase MCP is connected [CONFIRMED: available in this session]

**Vercel:**
- Project: `matprompts-projects/calculadora-bmc` [CONFIRMED: from memory]
- Vercel CLI: `vercel` [CONFIRMED: installed, version 51.2.1]

---

# Tools & MCPs

- **Bash (gcloud CLI)**: secret existence check, create secrets, IAM bindings, Cloud Run update
- **Bash (vercel CLI)**: `vercel env add VITE_GOOGLE_CLIENT_ID production` + `vercel redeploy`
- **Supabase MCP** (`list_tables`, `apply_migration`): verify identity schema exists; apply if not
- **Read / Edit tools**: `identityAuth.js`, `App.jsx`, `PROJECT-STATE.md`
- **Bash (`npm run gate:local`)**: lint + unit tests before committing
- Tools NOT needed: WebSearch, Shopify MCP, BigQuery MCP, Gmail MCP, Supermetrics MCP

---

# Constraints & Guardrails

- DO use `printf '%s'` not `echo -n` for all secret values piped to gcloud — trailing newline
  from `echo` breaks strict `===` comparisons in production JWT verification.
- DO check secret existence before creating: `gcloud secrets describe SECRET_NAME --project chatbot-bmc-live`
  returns non-zero if missing. Use `gcloud secrets versions add` for an existing secret.
- DO set `IDENTITY_COOKIE_DOMAIN` to an **empty string** — Vercel proxies `/api/*` to Cloud Run
  so the browser sees the cookie as same-origin with `calculadora-bmc.vercel.app`. Setting it to
  `panelin-calc-*.run.app` would break the refresh flow entirely.
- DO verify the web-app OAuth client (`6rkar09l6...`) has `https://calculadora-bmc.vercel.app`
  in its Authorized JavaScript Origins in GCP Console before declaring success. If missing, add it.
  [ASSUMPTION: may not be configured — check GCP Console → APIs & Services → Credentials]
- DO run `npm run gate:local` and confirm zero errors before committing.
- DO NOT touch the main calculator route `/` or `/calculadora` — they stay fully public.
- DO NOT add a `/auth/*` rewrite to `vercel.json` — auth endpoints live under `/api/auth/*`
  which is already proxied by the existing `/api/:path*` rule.
- DO NOT use `npm audit fix --force` — has broken Vite in this repo before (CLAUDE.md caveat).
- DO NOT skip `npm run gate:local` to save time.

---

# Anti-patterns

- DO NOT create a new auth system, add Passport.js, express-session, NextAuth, or @supabase/supabase-js
  for auth — the existing custom JWT system is production-grade and must not be replaced.
- DO NOT confuse the two OAuth client IDs. The Tasks client (`p7siclqkr1...`) was created for
  Google Tasks sync (a separate OAuth scope). The web app client (`6rkar09l6...`) is for user login.
  Using the wrong one will cause `google-auth-library` `verifyIdToken()` to fail with audience mismatch.
- DO NOT treat `panelin-api-642127786762` as a live service — it is a zombie; all routes go through `panelin-calc`.
- DO NOT store OAuth state in-memory across requests (Cloud Run scales to 0; state must be DB-backed or
  in the token itself — the existing PKCE implementation already does this correctly).
- DO NOT overwrite an existing GCP secret with `gcloud secrets create` — it will error. Always check first.
- DO NOT mount secrets as files (volume mounts) — the existing code reads them as environment variables
  via `process.env.*`. Use `--update-secrets=KEY=SECRET_NAME:latest` (env var form), not `--set-volumes`.

---

# Deliverables

1. **Cloud Run secrets mounted** — IDENTITY_JWT_SECRET, GOOGLE_OAUTH_CLIENT_ID, MFA_KEK_HEX,
   IDENTITY_COOKIE_DOMAIN present as env vars on `panelin-calc` latest revision
2. **Vercel env var set** — VITE_GOOGLE_CLIENT_ID visible in `vercel env ls` for production;
   Vercel redeployment triggered
3. **Identity migration applied** — `identity.users`, `identity.sessions`, `identity.role_grants`,
   `identity.module_grants`, `identity.modules`, `identity.audit_log` tables exist in Supabase
   project `htnwozvopveibwppyjhg`
4. **`server/lib/identityAuth.js`** — `upsertUser()` inserts `calc: write` and `tareas: read`
   grants into `identity.module_grants` for every new user (ON CONFLICT DO NOTHING)
5. **`src/App.jsx`** — `/hub/tareas` route registered with `<RequireGrant module="tareas" minLevel="read">`;
   `/hub/wa`, `/hub/ml`, `/hub/admin`, `/hub/canales` wrapped with appropriate `<RequireGrant>` guards
6. **`docs/team/PROJECT-STATE.md`** — "open Google registration live" entry under Cambios recientes
7. **Commit** — `feat(auth): open Google registration for all users` (all changes atomic, gate:local passes)

---

# Success Criteria

- `curl -s -X POST https://calculadora-bmc.vercel.app/api/auth/google -H "Content-Type: application/json" -d '{"idToken":"bad"}' | jq .error`
  → returns `"invalid_token"` or similar (not a 500, not a JWT signing error)
- `curl -s https://calculadora-bmc.vercel.app/api/auth/me -H "Authorization: Bearer invalid"` → 401 (not 500)
- Manual E2E: open `https://calculadora-bmc.vercel.app`, click "Iniciar sesión" → Google consent screen
  → redirect back → avatar visible in top-right header
- `GET /api/auth/me` with the returned token → `{ role: "comprador", plan_tier: "base", ... }`
- `GET /api/auth/me/grants` → `modules` object contains `{ "calc": "write", "tareas": "read" }`
- Navigate to `https://calculadora-bmc.vercel.app/hub/wa` without logging in → RequireGrant renders
  403 UI (not a blank page or redirect)
- Navigate to `https://calculadora-bmc.vercel.app/hub/tareas` with comprador session → TasksModule
  renders (empty state / connect-Google-Tasks CTA is acceptable)
- `npm run gate:local` exits 0

---

# Operational Anchors

- Source hierarchy: repo code (identityAuth.js, authGoogle.js) > migration SQL > docs.
  Never trust a single source — always read the code before editing.
- State labeling (use in all claims): `hecho confirmado` | `inferencia` | `duda abierta`.
- Read-only by default: parámetros, logs, automation tabs, master prices, fiscal data.
  Require explicit permission to modify.
- If two sources conflict (e.g., .env.example value vs. actual GCP secret): read the live GCP secret
  value via `gcloud secrets versions access latest`, trust that over docs.
- Migration idempotency: check table existence before applying. Do not apply a migration twice.
- Secrets idempotency: check secret existence (`gcloud secrets describe`) before creating.

---

# Open Items

- [ASSUMPTION: identity.* Supabase migration NOT yet applied | Migration files are dated 20260601
  (future date); verify with Supabase MCP `list_tables schema=identity` before assuming either way]
- [ASSUMPTION: Web-app OAuth client authorized origins may not include https://calculadora-bmc.vercel.app
  | Check GCP Console → APIs & Services → Credentials → client 6rkar09l6... → Authorized JavaScript origins]
- [ASSUMPTION: IDENTITY_JWT_SECRET does not yet exist as a GCP Secret | Phase 0 audit must confirm
  before attempting creation — use `gcloud secrets describe IDENTITY_JWT_SECRET --project chatbot-bmc-live`]
- [ASSUMPTION: Cloud Run SA is the default Compute Engine SA matching pattern *@developer.gserviceaccount.com
  | Verify with `gcloud iam service-accounts list --project chatbot-bmc-live`]
