# xAI Voice Agent — Panelin BMC

| Field | Value |
|-------|--------|
| Agent name | `Panelin BMC` |
| Agent ID | `agent_WDdcfWOG9NLd59zL` |
| Console | https://console.x.ai/team/7a6651bd-d16f-4ed2-9dd8-7be5ed32b3ce/voice/agents/agent_WDdcfWOG9NLd59zL |
| In-app | Floating Panelin **Voice Mode** uses the same **Voice Brain Pack** (`server/lib/voiceBrainPack.js`) over Grok Realtime. Browser Speech-to-Speech **cannot** load `agent_id`; we mirror instructions + tools. |

## Three layers of the brain

1. **Speech / console** — `server/lib/voice/panelinBmcInstructions.js` (mirror of console Instructions).
2. **Shared IAlfred ↔ Panelin lessons** — `brainKB.js` / `gs://bmc-ml-tokens/bmc-brain/lessons.json` when `VITE_FEATURE_BRAIN=true`. Personal `~/.ialfred/` is **not** dumped into voice.
3. **Tools** — AGENT_TOOLS allowlist (calc + Admin sheets + `generar_pdf`) executed **server-side** via `POST /api/agent/voice/action` (no `PANELI_MCP_SECRET` in the browser). Form functions (`setTecho`, `aplicar_estado_calc`, …) update the calculator UI.
4. **Product bible** — Grok Voice server-side `file_search` on collection `bmc-product-bible` (`XAI_COLLECTION_BMC_PRODUCT_BIBLE` / default `collection_b214352f-e88a-4b21-8536-9719088a7299`). Rules (AU, lmin/lmax, ISOFRIG vs ISODEC) only. **Prices stay `obtener_precio_panel`.** Sync after LINES/SELL-RULES edits: `doppler run --project=bmc-backend --config=prd -- node scripts/xai-product-bible.mjs`.

## MCP (console only)

- URL: `https://panelin-calc-q74zutv7dq-uc.a.run.app/mcp`
- Auth: `Authorization: Bearer <PANELI_MCP_SECRET>` (Doppler `bmc-backend/prd`)
- In-app does **not** send that secret on `session.update`.

## Smoke (in-app)

1. Open calculadora → Panelin flotante → Voice.
2. “Cotizame un techo IsoDec EPS 100 mm de unos 10 por 8, lista web.”
3. Pass = spoken totals from `calcular_cotizacion` **and** form fields filled.
