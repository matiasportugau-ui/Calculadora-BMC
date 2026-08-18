# WhatsApp inbound

Callback: `{PUBLIC_BASE_URL}/webhooks/whatsapp` (sin barra final en la base). Código canónico: `GET`/`POST` en `server/index.js`. Firma: `server/lib/whatsappSignature.js`.

## Verify (GET)

Meta envía `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`. El token debe coincidir **carácter a carácter** con `WHATSAPP_VERIFY_TOKEN`. Respuesta: cuerpo = challenge, HTTP 200. Token mal → 403.

Chequeo: `npm run wa:cloud-check` (env enmascaradas + URL). Con API pública: `npm run wa:cloud-check -- --probe`.

## POST messages

1. Verificar HMAC si hay `WHATSAPP_APP_SECRET` (si falta o es inválida → 401).
2. Responder **200 OK de inmediato**.
3. Actualizar status de `wa_messages` si es delivery/read.
4. Mirror: `INSERT` `wa_conversations` / `wa_messages` (`source=cloud_api`).
5. Elegir modo: `chooseWaIngestMode` en `server/lib/wa/ingestMode.js`.

## Modo legacy

- Mapa in-memory `waConversations`.
- Disparo: **5 minutos** sin mensajes **o** el texto contiene **🚀**.
- `processWaConversation` → `POST /api/crm/parse-conversation` → `writeWaCrmIngest` (Form + `CRM_Operativo`, origen WA-Auto).
- `callAgentOnce(channel:"wa")` **sin tools** → cola AF/AG (sugerencia).
- `runWaAutoLearn` (pares Q→A, `source: "wa"`).
- Shadow-write Omni opcional (`OMNI_WA_SHADOW_WRITE`).

## Modo canonical

Requiere **los tres** flags ON: `OMNI_WA_CANONICAL` + `OMNI_EVENT_BUS_ENABLED` + `OMNI_AI_ORCHESTRATOR_ENABLED`. Si falta uno, se cae a legacy (si no, se perderían leads).

- `normalizeAndPersist` del evento `waWebhookToOmniEvent`.
- Jobs: `classify` + `suggest` + `wa_crm_sync` (un sync por teléfono, coalesced).
- El 🚀 **sigue vivo**: acelera el job `wa_crm_sync`, no llama el path legacy inmediato.
- Cockpit `wa_*` mirror no se apaga.

Runbook: `docs/team/runbooks/wa-canonical-flip.md`.

## Segundo inbound (no Meta)

Extensión Chrome MV3 → `POST /api/wa/ingest` (Bearer `API_AUTH_TOKEN`). Idempotente por `msg_id`. Hasta 500 mensajes/POST.

## Qué NO hace el inbound

No responde solo al cliente por Cloud API. No usa tools. No lee Google Drive.
