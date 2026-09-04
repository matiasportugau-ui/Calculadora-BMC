# WhatsApp Business Platform — Meta Cloud API (direct route, no BSP)

Official WhatsApp integration of the BMC API (`server/`, Express 5 on Cloud Run). One
inbound webhook, one internal send endpoint, an automatic reply inside the 24-hour
customer-service window, retries and explicit Meta error handling. No SDK — raw Graph API.

| Surface | Path | Notes |
|---|---|---|
| Webhook verification | `GET /whatsapp/webhook` | `hub.mode=subscribe&hub.verify_token=…&hub.challenge=…` → `200` + challenge as `text/plain`; anything else `403` |
| Inbound events | `POST /whatsapp/webhook` | `X-Hub-Signature-256` HMAC-SHA256 over the raw body with the app secret. Missing/invalid → **403**. Valid → `200 {"ok":true}` immediately, then processing |
| Legacy alias | `GET/POST /webhooks/whatsapp` | Same handlers. This is the URL currently registered in Meta; either can be used |
| Internal send | `POST /whatsapp/send` | Bearer `API_AUTH_TOKEN` (or `X-Api-Key`). Body `{ to?, text?, template?, context_message_id? }` → `{ ok, message_id: "wamid…", to, wa_id, message_status, fallback }` |
| Smoke | `npm run wa:smoke` | `scripts/whatsapp-smoke.sh` — curl checks for the four rows above |

Code map: `server/lib/whatsappOutbound.js` (single Graph sender: version, retry, error
classes, text/template/mark-read), `server/lib/wa/cloudWebhook.js` (verify handler,
signature guard, payload flattening, structured logging, auto-replier),
`server/routes/whatsappCloud.js` (`/whatsapp/send`), `server/index.js` (webhook wiring +
Postgres mirror + omni ingest). Tests: `tests/whatsappCloudWebhook.test.js`,
`tests/whatsappOutboundRetry.test.js`, `tests/whatsappOutboundUnified.test.js`.

## 1. Environment variables

All secrets live in `.env` (git-ignored) locally and in Secret Manager on Cloud Run.
Placeholders are in `.env.example`.

