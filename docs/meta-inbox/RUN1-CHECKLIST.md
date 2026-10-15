# Run 1 — Activate Omni IG/FB DMs + owner WhatsApp notify

**Status:** code shipped; live flip is owner-gated (tokens + `OWNER_WHATSAPP`).  
**Public API:** `https://panelin-calc-q74zutv7dq-uc.a.run.app`  
**Epic:** [#623](https://github.com/matiasportugau-ui/Calculadora-BMC/issues/623)

Do **not** print secret values. Names and presence only.

## Step 0 — secrets presence

```bash
doppler secrets --project bmc-backend --config prd --only-names
```

| Name | Required for | Notes |
|------|----------------|-------|
| `META_APP_SECRET` | HMAC (or fallback) | Falls back to `WHATSAPP_APP_SECRET` in `config.js` |
| `IG_PAGE_TOKEN` | Outbound IG DM (Run 3) | [ASSUMPTION] may be empty / user token — replace with **System User** token before flags ON |
| `FB_PAGE_TOKEN` | Outbound Messenger (Run 3) | Same as IG |
| `IG_VERIFY_TOKEN` | GET subscribe IG | Falls back to `WHATSAPP_VERIFY_TOKEN` |
| `FB_VERIFY_TOKEN` | GET subscribe FB | Falls back to `WHATSAPP_VERIFY_TOKEN` |
| `WHATSAPP_ACCESS_TOKEN` | Owner notify send | Already live for WA webhook |
| `WHATSAPP_PHONE_NUMBER_ID` | Owner notify send | Cloud API sender (public line 092 663 245) |
| `WHATSAPP_APP_SECRET` | HMAC fallback | Live since 2026-04-18 |
| `OWNER_WHATSAPP` | Notify destination | **Owner sets.** Personal phone, E.164 digits, **not** the Cloud API number |
| `META_PAGE_ID` | Graph subscribe / corpus (1b) | Owner sets |
| `META_IG_ACCOUNT_ID` | Graph subscribe / corpus (1b) | Owner sets |
| `OMNI_IG_ENABLED` | Ingest IG DMs | GitHub Actions variable → Cloud Run env (this PR). Default empty = OFF |
| `OMNI_FB_ENABLED` | Ingest FB DMs | Same |
| `META_COMMENTS_ENABLED` | Run 1b | Keep `0` in Run 1 |

[INFERRED] Approvals travel **from** the owner's personal phone **to** the 092 663 245 Cloud API line; notifications go the other way. A Cloud API number cannot message itself. Confirm personal number → `OWNER_WHATSAPP`. If 092 663 245 is **not** the Cloud API sender, swap.

[ASSUMPTION] `IG_PAGE_TOKEN` / `FB_PAGE_TOKEN` may be empty or 60-day user tokens. Inbound DMs do **not** need page tokens (HMAC + flags only). Outbound (Run 3) needs a non-expiring System User token with `pages_messaging` + `instagram_manage_messages`.

**This host (2026-09-10):** `doppler` CLI was not installed — step 0 must be run on a machine with Doppler (Mac / owner). Do not paste values into chat.

Owner-only (never agent):

```bash
# flags only — never paste tokens in an agent transcript
doppler secrets set OMNI_IG_ENABLED 1 --project bmc-backend --config prd
doppler secrets set OMNI_FB_ENABLED 1 --project bmc-backend --config prd
# OWNER_WHATSAPP / META_PAGE_ID / META_IG_ACCOUNT_ID / page tokens: owner types them
```

Cloud Run reads **GitHub repo Variables** (this PR wires them in `deploy-calc-api.yml`), not Doppler directly:

```bash
gh variable set OMNI_IG_ENABLED --body 1
gh variable set OMNI_FB_ENABLED --body 1
gh variable set META_COMMENTS_ENABLED --body 0
gh variable set OWNER_WHATSAPP --body '<E.164 digits, personal>'
gh variable set META_PAGE_ID --body '<page id>'
gh variable set META_IG_ACCOUNT_ID --body '<ig business account id>'
```

Then dispatch `deploy-calc-api.yml` on `main` after this PR merges.

## Console clicks (Meta developer)

App Review for Messenger + Instagram **messaging** is already approved (owner, 2026-09-10).

1. App → Webhooks → **Page**: subscribe `messages`, `messaging_postbacks`. Callback  
   `https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/messenger`  
   verify token = `FB_VERIFY_TOKEN` (or WA verify token fallback).
2. App → Webhooks → **Instagram**: subscribe `messages`. Callback  
   `https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/instagram`  
   verify token = `IG_VERIFY_TOKEN`.
3. Page / IG account: confirm the Page is subscribed to the app.
4. Token: Business Manager **System User** (non-expiring) with `pages_messaging`, `instagram_manage_messages`. Do **not** use a 60-day user token.
5. Run 1b fields (`feed`, `comments`) — **do not** subscribe yet.

## Verify-token handshake

Never echo the token. Load it in the shell, then:

```bash
# IG
curl -sS -D - -o /tmp/ig-challenge.txt \
  "https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${IG_VERIFY_TOKEN}&hub.challenge=123"
cat /tmp/ig-challenge.txt   # expect body 123, HTTP 200

# Messenger
curl -sS -D - -o /tmp/fb-challenge.txt \
  "https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/messenger?hub.mode=subscribe&hub.verify_token=${FB_VERIFY_TOKEN}&hub.challenge=123"
cat /tmp/fb-challenge.txt   # expect body 123, HTTP 200

# wrong token → 403
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/instagram?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123"
```

## Signed test POST (forged vs valid)

HMAC is `X-Hub-Signature-256` over the **raw JSON** with `META_APP_SECRET` or `WHATSAPP_APP_SECRET`.

```bash
BODY='{"object":"instagram","entry":[{"id":"0","messaging":[{"sender":{"id":"TEST_IGSID","name":"Test"},"recipient":{"id":"PAGE"},"timestamp":1783515000,"message":{"mid":"test_mid_1","text":"ping run1"}}]}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$META_APP_SECRET" | awk '{print $2}')

# valid → 200 { ok:true, events:1 } when OMNI_IG_ENABLED=1
curl -sS -D - \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=${SIG}" \
  --data "$BODY" \
  https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/instagram

# forged → 401
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=deadbeef" \
  --data "$BODY" \
  https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/instagram
```

Duplicate delivery: POST the same `mid` twice → one Omni row (`omni_ingest_dedup`), one notify (second persist returns `duplicate` and skips notify).

Flags OFF: POST still 200 `{ skipped: "flag_off" }`, no persist, no notify.

## Live DM proof (after flags ON + `OWNER_WHATSAPP`)

1. From a test IG user, DM the BMC Instagram account.
2. From a test FB user, Messenger the BMC Page.
3. Expect: one `omni_conversations` row per channel, one WhatsApp on the owner's personal phone in **< 30 s**, format  
   `ðŸ“© IG DM #n · {autor}: "{texto}"` / `ðŸ“© FB DM #n · …`
4. Burst: >5 events in 60 s → one digest `ðŸ“© Meta inbox · N eventos (60s)`.

## What this run does **not** do

- Comments (`feed` / `comments`) — Run 1b (`META_COMMENTS_ENABLED` stays off).
- Drafts / `OK n` publish — Runs 2–3. `#n` is a per-process sequence until Run 3.
- `/hub/meta` UI — Run 4.

## Gate

```bash
npm run gate:local
```
