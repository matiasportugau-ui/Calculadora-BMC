# Meta API Playbook (WhatsApp + Instagram + Facebook)

## 1) Inputs to Gather Before Coding

- Meta App ID and App Secret
- Business Manager ID
- WhatsApp Business Account (WABA) ID and phone number ID
- Facebook Page ID linked to Instagram Professional account
- Required permissions/scopes and app-review constraints
- Public HTTPS callback URL for webhooks

## 2) Environment Variable Blueprint

Use names like:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_GRAPH_API_VERSION` (example: `v21.0`)
- `META_VERIFY_TOKEN`
- `META_WEBHOOK_SECRET` (optional env var alias for `META_APP_SECRET` used to validate `X-Hub-Signature-256`; Meta webhook signatures are always derived from the app secret)
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_WABA_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `FACEBOOK_PAGE_ID`
- `FACEBOOK_PAGE_ACCESS_TOKEN`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- `INSTAGRAM_ACCESS_TOKEN`

## 3) Endpoint Map (Typical)

Assume `BASE=https://graph.facebook.com/{version}`.

- WhatsApp send message:
  - `POST /{WHATSAPP_PHONE_NUMBER_ID}/messages`
- WhatsApp media upload:
  - `POST /{WHATSAPP_PHONE_NUMBER_ID}/media`
- Facebook Page feed post:
  - `POST /{FACEBOOK_PAGE_ID}/feed`
- Instagram publish container creation:
  - `POST /{INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`
- Instagram publish:
  - `POST /{INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`
- Debug access token:
  - `GET /debug_token`

## 4) Webhook Verification Pattern

For GET verification:

- Check `hub.mode == subscribe`
- Check `hub.verify_token == META_VERIFY_TOKEN`
- Return `hub.challenge` with HTTP 200
- Return HTTP 403 on mismatch

For POST webhook events:

- Validate `X-Hub-Signature-256` using the **app secret** (`META_APP_SECRET`) as the HMAC key — Meta does not support a separate webhook signing secret
- Compute HMAC SHA-256 of the raw request body with the app secret and compare to the header value
- Reject invalid signatures with HTTP 401/403
- Return HTTP 200 quickly, process asynchronously when possible

## 5) Event Normalization Strategy

Normalize incoming events to a shared internal envelope:

- `channel`: `whatsapp | instagram | facebook`
- `externalAccountId`
- `eventType`
- `eventId`
- `from`
- `to`
- `timestamp`
- `payload`

Store `eventId` for idempotency and replay defense.

## 6) Permission Planning (Least Privilege)

Typical scopes (adjust as needed):

- WhatsApp: product access + messaging permissions
- Instagram: `instagram_basic`, `instagram_manage_messages`, `instagram_content_publish`
- Facebook: `pages_manage_posts`, `pages_read_engagement`, `pages_manage_metadata`, `pages_messaging` (if needed)

Always map each permission to a feature requirement in documentation.

## 7) Production Hardening Checklist

- Centralized API client with:
  - timeout
  - retry with backoff for transient 5xx/429
  - typed error mapping
- Token lifecycle handling:
  - page/system user token renewal process
  - expiry monitoring
- Webhook security:
  - signature validation using app secret (HMAC SHA-256)
  - IP/rate controls where feasible
  - replay protection by event ID
- Observability:
  - structured logs with request correlation IDs
  - metrics for success/failure per channel
  - alerts for auth failures and sustained 429 rates

## 8) Smoke Test Matrix

1. Webhook verify challenge succeeds.
2. Invalid verify token is rejected.
3. Invalid webhook signature is rejected.
4. WhatsApp inbound test message produces normalized event.
5. WhatsApp outbound text send returns message ID.
6. Facebook post publish returns post ID.
7. Instagram publish flow returns media ID and published ID.
8. Expired token simulation yields clear actionable error.

## 9) Troubleshooting Quick Guide

- OAuth/permission errors:
  - Re-check token type, granted scopes, app mode (dev/live), and asset ownership.
- Webhook not firing:
  - Confirm subscription fields and callback reachability over HTTPS.
- IG publish fails:
  - Ensure account is professional, linked to Page, and media URL is publicly accessible.
- WhatsApp message fails:
  - Validate template approval (if template type), phone number ID, and recipient formatting.
