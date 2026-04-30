# Security Gap — WHATSAPP_APP_SECRET not mounted in Cloud Run

**Detected:** 2026-04-24
**Updated:** 2026-04-30 (security-hardening-202604)
**Severity:** Medium (unauthenticated webhook injection possible)
**Status:** Partially resolved — secret EXISTS in GSM, needs Cloud Run mount
**Flagged by:** bmc-security agent (flagged), bmc-deployment agent (confirmed 2026-04-24)

---

## Current state (as of 2026-04-30)

| Store | Status |
|-------|--------|
| Secret Manager (`chatbot-bmc-live`) | `WHATSAPP_APP_SECRET` ✅ present |
| Cloud Run revision `panelin-calc-00331-2sr` | ❌ **not mounted** — still accepted as plain env var fallback |
| `.env` local | line present but **value empty** |

The secret exists in GSM but Cloud Run is not using it. The fix is a single `--update-secrets` flag
in the next deploy (included in the gcloud batch command in `SECURITY-HARDENING-REPORT-202604.md`).

---

## Summary

When `WHATSAPP_APP_SECRET` is absent from the Cloud Run runtime environment,
`POST /webhooks/whatsapp` accepts all inbound requests without verifying the
`x-hub-signature-256` HMAC header sent by Meta. The server logs a warning but
continues processing the payload.

---

## Evidence

### 1. Code path (server/index.js — POST /webhooks/whatsapp)

```js
const verified = verifyWhatsAppSignature({
  appSecret: config.whatsappAppSecret,   // empty string when WHATSAPP_APP_SECRET not set
  rawBodyBuffer: raw,
  signatureHeader: sig,
});
if (!verified.skipped && !verified.ok) {
  return res.status(401).json({ ok: false, error: "invalid webhook signature" });
}
if (verified.skipped && config.appEnv !== "test") {
  logger.warn("WHATSAPP_APP_SECRET unset — POST /webhooks/whatsapp HMAC verification skipped");
}
```

`server/lib/whatsappSignature.js` returns `{ ok: true, skipped: true }` when `appSecret` is
falsy — the webhook handler proceeds unconditionally.

---

## Risk

Any actor who knows the Cloud Run URL can send arbitrary POST payloads to `/webhooks/whatsapp`
and have them processed as if they were genuine Meta events. This could trigger:

- Fake WhatsApp message ingestion into the CRM
- Injection of malicious text into AI conversation pipelines
- Auto-trigger of the 5-minute inactivity response logic with attacker-controlled content

---

## Resolution Steps

### Step 1 — Obtain the App Secret (human action required)

The secret value must come from Meta Developer Console:

1. Go to https://developers.facebook.com
2. Select app **`chatbo2`**
3. Navigate to **Settings → Basic**
4. Click **"Show"** next to **App Secret**
5. Copy the 32-character hex value

### Step 2 — Update Secret Manager with the real value

The `WHATSAPP_APP_SECRET` secret already exists in GSM. Update its value:

```bash
# Replace <VALUE_FROM_META> with the actual App Secret from Step 1
echo -n "<VALUE_FROM_META>" | gcloud secrets versions add WHATSAPP_APP_SECRET \
  --data-file=- \
  --project=chatbot-bmc-live
```

### Step 3 — Mount in Cloud Run (include in the batch deploy)

This flag is already included in the batch `gcloud run services update` command in
`docs/team/SECURITY-HARDENING-REPORT-202604.md`. If running individually:

```bash
gcloud run services update panelin-calc \
  --region=us-central1 \
  --project=chatbot-bmc-live \
  --update-secrets=WHATSAPP_APP_SECRET=WHATSAPP_APP_SECRET:latest
```

### Step 4 — Smoke test after deploy

```bash
# Should return 401 once WHATSAPP_APP_SECRET is active
curl -s -X POST https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"test":true}'
# Expected: {"ok":false,"error":"invalid webhook signature"}
```

---

## provision-secrets.sh status

`WHATSAPP_APP_SECRET` is already listed in `HIGH_SENS_KEYS` in `scripts/provision-secrets.sh`.
Once you add the value to `.env` locally, running `./scripts/provision-secrets.sh` will
automatically update the GSM version and the next deploy will pick it up.

---

## Related Docs

- `docs/team/SECURITY-HARDENING-REPORT-202604.md` — batch gcloud commands for full deploy
- `docs/team/WHATSAPP-META-E2E.md` §1.1 — original provisioning instructions
- `server/lib/whatsappSignature.js` — HMAC verification implementation
- `server/config.js` — `whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || ""`