| Variable | Required | Purpose |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | yes | Permanent **System User** token (`whatsapp_business_messaging`, `whatsapp_business_management`). Never log or commit it |
| `WHATSAPP_PHONE_NUMBER_ID` | yes | Phone Number ID from **API Setup** (not the display number, not the WABA ID) |
| `WHATSAPP_VERIFY_TOKEN` | yes | Any random string; you type the same value in the Meta webhook dialog |
| `META_APP_SECRET` (alias `WHATSAPP_APP_SECRET`) | yes | App Dashboard → App settings → Basic → App secret. Without it every webhook POST is rejected with 403 |
| `API_AUTH_TOKEN` | yes | Bearer for `POST /whatsapp/send` |
| `WHATSAPP_TEST_RECIPIENT` | yes for smoke | E.164 digits, no `+` (e.g. `59891234567`). Default and, unless `WHATSAPP_SEND_ALLOW_ANY=1`, the only recipient `/whatsapp/send` accepts |
| `WHATSAPP_GRAPH_API_VERSION` | no | Default `v24.0`. Check the [Graph API changelog](https://developers.facebook.com/docs/graph-api/changelog) before bumping; v21.0 sunsets Jan 2027, v24.0+ no longer includes `conversation` in status webhooks |
| `WHATSAPP_AUTO_REPLY_ENABLED` | no | `1` to reply automatically to inbound texts |
| `WHATSAPP_AUTO_REPLY_MODE` | no | `ack` (default, fixed text) or `agent` (Panelin via `callAgentOnce`, channel `wa`, falls back to the ack text on timeout/error) |
| `WHATSAPP_AUTO_REPLY_TEXT` | no | Ack text (default Spanish acknowledgment) |
| `WHATSAPP_AUTO_REPLY_COOLDOWN_MS` | no | Per-sender cooldown. Empty → 1 h in `ack` mode, 0 in `agent` mode |
| `WHATSAPP_AUTO_REPLY_AGENT_TIMEOUT_MS` | no | Default 20000 |
| `WHATSAPP_FALLBACK_TEMPLATE_NAME` / `_LANG` | no | Approved template sent when Meta answers **131047** (outside the 24 h window). `hello_world` / `en_US` exists on every test number |
| `WHATSAPP_SEND_ALLOW_ANY` | no | `1` lets `/whatsapp/send` target any number (it bypasses the consent/24 h checks of `/api/wa/outbound`) |

Optional Meta identifiers you will collect while clicking through the portal (not read by
the code, but keep them in your notes): **App ID**, **WhatsApp Business Account ID (WABA)**.

## 2. Meta Developer Portal — exact clicks

Prerequisite: a Meta Business Portfolio and an app of type **Business** with the
**WhatsApp** product added (App Dashboard → Add product → WhatsApp → Set up).

### 2.1 Collect IDs and the token
1. App Dashboard → left menu **WhatsApp → API Setup**.
2. Copy **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`. Copy **WhatsApp Business Account ID** for your notes.
3. The **Temporary access token** shown here expires in 24 h — fine for the first smoke, not for production.
4. Permanent token: **Business Settings** (business.facebook.com/settings) → **Users → System users → Add** (Admin) → select the user → **Add assets → Apps** → your app → *Manage app* → **Generate new token** → pick the app, expiry **Never**, permissions `whatsapp_business_messaging` + `whatsapp_business_management` → copy → `WHATSAPP_ACCESS_TOKEN`.
5. App Dashboard → **App settings → Basic → App secret → Show** → `META_APP_SECRET`.

### 2.2 Add the test recipient
1. **WhatsApp → API Setup → Step 1 "Select phone numbers" → To** dropdown → **Manage phone number list → Add phone number**.
2. Enter the number in E.164, click **Next**, type the OTP WhatsApp sends to that phone, **Confirm**.
3. The free test number allows **up to 5** recipients. Sending to any other number returns **131030** (`recipient_not_allowed`). Put the number (digits only) in `WHATSAPP_TEST_RECIPIENT`.

### 2.3 Register the webhook and subscribe to `messages`
1. Deploy the API (or start a tunnel, §3) so `https://<host>/whatsapp/webhook` is reachable. Production host: `https://panelin-calc-642127786762.us-central1.run.app`.
2. App Dashboard → **WhatsApp → Configuration** (on newer dashboards: **Use cases → "Connect with customers through WhatsApp" → Customize → Configuration**).
3. **Webhook → Edit**: Callback URL `https://<host>/whatsapp/webhook`, Verify token = `WHATSAPP_VERIFY_TOKEN`, click **Verify and save**. Meta calls `GET …?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…` and expects the challenge back. A 403 here means the token differs.
4. **Webhook fields → Manage** → tick **messages** → **Subscribe**. (Optional: `message_template_status_update`, `phone_number_quality_update`, `account_update`.) Delivery statuses (`sent/delivered/read/failed`) arrive on the same `messages` field.
5. Send yourself a test from **API Setup → Step 2 "Send messages with the API" → Send message** (the `hello_world` template). You should see a `wa_status` line in the API log.

### 2.4 Going to production later
Add your own number (**WhatsApp → API Setup → Add phone number**: display name, category, SMS/voice verification, 2-step PIN), add a payment method (**WhatsApp → Payment settings**, otherwise sends fail with 131042), and complete Business Verification to lift the messaging tiers. Templates: **WhatsApp Manager → Message templates → Create** (utility/marketing/authentication); approval usually takes minutes to hours.

## 3. Local testing with a public URL

The webhook needs HTTPS. Either tunnel to the local API or test against Cloud Run.

```bash
npm run env:ensure                      # creates .env from .env.example
# fill WHATSAPP_* / META_APP_SECRET / API_AUTH_TOKEN in .env
npm run start:api                       # :3001

# tunnel (pick one)
cloudflared tunnel --url http://localhost:3001     # prints https://<random>.trycloudflare.com
ngrok http 3001                                    # prints https://<random>.ngrok-free.app
```
Use `https://<tunnel-host>/whatsapp/webhook` in §2.3. Tunnels rotate their hostname on
restart — re-run **Verify and save** when it changes.

Checks (each prints the raw response):

```bash
# 1. handshake
curl "https://$PUBLIC_HOST/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=$WHATSAPP_VERIFY_TOKEN&hub.challenge=12345"   # → 12345

# 2. signature: bad → 403, good → 200
BODY='{"object":"whatsapp_business_account","entry":[]}'
curl -i -X POST -H 'Content-Type: application/json' -H 'X-Hub-Signature-256: sha256=deadbeef' --data "$BODY" "https://$PUBLIC_HOST/whatsapp/webhook"
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$META_APP_SECRET" | awk '{print $NF}')
curl -i -X POST -H 'Content-Type: application/json' -H "X-Hub-Signature-256: sha256=$SIG" --data "$BODY" "https://$PUBLIC_HOST/whatsapp/webhook"

# 3. real send (returns wamid.…)
curl -X POST -H "Authorization: Bearer $API_AUTH_TOKEN" -H 'Content-Type: application/json' \
  --data '{"text":"hola desde BMC"}' "https://$PUBLIC_HOST/whatsapp/send"

# or all of the above in one go
BMC_API_BASE=https://$PUBLIC_HOST npm run wa:smoke        # add -- --skip-send to skip the real send
```
`Content-Type: application/json` is required on the POSTs: the raw-body parser only
captures that type, and the HMAC is computed over the raw bytes.

4. Reply from the test phone. The API log shows `[WA] inbound message` (wamid, from, type,
120-char preview) and, with `WHATSAPP_AUTO_REPLY_ENABLED=1`, `[WA] auto-reply sent`
followed by `wa_status` lines (`sent` → `delivered` → `read`) for the reply.

## 4. Behaviour details

**Inbound pipeline (`POST /whatsapp/webhook`)** — signature guard (403) → `200` ack →
every `entry[].changes[]` with `field: "messages"` is flattened → one pino line per
message and per status → statuses update `wa_messages.status` (monotonic) → messages are
mirrored into Postgres (`wa_conversations` / `wa_messages`, `on conflict do nothing`) →
auto-reply → omni canonical ingest or the legacy Sheets flow. Everything after the ack is
best-effort and logged; the ack is never delayed by it.

**Auto-reply** — only for `type: "text"`, never to the business's own number, deduped by
wamid (the mirror insert's `rowCount === 0` means Meta redelivered it; an in-memory set
covers no-DB deployments), per-sender cooldown, `mark as read` first (failure ignored),
reply quotes the inbound message (`context.message_id`). The inbound message itself opens
the 24 h service window, so the reply is always free-form and free of charge.

**Outbound (`sendWhatsAppText` / `sendWhatsAppTemplate`)** — `POST
https://graph.facebook.com/{version}/{PHONE_NUMBER_ID}/messages`, 15 s per attempt, up to
3 attempts with 500 → 1500 → 4500 ms backoff (±20 % jitter, abort-aware) on HTTP 429 /
5xx and on codes 130429, 131056, 4, 80007, 131000, 131057. Errors are `WhatsAppApiError`
with `kind`, `code`, `graphStatus`, `fbtraceId`.

| Meta code | `kind` | `/whatsapp/send` status | What to do |
|---|---|---|---|
| 131030 | `recipient_not_allowed` | 422 | Add the number in **API Setup → To** (§2.2) |
| 131047 | `outside_24h_window` | 422, or 200 with `fallback: "template"` | Set `WHATSAPP_FALLBACK_TEMPLATE_NAME` or have the customer write first |
| 190 | `token_invalid` | 401 | Regenerate the System User token; rotate with `scripts/wa-refresh-access-token.sh` |
| 131026 | `undeliverable` | 422 | Not a WhatsApp number / blocked |
| 429, 130429, 131056 | `rate_limited` | 429 after retries | Slow down |
| 5xx, 131000, 131057 | `server_error` | 502 after retries | Retry later |

**Pricing (2025–2026)** — per-message pricing since July 2025: template messages are
billed per delivered message by category (marketing / utility / authentication); free-form
replies inside the 24 h window are free until **1 Oct 2026**, when Meta starts billing
service messages at utility rates (webhook `pricing.type` becomes `regular`,
`category: "service"`). Click-to-WhatsApp ads open a 72 h free-entry-point window. Marketing
templates to US numbers remain paused. Sources: Meta *Pricing* and *Updates to pricing*
pages.

**Cloud Run** — post-ack work runs after the response; keep the service on request-based
CPU with `--cpu-boost` or switch to CPU always allocated if auto-replies show up late. Meta
sends webhooks from many IPs and retries non-200s with backoff for hours — never return
5xx for business errors, which is why parse failures are acked with 200.

## 5. Troubleshooting

| Symptom | Cause |
|---|---|
| `Verify and save` fails | Wrong `WHATSAPP_VERIFY_TOKEN`, URL not public, or path typo (`/whatsapp/webhook`) |
| Webhook always 403 `invalid_signature` | `META_APP_SECRET` differs from the app's secret, or a proxy re-encoded the body |
| Webhook 403 `webhook_secret_not_configured` | Secret missing on the server — set it, the guard never accepts unsigned requests |
| Send returns 401 `Unauthorized` | `API_AUTH_TOKEN` mismatch |
| Send returns 400 `recipient_not_allowed` (before reaching Meta) | `to` ≠ `WHATSAPP_TEST_RECIPIENT` and `WHATSAPP_SEND_ALLOW_ANY` unset |
| Inbound never arrives | `messages` field not subscribed (§2.3 step 4), or the app is in Development mode and the sender is not a test recipient |
| Message accepted but never delivered | Recipient blocked the number, or `message_status: "held_for_quality_assessment"` |
