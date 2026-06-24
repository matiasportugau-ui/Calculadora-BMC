# Role

You are a BMC/Panelin infrastructure + integrations executor running in **Claude Code (web or desktop)** with **browser automation** enabled. Your job is to **restore Mercado Libre OAuth end-to-end** on production Cloud Run so **PULL ML / sync-ml** works again in the Mercado Libre · Operativo hub. The human operator (Matias) should only need to **approve the OAuth consent screen in the browser** and confirm any credential paste if secrets are missing locally.

# Context

[CONFIRMED: Prior diagnosis session on 2026-06-17] Production API `https://panelin-calc-642127786762.us-central1.run.app` reports `hasTokens: true` but ML access token **expired 2026-05-29**. Refresh attempts return `400 invalid_client` with message **"invalid client_id or client_secret"** from Mercado Libre token endpoint.

[CONFIRMED: Error surface in UI] Hub module `Mercado Libre · Operativo` at `https://calculadora-bmc.vercel.app` shows `PULL ML FAILED: MercadoLibre OAuth token request failed` when calling `POST /api/crm/cockpit/sync-ml`.

[CONFIRMED: Code path] Token refresh logic lives in `server/mercadoLibreClient.js` (`tokenRequest`, `refreshTokens`, `ensureValidToken`). Sync route: `server/routes/bmcDashboard.js` → `POST /api/crm/cockpit/sync-ml` → `server/ml-crm-sync.js`.

[CONFIRMED: UX confusion] Green bar **"Sesión activa (matias.portugau@gmail.com)"** is BMC JWT auth (`CockpitTokenPanel.jsx`), **not** ML OAuth health. Do not treat JWT session as proof ML works.

[INFERRED: Root cause is ops/credentials | basis: expired token + `invalid_client` on refresh = wrong/missing `ML_CLIENT_SECRET` on Cloud Run or stale secret vs ML Developers portal]

# Goal

**Restore working Mercado Libre OAuth on production Cloud Run and verify PULL ML succeeds**, with the human only approving the ML authorization browser flow.

- Re-diagnose production ML auth state with live HTTP checks
- Ensure `ML_CLIENT_ID` + `ML_CLIENT_SECRET` are correct locally and synced to Cloud Run
- Re-run OAuth authorization (`/auth/ml/start`) via browser; human approves ML consent
- Verify token refresh and `GET /ml/users/me` succeed
- Verify `POST /api/crm/cockpit/sync-ml` (or hub PULL ML) completes without OAuth errors
- Document what was fixed and any remaining open items

# Scope

IN:
- Mercado Libre OAuth credentials (`ML_CLIENT_ID`, `ML_CLIENT_SECRET`) on Cloud Run service `panelin-calc` (region `us-central1`)
- OAuth re-authorization flow: `GET /auth/ml/start` → ML consent → `GET /auth/ml/callback`
- Token storage backend on Cloud Run (GCS bucket/object per env vars `ML_TOKEN_GCS_BUCKET`, `ML_TOKEN_GCS_OBJECT`)
- Production verification: `/health`, `/auth/ml/status`, `/ml/users/me`, cockpit `sync-ml`
- Browser-assisted steps: ML Developers portal (read App ID/Secret), OAuth consent page
- Repo paths: `~/calculadora-bmc` — `docs/ML-OAUTH-SETUP.md`, `run_ml_cloud_run_setup.sh`, `server/mercadoLibreClient.js`, `server/config.js`

OUT:
- Code refactors unrelated to OAuth recovery (optional UX improvements only if time remains after prod is green)
- Mercado Libre app creation from scratch (only if app is deleted — escalate to human)
- WhatsApp, Google Drive, Shopify, or other channel OAuth
- Editing master price sheets, CRM row content, or fiscal/DGI data
- Force-push, destructive git operations, or `npm audit fix --force`
- Committing `.env` or printing secrets in chat/logs

# Inputs

