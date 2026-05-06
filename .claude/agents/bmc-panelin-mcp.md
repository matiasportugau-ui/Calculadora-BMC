---
name: bmc-panelin-mcp
description: External agent surface for the Panelin BMC calculator. Exposes 22 tools (calc + catalog + state + PDF + CRM + WhatsApp + telemetry) over MCP for use by Claude Code subagents, GPT Builder, Cursor, and other MCP clients. Use when you need to drive calculadora-bmc.vercel.app from outside the in-app Panelin chat.
---

# bmc-panelin-mcp

External MCP-based access to the BMC Panelin calculator + Wolfboard hub. Wraps every `AGENT_TOOLS` entry from `server/lib/agentTools.js` (28 tools) so a subagent or external client can natively quote, recall, save to CRM, send WhatsApp, manage admin pendientes, run batch AI quoting, and inspect telemetry without touching the in-app chat.

## Architecture

```
External Agent (Claude Code subagent / GPT Builder / Cursor)
    ↓ MCP stdio (Zod-typed tool calls)
scripts/mcp-panelin-http.mjs
    ↓ HTTP
calculadora-bmc.vercel.app  /  panelin-calc Cloud Run
    ↓
server/routes/agentChat.js
   ├─ GET  /api/agent/tools-manifest   ← MCP server boot reads this
   └─ POST /api/agent/exec-tool        ← MCP server forwards every call
        ↓
   server/lib/agentTools.js  executeTool(name, input, calcState)
```

## Tool surface (28)

Same set as `bmc-panelin-chat`, surfaced unchanged. Loose Zod input (`z.record(z.unknown())`); the actual JSON Schema is included in each tool's MCP description so downstream models can render the contract.

**Open (no auth):**
- Read: `obtener_escenarios`, `obtener_catalogo`, `obtener_informe_completo`, `listar_opciones_panel`, `obtener_precio_panel`, `get_calc_state`, `listar_cotizaciones_recientes`, `obtener_cotizacion_por_id`, `obtener_pdf_html`, `historial_cliente`, `buscar_cliente_crm`
- Calc: `calcular_cotizacion`, `presupuesto_libre`
- State write (UI-only): `aplicar_estado_calc` — emits ACTION_JSON which only the in-app chat client consumes; harmless from MCP context
- Compare: `comparar_listas`, `comparar_escenarios`
- Compose: `formatear_resumen_crm`, `generar_pdf`

**Auth-gated (require `BMC_API_TOKEN` env):**

Customer-touching writes:
- `guardar_en_crm` — appends to `CRM_Operativo` Sheet
- `enviar_whatsapp_link` — sends WhatsApp Cloud message
- `cancelar_cotizacion` — soft-deletes a quote
- `programar_seguimiento` — adds local follow-up reminder

Wolfboard hub (admin):
- `wolfboard_pendientes` — list Admin 2.0 pending rows
- `wolfboard_export` — CSV of the same listing
- `wolfboard_sync` — propagate Admin.J → CRM.AF (batch)
- `wolfboard_actualizar_fila` — edit a single Admin row
- `wolfboard_marcar_enviado` — move row to Enviados tab
- `wolfboard_quote_batch` — Claude Haiku batch quoting

The four customer-write tools and the four Wolfboard write tools enforce a **`user_confirmed: true`** flag in the input on top of the Bearer gate — server returns `requiere confirmación explícita del usuario` if missing, regardless of auth status. Two-layer gate. Wolfboard reads (`pendientes`, `export`) are auth-gated only (no `user_confirmed` needed; pure read).

**Note: the MCP path has no intent classifier.** The in-app chat additionally validates the user's natural-language intent server-side (see `server/lib/userIntentClassifier.js`), but MCP is single-shot tool calls without conversation context, so we rely on Bearer + `user_confirmed`. Different threat model: the MCP caller is an authenticated automation, not a chat user.

## How to add to a Claude Code session

```bash
# Local dev (API on :3001)
claude mcp add panelin --transport stdio -- node scripts/mcp-panelin-http.mjs

# Cloud Run prod (with auth for write tools)
BMC_API_BASE=https://panelin-calc-XXX-uc.a.run.app BMC_API_TOKEN=$API_AUTH_TOKEN \
  claude mcp add panelin --transport stdio -- node scripts/mcp-panelin-http.mjs
```

## Endpoints

| Path | Method | Auth | Use |
|---|---|---|---|
| `/api/agent/tools-manifest` | GET | none | MCP boot — list all tools |
| `/api/agent/exec-tool` | POST | Bearer for writes | Run a tool by name |
| `/api/agent/tool-stats` | GET | none | Per-tool latency / error rate (last 24h) |

## Smoke test

```bash
# 1. Start API
npm run start:api

# 2. Verify manifest
curl -s http://localhost:3001/api/agent/tools-manifest | jq '.count'   # → 22

# 3. Run a read tool over HTTP
curl -s -X POST http://localhost:3001/api/agent/exec-tool \
  -H "Content-Type: application/json" \
  -d '{"name":"obtener_escenarios","input":{}}' | jq '.result.ok'      # → true

# 4. Try a write tool without auth → 401
curl -s -X POST http://localhost:3001/api/agent/exec-tool \
  -H "Content-Type: application/json" \
  -d '{"name":"guardar_en_crm","input":{"pdf_url":"x","user_confirmed":true}}' | jq '.error'

# 5. With auth + user_confirmed → reaches the helper
curl -s -X POST http://localhost:3001/api/agent/exec-tool \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_AUTH_TOKEN" \
  -d '{"name":"guardar_en_crm","input":{"pdf_url":"x","user_confirmed":true}}'
```

## Security posture

1. **Read tools** are open: catalog, pricing, formulas, scenarios. No customer PII surfaces (it's only present on `historial_cliente` which combines `buscar_cliente_crm` — and that read requires `BMC_SHEET_ID`-configured GCP creds anyway, so external instances naturally degrade to "no data").
2. **Write tools** require both `Authorization: Bearer ${API_AUTH_TOKEN}` AND `user_confirmed: true` in the input. Server-side enforcement; can't bypass via prompt.
3. **`aplicar_estado_calc`** emits ACTION_JSON via the `emitAction` callback — but that callback is null in the `exec-tool` HTTP route (no SSE stream), so calling it from MCP just records the request without affecting any UI. Safe.
4. **Telemetry** at `/api/agent/tool-stats` is open by design (no PII). Useful for sidecar monitoring.

## When NOT to use this agent

- **Inside the calculator UI** — use the in-app Panelin chat (it has the SSE stream + ACTION_JSON live state updates). The MCP path is for external orchestration.
- **For UI-driven flows** — `aplicar_estado_calc` is no-op outside the chat client.
