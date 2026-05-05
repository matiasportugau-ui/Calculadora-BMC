# GOLIVE — Comprador Identity master plan

> Branch `claude/user-identity-master-plan-hYGmq` is **code-complete**
> through Phase J. This document is the irreducible **human-in-the-loop**
> work needed to flip the feature to production.

---

## Status: code-complete, awaiting infra

| Phase | Code | Tests (offline) | Operational |
|-------|------|------------------|-------------|
| A — schema | ✅ | n/a | ⛔ migration not applied |
| B — identityAuth lib | ✅ | 11/11 | n/a |
| C — auth routes | ✅ | 8/8 | ⛔ env vars not set on Cloud Run |
| D — wizard gate | ✅ | lint+build green | ⛔ needs Vercel deploy |
| E — RBAC + access requests | ✅ | n/a | ⛔ needs DB |
| F — quotes + Mi espacio | ✅ | n/a | ⛔ needs DB |
| G — service principal | ✅ | 19/19 (no regression) | ⛔ needs DB for seed superadmin |
| H — export engine | ✅ | n/a | ⛔ needs DB |
| I — Sheets sync | ✅ | n/a | ⛔ tab not created, flag off by default |
| J — docs/CI | ✅ | env-drift ✅ | n/a |

Total commits on branch: 12. Total code added: ~3,500 lines.
Tests: 19 identity tests + validation suite (22) all green offline.

---

## Pre-deploy checklist (do NOT merge until all checked)

### 1. Apply migrations to Supabase

```bash
# Production project htnwozvopveibwppyjhg.
# Connect with the Supabase CLI or psql against DATABASE_URL.

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260601000001_identity_init.sql

# Verify
psql "$DATABASE_URL" -c "\dt identity.*"   # 13 rows
psql "$DATABASE_URL" -c "select count(*) from identity.modules;"  # 8

# Edit superadmin emails in the migration before applying:
# - Open supabase/migrations/20260601000002_identity_seed_superadmins.sql
# - Replace 'matias@bmc.uy' (line 19) with the actual internal admin emails.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260601000002_identity_seed_superadmins.sql
psql "$DATABASE_URL" -c \
  "select u.email, rg.role from identity.role_grants rg
     join identity.users u on u.user_id = rg.user_id
    where rg.role = 'superadmin';"
```

### 2. Generate and inject secrets

```bash
# Generate a 48-byte JWT secret
JWT_SECRET=$(openssl rand -base64 48)

# Inject into Cloud Run service `panelin-calc` (us-central1).
# Pattern follows the existing WA_JWT_SECRET wiring.
gcloud run services update panelin-calc \
  --region=us-central1 \
  --update-env-vars=\
"IDENTITY_JWT_SECRET=$JWT_SECRET,\
GOOGLE_OAUTH_CLIENT_ID=<your-google-oauth-client-id>.apps.googleusercontent.com,\
IDENTITY_COOKIE_DOMAIN=.calculadora-bmc.vercel.app,\
INTERNAL_SUPERADMIN_EMAILS=matias@bmc.uy"

# (Optional, off-by-default in v1)
gcloud run services update panelin-calc --region=us-central1 \
  --update-env-vars=\
"SHEETS_CLIENT_QUOTES_ENABLED=false,\
SHEETS_CLIENT_QUOTES_TAB=Base de datos cotis de clientes"

# Also persist secrets in `.github/workflows/deploy-calc-api.yml` under
# the Cloud Run env-vars step so subsequent CI deploys don't drop them.
```

### 3. Create Sheets tab «Base de datos cotis de clientes»

- Open the spreadsheet at `BMC_SHEET_ID`.
- Add a new tab named **exactly** `Base de datos cotis de clientes` (case- and accent-sensitive).
- Leave it empty — the lib creates the header row (A1:K1) on first call.
- Column contract: see [`docs/sheets-mapper-clientes.md`](../sheets-mapper-clientes.md).
- After creation, set `SHEETS_CLIENT_QUOTES_ENABLED=true` to flip on.