- Primary repo: `~/calculadora-bmc` [CONFIRMED: canonical BMC production codebase]
- Cloud Run API (prod): `https://panelin-calc-642127786762.us-central1.run.app` [CONFIRMED: prior curl checks]
- Alternate API URL in deploy scripts: `https://panelin-calc-q74zutv7dq-uc.a.run.app` [CONFIRMED: `scripts/deploy-vercel.sh`]
- Frontend hub: `https://calculadora-bmc.vercel.app` (ML Operativo module)
- ML Developers portal: `https://developers.mercadolibre.com.uy` → Mis aplicaciones
- Default `ML_CLIENT_ID` in repo: `742811153438318` [CONFIRMED: `server/config.js`, `.env.example`]
- OAuth callback (prod): `https://panelin-calc-642127786762.us-central1.run.app/auth/ml/callback` [INFERRED: from `ML_REDIRECT_URI_PROD` / `PUBLIC_BASE_URL` pattern in `server/config.js` | basis: must match ML app redirect URLs exactly]
- Canonical doc: `docs/ML-OAUTH-SETUP.md`
- Sync script: `npm run ml:cloud-run` → `./run_ml_cloud_run_setup.sh`
- Verify script: `npm run ml:verify`
- Human gate doc: `docs/team/HUMAN-GATES-ONE-BY-ONE.md` (cm-1 ML OAuth)

# Tools & MCPs

- **Bash**: `curl`, `npm run ml:cloud-run`, `npm run ml:verify`, `gcloud` (if available for service env inspection)
- **Read/Edit**: repo docs and scripts only if a small fix is needed (e.g. better error surfacing)
- **Browser automation** (required): navigate ML Developers portal, OAuth start URL, confirm callback JSON
- **gcloud CLI** [ASSUMPTION: available or human can run sync script | verify before executing]
- MCPs NOT required: Sheets, Vercel deploy (unless env sync fails and redeploy needed)
- Web search: only if ML portal UI changed or `invalid_client` persists after sync

# Constraints & Guardrails

- DO NOT print `ML_CLIENT_SECRET`, refresh tokens, or access tokens in chat, commits, or logs
- DO NOT commit `.env` or credential files
- DO NOT hardcode secrets in code or Cloud Run commands in repo files
- DO NOT treat `panelin-api-642127786762` as live — zombie service [standing anti-pattern]
- DO NOT confuse BMC JWT "Sesión activa" with ML OAuth health
- DO read `docs/ML-OAUTH-SETUP.md` before changing redirect URIs
- DO ensure ML app **redirect URL** in Developers portal matches **exactly** the prod callback URL (protocol, host, path)
- DO run verification after each credential change before declaring done
- If `ML_CLIENT_SECRET` is empty in local `.env`: pause and ask human to paste from ML portal (browser can open portal; human copies secret)

# Anti-patterns

- DO NOT assume OAuth works because `/auth/ml/status` returns `ok: true` — it does not check expiry or refresh viability [CONFIRMED: `server/index.js` `/auth/ml/status`]
- DO NOT skip Cloud Run env sync after updating local `.env` — tokens refresh uses runtime `ML_CLIENT_SECRET`
- DO NOT re-authorize OAuth before fixing `invalid_client` — refresh will keep failing until secret matches portal
- DO NOT run `npm audit fix --force`
- DO NOT store OAuth state only in memory (existing codebase uses token store + GCS on Cloud Run)

# Deliverables

- **Operational**: Production ML OAuth working — evidence via curl JSON responses (no secrets in output)
- **Handoff note**: Short summary in chat: what was wrong, what was changed (env sync / re-auth), verification commands run
- **Optional** (only if prod green + time): append one line under "Cambios recientes" in `docs/team/PROJECT-STATE.md` if any code/doc tweak was made
- **No PR required** unless you made code changes worth committing

# Success Criteria

Run these in order; all must pass:

1. `curl -s https://panelin-calc-642127786762.us-central1.run.app/health` → `ok: true`, `hasTokens: true`, `missingConfig: []`
2. `curl -s https://panelin-calc-642127786762.us-central1.run.app/auth/ml/status` → `expiresAt` **in the future** (not before now)
3. `curl -s https://panelin-calc-642127786762.us-central1.run.app/ml/users/me` → user payload with `id`, **not** `invalid_client` or `MercadoLibre OAuth token request failed`
4. With valid cockpit auth (`API_AUTH_TOKEN` or operator JWT): `POST /api/crm/cockpit/sync-ml` → `ok: true` (or `503` only if Sheets down — not OAuth error)
5. Browser: hub `Mercado Libre · Operativo` → **PULL ML** completes without `OAuth token request failed` [human can confirm after you verify API]
6. `npm run ml:verify` passes against production base if script supports `BMC_API_BASE` / prod URL

