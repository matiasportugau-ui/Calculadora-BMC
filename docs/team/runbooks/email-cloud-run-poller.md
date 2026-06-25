# Runbook — Unattended email ingestion (Cloud Run Job) + cockpit reply

Status: backend code merged on branch `feat/email-thin-slice`. The steps below are the
**human-gated** (`[H]`) deploy + config that turn it on. Until they're done, ingestion still runs
manually and the `origen=Email` reply returns `503 email_reply_not_configured`.

## What the code already does (no action needed)

- `POST /api/crm/ingest-email` now **dedupes** by `messageId` via `public.email_ingest_log` (migration
  `20260625000001_email_ingest_log.sql`) and records the receiving casilla + sender, so the ingester
  can run repeatedly without writing duplicate leads.
- The CRM cockpit dispatcher (`POST /crm/cockpit/send-approved`, `POST /consultations/:id/reply`) now
  handles `origen=Email`: resolves recipient + casilla from `email_ingest_log` (falling back to the row),
  sends via `server/lib/emailReply.js`, threads with `In-Reply-To`, and stamps `Enviado el`.

## [H1] Apply the migration

Apply `supabase/migrations/20260625000001_email_ingest_log.sql` via **Supabase MCP** (same path as the
other `supabase/migrations/*`). Idempotent.

## [H2] SMTP — verify the port, then wire accounts.json

The 6 casillas are on cPanel host `s111.nty.uy`; SMTP almost certainly reuses the existing IMAP
password env (`EMAIL_<CASILLA>_PASS`). **Verify with one real send first** (e.g. from `ventas@`):

```bash
# quick check (port 465 SSL; if it fails try 587 STARTTLS secure:false)
node -e "import('nodemailer').then(async ({default:nm})=>{const t=nm.createTransport({host:'s111.nty.uy',port:465,secure:true,auth:{user:'ventas@bmcuruguay.com.uy',pass:process.env.EMAIL_BMC_VENTAS_PASS}});console.log(await t.sendMail({from:'ventas@bmcuruguay.com.uy',to:'<your-test-addr>',subject:'BMC SMTP test',text:'ok'}));})"
```

Then add an `smtp` block to each account in
`…/conexion-cuentas-email-agentes-bmc/config/accounts.json` (reuse the existing `passwordEnv`):

```json
"smtp": { "host": "s111.nty.uy", "port": 465, "secure": true,
          "user": "ventas@bmcuruguay.com.uy", "passwordEnv": "EMAIL_BMC_VENTAS_PASS" }
```

The BMC backend must be able to read this file (`BMC_EMAIL_INBOX_REPO` or sibling default) **and** have
the `EMAIL_<CASILLA>_PASS` vars in its env (Doppler `bmc-backend/prd` + GCP Secret Manager).

## [H3] Secrets

```bash
EMAIL_INGEST_TOKEN=$(openssl rand -hex 32)        # currently missing in Doppler AND GitHub
# Doppler (local dev) — printf, not echo:
printf '%s' "$EMAIL_INGEST_TOKEN" | doppler secrets set EMAIL_INGEST_TOKEN --project=bmc-backend --config=prd
# GCP Secret Manager (prod) — EMAIL_INGEST_TOKEN + the 6 EMAIL_<CASILLA>_PASS
```

## [H4] Cloud Run Job + Scheduler (genuinely unattended — no Mac dependency)

Add a `Dockerfile` to `conexion-cuentas-email-agentes-bmc`:

```dockerfile
FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Poll IMAP → snapshot, then POST each new message to the prod ingest endpoint.
CMD ["sh","-c","npm run panelsim-update && BMC_EMAIL_SNAPSHOT_PATH=./data/snapshot-latest.json npm run email:ingest-snapshot"]
```

Deploy + schedule (project `chatbot-bmc-live`, region `us-central1`):

```bash
gcloud run jobs deploy bmc-email-poller \
  --source . --region us-central1 \
  --set-secrets EMAIL_INGEST_TOKEN=EMAIL_INGEST_TOKEN:latest,EMAIL_BMC_VENTAS_PASS=EMAIL_BMC_VENTAS_PASS:latest,...(6 casillas) \
  --set-env-vars BMC_API_BASE=https://panelin-calc-q74zutv7dq-uc.a.run.app

gcloud scheduler jobs create http bmc-email-poller-sched \
  --schedule "*/30 12-22 * * 1-5" --time-zone "America/Montevideo" \
  --uri "https://<run-jobs-exec-uri>" --http-method POST --oauth-service-account-email <sa>
```

Cadence `*/30 12-22 * * 1-5` = every 30 min, business hours UY, Mon–Fri.

### Interim stopgap (optional, same-day, Mac-tethered)

`launchd` plist running `npm run panelsim-update && npm run email:ingest-snapshot` on the same cadence.
Delete once the Cloud Run Job is live.

## Verify

1. `gcloud run jobs execute bmc-email-poller` → a new real email appears in `CRM_Operativo`, no script run
   by hand. Run twice → second run adds **no** duplicate rows (dedupe via `email_ingest_log`).
2. Cockpit: approve an `origen=Email` row → customer receives a threaded reply; `Enviado el` stamped.
3. `npm run smoke:prod`.
