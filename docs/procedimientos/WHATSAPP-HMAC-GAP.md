# Security Gap — WHATSAPP_APP_SECRET not mounted in Cloud Run

**Detected:** 2026-04-24
**Updated:** 2026-04-30 (security-hardening-202604)
**Severity:** Medium (unauthenticated webhook injection possible)
**Status:** Runtime fails closed; secret EXISTS in GSM, needs Cloud Run mount
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

`WHATSAPP_APP_SECRET` is **not set** in Cloud Run.
When this variable is absent, `POST /webhooks/whatsapp` now returns `401` instead of accepting unsigned payloads. Real Meta POST delivery still requires provisioning the secret so valid signatures can be checked.

---

## Evidence

### 1. Code path (`server/index.js`)

```js
app.post("/webhooks/whatsapp", asyncHandler(async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const sig = req.headers["x-hub-signature-256"];
  const verified = verifyWhatsAppSignature({
    appSecret: config.whatsappAppSecret,   // empty string when unset
    rawBodyBuffer: raw,
    signatureHeader: sig,
  });
  if (!verified.ok) {
    return res.status(401).json({ ok: false, error: "invalid webhook signature" });
  }
  // ... continues only after HMAC validation succeeds
```

`server/lib/whatsappSignature.js` returns `{ ok: false, reason: "missing_app_secret" }` when `appSecret` is falsy, so the webhook handler fails closed.

---

## Risk

Before the fail-closed runtime fix, any actor who knew the Cloud Run URL could send arbitrary POST payloads to `/webhooks/whatsapp` and have them processed as if they were genuine Meta events. This could trigger:

- Fake WhatsApp message ingestion into the CRM / `wa_*` tables
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