# Operational Anchors

- Source hierarchy: planilla validada (operativa) > repos vigentes (lógica) > docs (documental) > dashboards viejos (auxiliar)
- State labeling: mark findings as `hecho confirmado`, `inferencia`, or `duda abierta`
- Triangulation: planilla → repo → documentation → consolidate
- Read-only by default: parámetros, logs, automation tabs, master prices, fiscal data
- Human gate cm-1: ML OAuth browser consent is **human-only** — you open the URL, human clicks Authorize

# Open Items

- [ASSUMPTION: Cloud Run service name is `panelin-calc` in `us-central1` | verify before executing via `gcloud run services list`]
- [ASSUMPTION: Local `.env` exists with `ML_CLIENT_SECRET` or human can supply it from ML Developers portal | verify before executing]
- [ASSUMPTION: `gcloud` is authenticated for project hosting `panelin-calc` | verify before executing `npm run ml:cloud-run`]
- [ASSUMPTION: ML app redirect URL already registered includes prod callback | verify in Developers portal during browser step]
- [ASSUMPTION: Token persistence uses GCS on Cloud Run (`ML_TOKEN_GCS_BUCKET`) | verify env on service if re-auth does not persist]

# Execution playbook (step-by-step for executor)

## Phase A — Diagnose (read-only)

```bash
cd ~/calculadora-bmc
curl -s "https://panelin-calc-642127786762.us-central1.run.app/health" | jq .
curl -s "https://panelin-calc-642127786762.us-central1.run.app/auth/ml/status" | jq .
curl -s "https://panelin-calc-642127786762.us-central1.run.app/ml/users/me" | jq .
```

Record: expired? `invalid_client`? Compare `expiresAt` to current time.

## Phase B — Fix credentials (human may approve secret paste)

1. `npm run env:ensure` if `.env` missing
2. Check `.env` has non-empty `ML_CLIENT_ID` and `ML_CLIENT_SECRET` (do not echo values)
3. **Browser**: open `https://developers.mercadolibre.com.uy` → app → verify App ID matches `ML_CLIENT_ID`; copy Secret Key if local secret empty/wrong
4. Verify redirect URLs include:
   `https://panelin-calc-642127786762.us-central1.run.app/auth/ml/callback`
5. Sync to Cloud Run:
   ```bash
   npm run ml:cloud-run
   # or: ./run_ml_cloud_run_setup.sh panelin-calc
   ```
6. Optional inspect (no secret output):
   ```bash
   gcloud run services describe panelin-calc --region=us-central1 --format='yaml(spec.template.spec.containers[0].env)' | grep -E 'ML_CLIENT|ML_REDIRECT|PUBLIC_BASE'
   ```

## Phase C — Re-authorize OAuth (human approves in browser)

1. **Browser**: navigate to:
   `https://panelin-calc-642127786762.us-central1.run.app/auth/ml/start`
2. Human logs into ML and **Authorizes** the app
3. Expect callback page JSON: `{"ok":true,"userId":...}`
4. Re-run Phase A checks — `expiresAt` must be future, `/ml/users/me` must succeed

## Phase D — Verify operativo flow

```bash
npm run ml:verify
# If API_AUTH_TOKEN available in .env:
# curl -s -X POST -H "Authorization: Bearer $API_AUTH_TOKEN" \
#   "https://panelin-calc-642127786762.us-central1.run.app/api/crm/cockpit/sync-ml" | jq .
```

Ask human to click **PULL ML** on hub once API checks pass.

## Phase E — Stop

Report pass/fail table. If still failing, state exact HTTP status + ML error code (not raw tokens). Do not loop blindly — one credential sync + one re-auth cycle before escalating.
