# Runbook — Chatwoot shared inbox + in-app Email Agent (infra + secrets)

Human-gated steps to take the BMC Chatwoot email feature from "code shipped (flags off)" to "production-LIVE". The code is already merged and dormant; this runbook turns it on.

Design spec: `~/.claude/plans/analyce-how-to-create-starry-taco-agent-*.md`. Backend: Cloud Run `panelin-calc` (project `chatbot-bmc-live`, us-central1). Frontend: Vercel `calculadora-bmc.vercel.app`.

> Status of automation: all BMC **code** is shipped behind flags. Everything below is VM / credential / admin-UI work that a human must do (per the "External Blockers — Stop Don't Loop" rule the agent did not attempt these).

## What's already in the codebase (no action needed)
- `server/lib/chatwootClient.js` — REST client (boot-safe; no-op when unconfigured).
- `server/lib/emailLeadIngest.js` — shared AI extraction (Zod + AI Gateway).
- `server/routes/chatwoot.js` — `POST /api/chatwoot/webhook` + `GET /api/chatwoot/health`.
- `server/lib/emailAgentTools.js` + `server/routes/emailAgentChat.js` — `POST /api/email-agent/chat` (auth: `canales:write`).
- `src/components/EmailAgentPanel.jsx` — right-side panel, gated by `VITE_FEATURE_EMAIL_AGENT`.
- Config keys in `server/config.js`; env placeholders in `.env.example`.

---

## Blocker 1 — Stand up Chatwoot CE
1. Provision a VM (recommended: GCP Compute Engine `e2-small`, Ubuntu LTS).
2. Install Docker + compose. Pull Chatwoot's official `docker-compose.production.yaml`.
3. Services: `rails` (web), `sidekiq` (worker), `postgres` (pgvector image), `redis`.
4. Set a stable HTTPS hostname (e.g. `https://inbox.bmc...`) + TLS (Caddy/Cloudflare).
5. `docker compose run --rm rails bundle exec rails db:chatwoot_prepare` then `docker compose up -d`.
6. Create the super-admin account in the UI.

Chatwoot `.env` (its own, on the VM — NOT in this repo):
```
SECRET_KEY_BASE=<generate: openssl rand -hex 64>
FRONTEND_URL=https://inbox.bmc...
DEFAULT_LOCALE=es
```

## Blocker 2 — Outbound SMTP (replies)
Verify creds first (memory flagged `s111.nty.uy:465` as unverified). In Chatwoot `.env`:
```
SMTP_ADDRESS=smtp.gmail.com          # or s111.nty.uy
SMTP_PORT=465
SMTP_USERNAME=ventas@bmc...
SMTP_PASSWORD=<gmail app password / smtp secret>   # printf '%s' — no trailing newline
SMTP_AUTHENTICATION=login
SMTP_ENABLE_STARTTLS_AUTO=true
MAILER_SENDER_EMAIL=BMC Ventas <ventas@bmc...>
```
Test: send a reply from a test conversation; confirm delivery.

## Blocker 3 — Inbound mail → Chatwoot
Mail already flows Cloudflare → Gmail. Chosen mode: **IMAP read the Gmail ventas inbox** (simplest; no Cloudflare change). Admin → Inboxes → New → **Email** channel → IMAP:
```
IMAP host: imap.gmail.com   port 993   SSL on
user: ventas@bmc...   pass: <gmail app password>   (enable IMAP in Gmail settings)
```
(Alternative for lower latency: use Chatwoot's forward-to address and point a Cloudflare/Gmail forward at it.)

Add ALL operators as **Agents** assigned to this inbox → that is the shared inbox, all logged-in users. Leave auto-assignment off so the queue stays shared (collision detection is automatic).

## Blocker 4 — Tokens into BMC secrets
In the Chatwoot UI gather:
- Access token: Profile settings → Access Token → `CHATWOOT_API_TOKEN`
- `CHATWOOT_ACCOUNT_ID` (in the dashboard URL `/app/accounts/<id>/...`)
- `CHATWOOT_INBOX_ID` (inbox settings URL)
- Pick a strong `CHATWOOT_WEBHOOK_SECRET` (e.g. `openssl rand -hex 24`).

Load into BMC (Doppler local + GCP Secret Manager for Cloud Run). Key names must match `^[A-Z][A-Z0-9_]*$`:
```bash
# Doppler (local dev)
cd ~/calculadora-bmc
for k in CHATWOOT_API_BASE CHATWOOT_API_TOKEN CHATWOOT_ACCOUNT_ID CHATWOOT_INBOX_ID CHATWOOT_WEBHOOK_SECRET; do
  printf '%s' "<value>" | doppler secrets set "$k" --project bmc-backend --config prd --silent
done
# GCP Secret Manager (Cloud Run reads these) — repeat per key:
printf '%s' "<value>" | gcloud secrets create CHATWOOT_API_TOKEN --project chatbot-bmc-live --data-file=- 2>/dev/null \
  || printf '%s' "<value>" | gcloud secrets versions add CHATWOOT_API_TOKEN --project chatbot-bmc-live --data-file=-
```
Then redeploy `panelin-calc` so the env is mounted, and set `CHATWOOT_POST_NOTE=true` (default).

## Blocker 5 — BMC-user → Chatwoot-agent map
So agent-driven sends/assigns attribute to the right operator. Provide as env JSON (e.g. `CHATWOOT_AGENT_MAP={"matias@...":7,...}`) or a small sheet. (Hook this into `email_asignar` when you wire per-operator identity; the current build assigns by explicit `assigneeId`.)

## Wire the webhook
Chatwoot → Settings → Integrations → Webhooks → Add:
- URL: `https://<panelin-calc-run-url>/api/chatwoot/webhook?secret=<CHATWOOT_WEBHOOK_SECRET>`
  (or send header `X-Chatwoot-Webhook-Secret`)
- Events: `conversation_created`, `message_created`.

## Turn it on (frontend)
Set `VITE_FEATURE_EMAIL_AGENT=true` in Vercel (production) and redeploy the frontend. The "✉️ Correos BMC" panel appears for authenticated operators with `canales:write`.

## Verification
1. `curl https://<run-url>/api/chatwoot/health` → `{configured:true}`.
2. `curl https://<run-url>/api/email-agent/health` → lists tools, `chatwootConfigured:true`.
3. Send a test email to the ventas inbox → appears as a Chatwoot conversation → a CRM_Operativo row appears with `origen=Email` → a private note with the auto-triage lead shows in Chatwoot.
4. In the calculadora, open the Correos panel → "reportá emails sin responder" → lists conversations. "redactá respuesta al #<id>" → draft. Confirm to send → appears as sent in Chatwoot for all operators.
5. `npm run smoke:prod` green.

## Rollback knobs (no redeploy)
- `CHATWOOT_POST_NOTE=false` — stop posting triage notes.
- Unset `CHATWOOT_API_BASE` — webhook + agent return 503, app unaffected.
- `VITE_FEATURE_EMAIL_AGENT` unset — hide the in-app panel.
