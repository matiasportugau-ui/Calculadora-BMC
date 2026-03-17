# Shopify Integration v4 – Reference

Full business requirements, architecture, and security details. Date: March 2026.

## 1. Business Requirements (core user needs)

- Auto-receive incoming questions / price quotes → append to Google Sheet
- Generate suggested auto-response (rule-based + LLM) directly in Sheet
- Admin interface: list all questions + full context + pre-filled editable reply + one-click approve & send
- Auto-reply mode: global toggle + schedule (days of week + UTC-3 hours range)
- Mimic Mercado Libre UX (quick replies, boxed format) as much as possible inside Shopify
- Stable, low-maintenance, secure deployment (Cloud Run preferred)

## 2. Technical Architecture

| Layer | Choice |
|-------|--------|
| Backend | Node.js 20+ / Express / TypeScript |
| Hosting | Google Cloud Run |
| Persistence | Firestore (shop tokens, configs, question states) |
| Sheets | Google Sheets API v4 (service account) |
| Auth | Shopify OAuth 2.0 → PKCE mandatory + state/nonce + HMAC validation |
| Tokens | Offline access (per-user) → encrypted storage + auto-refresh cron |
| Webhooks | HTTPS endpoint → HMAC v1/v2 → idempotent processing |
| Questions proxy | Order metafields / Draft Order notes / Customer metafields |
| Sending replies | Shopify Admin GraphQL → order/customer notes or Staff email proxy |

## 3. Security & OAuth 2.1 Compliance (non-negotiable)

- **PKCE:** S256 always
- **DPoP:** Proof on token + API calls if Shopify supports by 2026
- **Refresh:** Rotation + immediate old-token revocation; short access_token (5–15 min) + background refresh
- **State/nonce:** One-time-use; store in cookie HttpOnly Secure SameSite=Strict
- **HMAC:** Callback + every webhook (v1/v2)
- **ID token (if OIDC):** JWKS, iss, aud, exp, nonce, azp
- **Scopes:** read_products write_products read_orders write_orders read_customers read_draft_orders write_draft_orders (minimal set)
- **Headers:** HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff
- **JWT:** No alg=none; no HS256 with public key; RS256/ES256 preferred
- **Revocation:** Token blocklist (jti) for logout/revocation
- **GDPR:** Handle customers/redact and customers/data_request webhooks

## 4. Critical Endpoints (detail)

- **GET /auth/shopify** – Start OAuth: build PKCE code_verifier/code_challenge, set state + nonce in cookie, redirect to Shopify consent
- **GET /auth/shopify/callback** – Verify state/HMAC, exchange code + PKCE, store tokens encrypted, redirect to admin
- **POST /webhooks** – Verify HMAC, parse topic, idempotent process, sync to Sheet/DB
- **POST /admin/answer** – Accept approved reply, send via GraphQL (order/customer note or staff email)
- **GET /admin/questions** – Paginated list (pending + history), full context for admin
- **POST /admin/auto-config** – Set auto-reply toggle and schedule (cron expression, UTC-3 window)

## 5. Agent Behavior Summary

- Prioritize: (1) OAuth stability (2) Webhook→Sheet sync (3) Suggested answer generation (4) One-click send (5) Scheduler
- Respond only with clean Node.js/TS code, exact config steps, minimal fixes
- No explanations, chit-chat, or extra features unless explicitly asked

## 6. Implementation Notes (Calculadora-BMC)

- **Routes:** Mounted at root: `GET /auth/shopify`, `GET /auth/shopify/callback`, `POST /webhooks/shopify`, `GET /admin/questions`, `POST /admin/answer`, `GET/POST /admin/auto-config`.
- **Sheet:** Uses `BMC_SHEET_ID` and tab `SHOPIFY_QUESTIONS_SHEET_TAB` (default `Shopify_Preguntas`). Create the tab with headers: `timestamp`, `shop`, `topic`, `id`, `payload`.
- **Env:** `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_WEBHOOK_SECRET`, `TOKEN_ENCRYPTION_KEY` (for shop tokens). Redirect URI: `{PUBLIC_BASE_URL}/auth/shopify/callback`.
- **Webhook:** In Shopify Partner dashboard, set webhook URL to `{PUBLIC_BASE_URL}/webhooks/shopify`; HMAC is verified with `SHOPIFY_WEBHOOK_SECRET`.
