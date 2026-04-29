# OAuth + Webhook Redirect Checklist

> Single source of truth for every OAuth callback and webhook URL the
> `panelin-calc` API consumes. Cross-reference before adding a new
> redirect URI to any external console.
>
> **Generated:** 2026-04-29 (v1.3 Fase 0 #1 deliverable). Update whenever
> a new OAuth/webhook integration ships, or when `PUBLIC_BASE_URL` changes.

## Active integrations

| # | Provider | Type | Code path | Relative URL |
|---|----------|------|-----------|--------------|
| 1 | **Mercado Libre** | OAuth (PKCE) | `server/index.js:200-237`, `server/mercadoLibreClient.js:36,83-94` | `/auth/ml/start`, `/auth/ml/callback` |
| 2 | **Mercado Libre** | Webhook | `server/index.js:441-494` | `/webhooks/ml` |
| 3 | **Shopify** | OAuth (PKCE + HMAC) | `server/routes/shopify.js:157-241` | `/auth/shopify`, `/auth/shopify/callback` |
| 4 | **Shopify** | Webhook (HMAC) | `server/routes/shopify.js:244-287` | `/webhooks/shopify` |
| 5 | **Meta WhatsApp Business** | Webhook (verify token + HMAC) | `server/index.js:532-541, 699-749`, `server/lib/whatsappSignature.js` | `/webhooks/whatsapp` |
| 6 | **Google Sheets** | Service Account (no redirect) | `server/lib/googleAuthCache.js`, `server/index.js:159, 565-569` | n/a |
| 7 | **Google Drive** | Service Account (no redirect) | `server/lib/driveUpload.js` | n/a |

Not present (referenced in v1.3 plan but **not implemented yet**):
- Google OAuth (user-facing) — Fase 1 candidate via Supabase Auth
- Supabase Auth callbacks — Fase 1
- Auth0 / Clerk — out of scope

## Absolute URLs to register in each console

`{PUBLIC_BASE_URL}` resolves at runtime:
- **Production:** `https://panelin-calc-q74zutv7dq-uc.a.run.app` (current Cloud Run URL — verify with `gcloud run services describe panelin-calc --region=us-central1 --format='value(status.url)'`)
- **Local dev:** `http://localhost:3001`
- **Preview (Vercel SPA only — these don't host the API):** `https://calculadora-bmc-*.vercel.app`. Frontend uses `VITE_API_URL` to reach prod or local API.

Production absolute URLs:

| Provider | Console field | URL |
|----------|---------------|-----|
| Mercado Libre Developers → URLs de redirección | OAuth callback | `https://panelin-calc-q74zutv7dq-uc.a.run.app/auth/ml/callback` |
| Mercado Libre Developers → Notificaciones | Webhook | `https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/ml` |
| Shopify Partners → App setup → URLs | App URL / OAuth redirect | `https://panelin-calc-q74zutv7dq-uc.a.run.app/auth/shopify/callback` |
| Shopify Partners → App setup → Webhooks | `orders/*`, `draft_orders/*`, `customers/*` | `https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/shopify` |
| Meta App Dashboard → WhatsApp → Configuration | Webhook URL | `https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/whatsapp` |

Dev / staging absolute URLs (use `ngrok`-style tunnel or a separate Cloud Run service):

| Provider | Local OAuth redirect override |
|----------|-------------------------------|
| Mercado Libre | `ML_REDIRECT_URI_DEV` (default: `http://localhost:3001/auth/ml/callback`) |
| Shopify | follows `PUBLIC_BASE_URL` from `.env` |

## Env vars per integration (names only — never log values)

### Mercado Libre

| Var | Required | Purpose |
|-----|----------|---------|
| `ML_CLIENT_ID` | yes | OAuth client (default `742811153438318` in `config.js`) |
| `ML_CLIENT_SECRET` | yes | OAuth secret — **must be in Secret Manager** |
| `ML_AUTH_BASE` | no | Default `https://auth.mercadolibre.com.uy` |
| `ML_SITE_ID` | no | Default `MLU` |
| `ML_REDIRECT_URI_DEV` | no | Default `http://localhost:3001/auth/ml/callback` |
| `ML_REDIRECT_URI_PROD` | no | Default computed from `PUBLIC_BASE_URL + /auth/ml/callback` |
| `ML_USE_PROD_REDIRECT` | no | `true` only on canonical service `panelin-calc` (set automatically by `run_ml_cloud_run_setup.sh`) |
| `TOKEN_ENCRYPTION_KEY` | yes | 64-hex AES key for the GCS-persisted ML tokens — **in Secret Manager** |
| `ML_TOKEN_GCS_BUCKET`, `ML_TOKEN_GCS_OBJECT` | yes (Cloud Run) | GCS persistence for tokens |
| `WEBHOOK_VERIFY_TOKEN` | yes | Validates inbound `/webhooks/ml` calls (currently empty in `.env` — flagged) |

### Shopify

| Var | Required | Purpose |
|-----|----------|---------|
| `SHOPIFY_CLIENT_ID` | yes | App API key |
| `SHOPIFY_CLIENT_SECRET` | yes | App API secret — **Secret Manager** |
| `SHOPIFY_SCOPES` | no | Default: `read_products,write_products,read_orders,write_orders,read_customers,read_draft_orders,write_draft_orders` |
| `SHOPIFY_WEBHOOK_SECRET` | yes | HMAC secret for `/webhooks/shopify` — **Secret Manager** |
| `SHOPIFY_QUESTIONS_SHEET_TAB` | no | Sheets tab for ingest (default `Shopify_Preguntas`) |

### Meta WhatsApp

| Var | Required | Purpose |
|-----|----------|---------|
| `WHATSAPP_VERIFY_TOKEN` | yes | Echoed during Meta webhook handshake — **Secret Manager** |
| `WHATSAPP_APP_SECRET` | yes (prod) | App secret used to validate `x-hub-signature-256` HMAC. **Currently missing in prod** — see `WHATSAPP-HMAC-GAP.md`. Without it, the route accepts unsigned payloads with a warning log. |
| `WHATSAPP_ACCESS_TOKEN` | yes | Permanent or system-user access token for sending messages — **Secret Manager** |
| `WHATSAPP_PHONE_NUMBER_ID` | yes | Phone number ID (env var, low sensitivity) |

### Google service account (Sheets + Drive)

| Var | Required | Purpose |
|-----|----------|---------|
| `GOOGLE_APPLICATION_CREDENTIALS` | yes | Path to JSON service account file — mounted in Cloud Run via `--set-secrets=/run/secrets/service-account.json=panelin-service-account:latest` |

## Critical security gaps surfaced during this audit

1. **Mercado Libre webhook signature is captured but NOT validated.** `server/index.js:460` reads `x-signature` but does not verify it. Anyone hitting `/webhooks/ml` with the right `WEBHOOK_VERIFY_TOKEN` (which itself is currently empty) can forge events. Follow-up: implement HMAC verification using `ML_CLIENT_SECRET` per Mercado Libre webhook signature spec.

2. **WhatsApp HMAC verification is conditional on `WHATSAPP_APP_SECRET`.** If the env var is missing, the route logs a warning and accepts the payload anyway (`server/index.js:710-711`). Tracked separately in `WHATSAPP-HMAC-GAP.md`. The provisioner script `scripts/provision-secrets.sh` should include `WHATSAPP_APP_SECRET` in `HIGH_SENS_KEYS` once the value is obtained from Meta App Dashboard → Settings → Basic.

3. **`WEBHOOK_VERIFY_TOKEN` is empty in `.env`** (skipped during the 2026-04-29 GSM provisioning). Either generate a value (`openssl rand -hex 32`), add it to both `.env` and Mercado Libre Notificaciones config, or remove the verification path if it's truly unused.

4. **OAuth `state` is stored in memory only** (Map with TTL). `server/index.js` (ML) and `server/routes/shopify.js:171` (Shopify). Cloud Run can scale to multiple instances or restart between OAuth start and callback, breaking the flow. Consider moving to Cloud Run sticky sessions or persisting state in GSM/Postgres.

## What to verify in each external console

When you next have access to each console, confirm the URLs above match exactly. Common breakage sources:
- Trailing slashes on redirect URIs (must match exactly per spec)
- HTTP vs HTTPS (production must be HTTPS)
- `localhost` vs `127.0.0.1` mismatches in dev
- Old Cloud Run service revisions if the service was renamed

## Related docs

- `docs/procedimientos/SECRETS-MIGRATION.md` — Secret Manager runbook
- `docs/procedimientos/CLOUD-RUN-SECRETS-SYNC.md` — `run_ml_cloud_run_setup.sh` reference
- `docs/procedimientos/WHATSAPP-HMAC-GAP.md` — WhatsApp HMAC follow-up
- `docs/EXTERNAL-CONNECTIONS.md` — visual map of external integrations
