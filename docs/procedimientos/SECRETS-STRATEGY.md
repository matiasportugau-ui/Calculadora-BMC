# SECRETS-STRATEGY — Calculadora BMC / Panelin (2026-06 hardened)

**Status:** Authoritative as of the `fix/secrets-auth-hardening-20260611` work. Replaces scattered notes in SECRETS-MIGRATION.md, CLOUD-RUN-SECRETS-SYNC.md, and various runbooks.

## Core Model (single source of truth per layer)

- **Local development**: Doppler (`bmc-backend/prd` + `bmc-frontend/prd`, config name `prd`) is the declared source of truth.
  - Run everything with `doppler run -- ...`
  - `.env` / `.env.example` are **name + documentation reference only**. Never the runtime truth.
  - Special case for `GOOGLE_APPLICATION_CREDENTIALS` (multi-line SA JSON): use the wrapper `scripts/start-api-with-doppler-creds.sh` (or the new unified script) so google-auth-library receives a real file path.

- **Production backend (Cloud Run `panelin-calc`, project `chatbot-bmc-live`)**: Google Secret Manager (GSM) is the source of truth for high-sensitivity values.
  - Mounted via `--update-secrets` / `--set-secrets` (preferred) or limited env vars.
  - Dual fallback exists in the run scripts for transition, but new/rotated high-sens items must go to GSM.

- **CI / deploys**: The contract lives in `.github/workflows/deploy-calc-api.yml` (`env_vars:` block + long `--set-secrets` flag on the `deploy-cloudrun` action).
  - This is the **single place** that must never omit a secret that the code or provision scripts expect.
  - `workflow_dispatch` is the manual escape hatch.

- **Frontend (Vercel)**: Build-time `VITE_*` only (injected at `npm run build`). No runtime secrets on the client except public client IDs and `VITE_BMC_API_AUTH_TOKEN` (internal builds only).

- **No automatic sync** between Doppler ↔ Vercel ↔ GSM ↔ GitHub repo secrets. The unified script + disciplined CI list + drift checker are the mitigation.

## High-sensitivity keys (must live in GSM + provision list + deploy yaml)

See `scripts/provision-secrets.sh: HIGH_SENS_KEYS` (authoritative list):

- AI: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROK_API_KEY`
- Auth / tokens: `API_AUTH_TOKEN`, `TOKEN_ENCRYPTION_KEY`, `WEBHOOK_VERIFY_TOKEN`, `SYNC_HMAC_SECRET`
- ML / WA / Shopify: `ML_CLIENT_SECRET`, `WHATSAPP_*_TOKEN`, `WHATSAPP_APP_SECRET`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_WEBHOOK_SECRET`
- Identity / infra: `IDENTITY_JWT_SECRET`, `MFA_KEK_HEX`, `DATABASE_URL`, Google Tasks OAuth, Supabase PGP key, service-account JSONs
- **New (2026-06 FacturaExpress integration)**: `FACTURAEXPRESS_PASSWORD`, `FACTURAEXPRESS_WEBHOOK_SECRET` (username + base URL are lower sensitivity)

**Rule**: If a variable is in `HIGH_SENS_KEYS` or is a credential that can cause billing/abuse/spoofing, it must be:
1. In `.env.example` with clear comment.
2. In `provision-secrets.sh`.
3. In `deploy-calc-api.yml` (either env_vars or --set-secrets).
4. Covered by `check-env-drift` (no growth of ALLOWED_ENV_DRIFT.txt for new code).

## How to add / rotate a secret (the 5-minute path)

1. Add the value in Doppler (local dev) and/or `.env` (for the script).
2. If high-sens: run `doppler run -- ./scripts/secrets-provision-verify.sh` (or the individual provision + run_ml + sheets scripts).
3. **No manual yaml edit needed for most cases** — the `--set-secrets` list in deploys is now **auto-generated** at CI time from the `HIGH_SENS_KEYS` array in `scripts/provision-secrets.sh` (see the "Compute --set-secrets list" step in `deploy-calc-api.yml` + `provision-secrets.sh --print-mounts`).
4. Update any consumer list (see below).
5. Run `node scripts/check-env-drift.mjs` (must be zero).
6. Gate: `npm run gate:local:full`.
7. Smoke / verify against the service.
8. Document the rotation date in the strategy doc or BITACORA.

Use the new `secrets-provision-verify.sh` as the default entry point. It calls the older scripts and adds drift + consumer summary in one shot.

