# Security Gap — WHATSAPP_APP_SECRET Missing from Cloud Run

**Detected:** 2026-04-24  
**Severity:** Medium (unauthenticated webhook injection possible)  
**Status:** Open — requires manual secret provisioning  
**Flagged by:** bmc-security agent (flagged), bmc-deployment agent (confirmed 2026-04-24)

---

## Summary

`WHATSAPP_APP_SECRET` is **not set** in Cloud Run (service `panelin-calc`, region `us-central1`) and is **not present in Secret Manager**.

When this variable is absent, `POST /webhooks/whatsapp` accepts all inbound requests without verifying the `x-hub-signature-256` HMAC header sent by Meta. The server logs a warning but continues processing the payload.

---

## Evidence

### 1. Secret Manager — not found

```
gcloud secrets list --filter="name:WHATSAPP_APP_SECRET"
# output: Listed 0 items.
```

### 2. Cloud Run env — not present

The full env var list for Cloud Run revision `panelin-calc-00226-d6s` (current as of 2026-04-24) contains no `WHATSAPP_APP_SECRET` entry. Confirmed via:

```
gcloud run services describe panelin-calc --region us-central1 --format="json"
# no WHATSAPP_APP_SECRET in spec.template.spec.containers[0].env[]
```

### 3. Code path (server/index.js:596–609)

```js
app.post("/webhooks/whatsapp", asyncHandler(async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const sig = req.headers["x-hub-signature-256"];
  const verified = verifyWhatsAppSignature({
    appSecret: config.whatsappAppSecret,   // empty string when unset
    rawBodyBuffer: raw,
    signatureHeader: sig,
  });
  if (!verified.skipped && !verified.ok) {
    return res.status(401).json({ ok: false, error: "invalid webhook signature" });
  }
  if (verified.skipped && config.appEnv !== "test") {
    logger.warn("WHATSAPP_APP_SECRET unset — POST /webhooks/whatsapp HMAC verification skipped");
  }
  // ... continues processing payload
```

`server/lib/whatsappSignature.js` returns `{ ok: true, skipped: true }` when `appSecret` is falsy — the webhook handler proceeds unconditionally.

---

## Risk

Any actor who knows the Cloud Run URL can send arbitrary POST payloads to `/webhooks/whatsapp` and have them processed as if they were genuine Meta events. This could trigger:

- Fake WhatsApp message ingestion into the CRM
- Injection of malicious text into AI conversation pipelines
- Auto-trigger of the 5-minute inactivity response logic with attacker-controlled content

---

## Resolution Steps (requires credential access — not automated)

1. **Obtain the App Secret** from the Meta Developer Console:
   - Go to https://developers.facebook.com → App `chatbo2` → Settings → Basic → App Secret (show)

2. **Create the secret in Secret Manager:**
   ```bash
   echo -n "YOUR_APP_SECRET_VALUE" | gcloud secrets create WHATSAPP_APP_SECRET \
     --data-file=- \
     --project=chatbot-bmc-live
   ```

3. **Mount it in Cloud Run:**
   ```bash
   gcloud run services update panelin-calc \
     --region=us-central1 \
     --project=chatbot-bmc-live \
     --update-secrets=WHATSAPP_APP_SECRET=WHATSAPP_APP_SECRET:latest
   ```

4. **Verify** by checking the new revision has the secret mounted:
   ```bash
   gcloud run services describe panelin-calc \
     --region=us-central1 \
     --format="json" | grep -i whatsapp
   ```

5. **Smoke test** — send a test POST without a valid signature and confirm the server returns `401`:
   ```bash
   curl -s -X POST https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/whatsapp \
     -H "Content-Type: application/json" \
     -d '{"test":true}'
   # Expected: {"ok":false,"error":"invalid webhook signature"}
   ```

---

## Related Docs

- `docs/team/WHATSAPP-META-E2E.md` §1.1 — original provisioning instructions
- `server/lib/whatsappSignature.js` — HMAC verification implementation
- `server/index.js:596` — webhook handler
- `server/config.js:97` — `whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || ""`
