# WhatsApp outbound

**Un solo POST a Graph:** `postWhatsAppMessage` en `server/lib/whatsappOutbound.js`.

```
POST https://graph.facebook.com/v21.0/{phoneNumberId}/messages
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
body: { messaging_product: "whatsapp", to: <solo dígitos>, type: "text", text: { body } }
```

- `to` se normaliza a dígitos (E.164 sin `+`). Omni `sendWaReply` normaliza Uruguay `598`.
- Texto recortado a **4096** caracteres (límite Graph). El canal WA pide **800** al modelo.
- Timeout 15s. Falta teléfono o config → throw. HTTP error: `sendWhatsAppText` throw; `sendWaReply` devuelve `{ok:false}`.

## Callers (no duplicar Graph)

| Path | Contrato |
|------|----------|
| `sendWhatsAppText` | Throw si Graph falla. Dashboard CRM send-approved, transportista outbox, tool `enviar_whatsapp_link`. |
| Omni `sendWaReply` (`server/lib/omni/outbound/waReply.js`) | `{ok, ...}` para el inbox `/hub/canales`. |
| `POST /api/wa/outbound` | Cockpit + consentimiento (`wa_consent`) + rate limit `WA_OUTBOUND_RATE_LIMIT`. |

## Tool Panelin / MCP

`enviar_whatsapp_link` (`server/lib/agentTools.js`):

- Solo chat/MCP con tools. **No** en webhook inbound ni enricher.
- Requiere `to` (teléfono del **cliente**) + `user_confirmed=true`.
- Default: texto corto + link de cotización (`pdf_url` GCS preferido). Override con `text`.
- El server rechaza el envío si falta confirmación.

## Consentimiento y rate

- Cockpit outbound respeta opt-in (`wa-package` migración `005_wa_consent.sql`).
- Rate: `WA_OUTBOUND_RATE_LIMIT` (default documentado 6).
- TTL de texto en DB: `WA_TTL_DAYS` (purge).

## Human gate

Si el send falla, **no** marcar “enviado” en CRM (columnas AH–AK / cola Omni). Evidencia = respuesta Graph OK + id `wamid`.
