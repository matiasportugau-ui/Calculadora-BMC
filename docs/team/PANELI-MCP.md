# Paneli MCP — ElevenLabs ↔ Calculadora BMC

Custom **Streamable HTTP** MCP server that exposes Panelin `AGENT_TOOLS` (calc + ops) to the ElevenLabs Conversational AI voice agent **Paneli**.

## Endpoints

| URL | Auth | Purpose |
|-----|------|---------|
| `GET /mcp/health` | none | Liveness + tool count |
| `POST /mcp` | Bearer `PANELI_MCP_SECRET` | MCP Streamable HTTP (JSON mode) |
| `GET /mcp` | Bearer + `Mcp-Session-Id` | Optional SSE (spec) |
| `DELETE /mcp` | Bearer + session | End session |

Alias: `/api/mcp` (same router).

Public via Cloud Run `panelin-calc` and Vercel rewrite `/mcp` → Cloud Run.

## Secrets

| Key | Where |
|-----|--------|
| `PANELI_MCP_SECRET` | Doppler `bmc-backend/prd` + GCP Secret Manager / Cloud Run env |
| Fallback (local/dev only) | `API_AUTH_TOKEN` if `PANELI_MCP_SECRET` unset **and** not Cloud Run / `NODE_ENV=production` |

ElevenLabs dashboard → **Secret Token** = same value (sent as `Authorization: Bearer …`).

Never put the secret in the Server URL query string. In production / Cloud Run, missing `PANELI_MCP_SECRET` → MCP returns 503 (no shared-token fallback).

### One-shot: create dedicated secret + attach to Cloud Run

```bash
# run from any machine with doppler + gcloud auth
SECRET_FILE=$(mktemp) && chmod 600 "$SECRET_FILE"
openssl rand -hex 32 | tr -d '\n' > "$SECRET_FILE"

doppler secrets set PANELI_MCP_SECRET --project=bmc-backend --config=prd < "$SECRET_FILE"

gcloud secrets create PANELI_MCP_SECRET --replication-policy=automatic --project=chatbot-bmc-live || true
gcloud secrets versions add PANELI_MCP_SECRET --data-file="$SECRET_FILE" --project=chatbot-bmc-live

RUNTIME_SA=$(gcloud run services describe panelin-calc --region=us-central1 --project=chatbot-bmc-live --format='value(spec.template.spec.serviceAccountName)')
gcloud secrets add-iam-policy-binding PANELI_MCP_SECRET \
  --project=chatbot-bmc-live \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud run services update panelin-calc \
  --region=us-central1 --project=chatbot-bmc-live \
  --update-secrets=PANELI_MCP_SECRET=PANELI_MCP_SECRET:latest

# optional: also add PANELI_MCP_SECRET=PANELI_MCP_SECRET:latest to
# .github/workflows/deploy-calc-api.yml --set-secrets so future deploys keep it
rm -f "$SECRET_FILE"
```

Until that script runs, Cloud Run MCP stays **503** (fail closed). Local/dev can still use `API_AUTH_TOKEN` as Bearer when `PANELI_MCP_SECRET` is unset.

## Writes policy

By default **high-risk write tools are denied** (CRM save, WA send, email send, Sheets write, TraKtiMe mutations, Wolfboard mutations).

- Unlock: `PANELI_MCP_ALLOW_WRITES=1`
- Extra deny: `PANELI_MCP_DENY_TOOLS=tool_a,tool_b`

In ElevenLabs, prefer **Fine-Grained Tool Approval**: auto-approve calc reads; require approval for any remaining writes.

## Wire-up (ElevenLabs)

1. Workspace: enable MCP (`can_use_mcp_servers`).
2. Agents → Integrations → **Add Custom MCP Server**:
   - **Name:** Paneli BMC Calc
   - **Server URL:** `https://panelin-calc-q74zutv7dq-uc.a.run.app/mcp`  
     (or `https://calculadora-bmc.vercel.app/mcp` after rewrite deploy)
   - **Transport:** Streamable HTTP
   - **Secret Token:** `PANELI_MCP_SECRET`
   - **Approval:** Fine-grained / Always ask for writes
   - **Response timeout:** ≥ 30s (cotizar / PDF)
3. Attach the integration to the **Paneli** agent.
4. Test: “Cotizame un techo IsoDec EPS 100 mm de 10 por 8 metros, lista web.”

## Local smoke

```bash
cd ~/calculadora-bmc
# API running (doppler run -- npm run start:api  OR  npm run dev)
export PANELI_MCP_SECRET=dev-secret   # or rely on API_AUTH_TOKEN
npm run smoke:paneli-mcp
```

Unit tests:

```bash
node tests/paneliMcp.test.js
```

## Architecture

- Factory: `server/mcp/paneliMcpServer.js` → wraps `AGENT_TOOLS` + `executeTool`
- Transport: `server/routes/mcp.js` (SDK `StreamableHTTPServerTransport`, `enableJsonResponse: true`)
- Voice compacting: `server/mcp/voiceShape.js`
- Existing stdio MCP for Cursor/Claude: `npm run mcp:panelin` (`scripts/mcp-panelin-http.mjs`) — unchanged

## Notes

- Conversation `calcState` is in-memory per **server-generated** UUID at MCP `initialize` (not client `X-Conversation-Id` — that header is metadata only). Best-effort on multi-instance Cloud Run.
- Large dumps (`obtener_informe_completo`, HTML PDF) are compacted for TTS.
- Pricing always comes from the live calc engine — Paneli must not invent USD amounts.