### 4. Verify Google OAuth client

- Console: `https://console.cloud.google.com/apis/credentials`
- The Web client ID must allow these origins:
  - `https://calculadora-bmc.vercel.app`
  - `http://localhost:5173`
  - `http://localhost:3001`
- Authorized redirect URIs: not required for the GIS implicit flow we use,
  but `https://calculadora-bmc.vercel.app` should be in the JS origins list.

### 5. Deploy

```bash
# Backend
git checkout claude/user-identity-master-plan-hYGmq
git pull
# Push triggers .github/workflows/deploy-calc-api.yml on main; for the
# feature branch use a manual deploy:
gcloud builds submit --config=cloudbuild-api.yaml

# Frontend (Vercel)
# Vercel auto-deploys preview from the PR branch. Confirm preview URL
# from the PR comment by vercel[bot].
```

### 6. UAT (manual, ~10 min)

Browser, incognito → preview URL.

- [ ] Land on `/`. Wizard step 1–5 anonymous → no modal yet.
- [ ] Click "Siguiente" on step 5 → modal opens.
- [ ] Click "Continuar con Google" → Google popup → redirect back. Modal closes; wizard advances to step 6.
- [ ] Open DevTools → Application → Cookies → `bmc_sess` httpOnly is set on `.calculadora-bmc.vercel.app`.
- [ ] Refresh page. Still authenticated; avatar visible top-right.
- [ ] Navigate `/mi-espacio` → see profile, empty inbox, empty quotes (or the just-created one if you completed the wizard).
- [ ] Navigate `/hub/wa` → 403 page with "Solicitar acceso" button.
- [ ] Click "Solicitar acceso" → confirm row in `identity.access_requests` and notification rows for every superadmin user (`select * from identity.notifications where kind='access_request' order by created_at desc limit 5`).
- [ ] As an internal superadmin (logout + login with that email), navigate `/hub/admin` → renders.
- [ ] As superadmin, `POST /api/admin/access-requests/:id` with `{decision:'granted', level:'read'}` → confirm row in `identity.module_grants`.
- [ ] Complete a quote with `total_usd > 8500` → CTA "Solicitar presupuesto especial" appears in `/mi-espacio` → submit → row in `identity.special_quote_requests`.
- [ ] (Optional, only if SHEETS_CLIENT_QUOTES_ENABLED=true) Wait 60s after quote completion → check Sheets tab «Base de datos cotis de clientes» → row appears.
- [ ] Click logout → cookie cleared, anonymous state.

### 7. Mark released

```bash
# Update PROJECT-STATE.md adding the GOLIVE date for this feature.
# Open PR #137 → mark "Ready for review" → request human approver → merge.
git checkout main
git pull origin main
```

---

## Rollback plan

If something breaks in production after merge:

1. **Frontend regression** (auth modal, header, Mi espacio): the modal is
   gated on `auth.status==='anonymous'` AND scenario+step — anonymous users
   who never log in are unaffected. To fully disable, revert `App.jsx` and
   the wizard guard on a hotfix branch.
2. **API regression**: the auth routes are NEW — disabling them does not
   break anything that was working. Add `if (false) { ... }` around the
   `app.use(...identityMeRouter)` lines in `server/index.js` and redeploy.
3. **Auth integration regression** (existing routes broken by
   `requireServiceOrUser`): static `API_AUTH_TOKEN` callers continue working
   identically — the new code path is additive. If you suspect drift, run
   `npm test && npm run gate:local` and inspect the test diffs.
4. **DB**: tables are new under a new `identity` schema. To remove:

   ```sql
   drop schema identity cascade;
   ```

---

## Out of scope (for follow-up PRs)

- CRM personal Plus UI (`crm_personal_*` tables exist; UI page is a stub).
- Special-quote admin queue UI page.
- Browser-tested PDF export (currently HTML in ZIP).
- Sheets sync **column** for `client_quote_id` (currently merged into payload JSON).
- Avatar editor in Mi espacio Preferencias tab.
- T&C / consent versioning (timestamps exist; document version not tracked).