**Adding a new high-sens secret is now usually just:**
- Add it to `HIGH_SENS_KEYS` in `scripts/provision-secrets.sh`
- Document in `.env.example`
- (The deploy yaml and future deploys pick it up automatically)
- Update consumers + run gates + verify.

## Local developer experience (no hacks)

Preferred:
```bash
BMC_DISK_PRECHECK_SKIP=1 doppler run -- npm run dev:full
# or for API-only with correct Sheets SA file path:
doppler run -- ./scripts/start-api-with-doppler-creds.sh
```

The unified `secrets-provision-verify.sh` can also be used locally (it will be limited without gcloud but will still run drift and print the consumer table).

## Consumers that must be updated on rotation (non-exhaustive)

**API_AUTH_TOKEN** (most widespread):
- Backend: `server/config.js`, `requireServiceOrUser.js`, cockpit middlewares, devModeAuth, agent surfaces.
- Frontend: `src/utils/operatorApiClient.js`, `PricingEditor.jsx` (VITE_BMC_API_AUTH_TOKEN), BmcAuthProvider flows.
- External: GPT actions, MCP panelin tools, CI smoke scripts, operator notes, `docs/team/panelsim/*`.

**AI provider keys**:
- `server/lib/{suggestResponse,agentCore,aiProviderConfig,planInterpreter}.js`
- Endpoints: `/api/crm/suggest-response`, `/api/agent/*`, voice, etc.

**Sheets SA (GOOGLE_APPLICATION_CREDENTIALS + MATRIZ)**:
- All of `server/routes/bmcDashboard.js` + MATRIZ CSV endpoint.
- Dedicated mount: `scripts/cloud-run-matriz-sheets-secret.sh`.
- Smoke target: `GET /api/actualizar-precios-calculadora`.

**FacturaExpress (new)**:
- `server/lib/facturaExpressClient.js`
- `server/routes/panelin.js` (sync endpoints)
- `server/routes/webhooks.js` (`/webhooks/facturaexpress`)
- panelin-platform DB tables (invoices, stock movements with source).

**Others**: ML OAuth (token store), WA, Shopify, identity JWT, etc. — see the registry output and the new unified script's consumer section.

## Drift & hygiene

- `node scripts/check-env-drift.mjs` (and `--json`) is a hard gate.
- `ALLOWED_ENV_DRIFT.txt` is the escape hatch for things that are intentionally set only in the Cloud Run console or GSM (migrate them over time).
- After any code change that adds a `process.env.XXX`, either:
  - Document it in `.env.example`, or
  - Add it to the deploy yaml, or
  - Add to ALLOWED (last resort) + update this strategy.

The 2026-06 hardening made the FacturaExpress vars the only drift; wiring them to .env.example + provision + deploy yaml resolved it.

## Verification commands (run these after changes)

```bash
# Local hygiene
node scripts/check-env-drift.mjs
npm run gate:local:full

# Unified flow (best)
doppler run -- ./scripts/secrets-provision-verify.sh

# Prod smoke (after deploy)
BMC_API_BASE=https://panelin-calc-....us-central1.run.app npm run smoke:prod
curl -s "$BMC_API_BASE/health" | jq
# Authenticated examples (replace token):
curl -s -H "Authorization: Bearer $API_AUTH_TOKEN" "$BMC_API_BASE/api/crm/suggest-response" ...
```

## Open risks / future improvements (tracked)

- Full automation of the Doppler ↔ GSM ↔ Vercel triangle (currently manual by design).
- Generation of the `--set-secrets` list from a machine-readable source (e.g. the HIGH_SENS_KEYS + a small mapping) instead of the long hand-written line in the workflow.
- Automatic consumer matrix generation from code + docs.
- Rotation policy + notifications.

See the goal prompt `goal-prompt-secrets-management-auth-hardening.md` for the exact success criteria and anti-patterns that drove this strategy.

## References

- `scripts/secrets-provision-verify.sh` (new unified entry point)
- `scripts/provision-secrets.sh`
- `scripts/run_ml_cloud_run_setup.sh`
- `scripts/cloud-run-matriz-sheets-secret.sh`
- `.github/workflows/deploy-calc-api.yml`
- `server/config.js`
- `CLAUDE.md` (Doppler section)
- `AGENTS.md` (command catalogue)
- Previous: `docs/procedimientos/SECRETS-MIGRATION.md`, `CLOUD-RUN-SECRETS-SYNC.md`

Update this file whenever the model or the list of high-sens keys changes.