# Omnicanal Meta (WhatsApp + Messenger + Instagram) — runbook

## Inicio rápido (orden fijo)

1. **Postgres:** definir `DATABASE_URL` o `OMNI_DATABASE_URL` en `.env` (misma URL que transportista si compartís instancia; las tablas usan prefijo `omni_`).
2. **Migraciones:** `npm run omni:migrate` — debe imprimir `ok 001_omni_core.sql` (o `skip` si ya estaba aplicada) y `omni migrations done`.
3. **API:** `npm run start:api` y comprobar `curl -s http://localhost:3001/api/omni/health` → `databaseConfigured: true` cuando la URL está bien.
4. **Medios (opcional):** `OMNI_GCS_BUCKET` + credenciales GCS ya usadas en el proyecto; `OPENAI_API_KEY` para STT / imagen.
5. **Worker adjuntos (opcional):** en otro terminal `npm run omni:worker` o una pasada `npm run omni:worker -- --once`.
6. **Meta:** configurar webhooks en Developers (GET verify + POST); tokens en la tabla de abajo. Gates: `docs/team/HUMAN-GATES-ONE-BY-ONE.md`.

Sin `DATABASE_URL`, WhatsApp sigue en **modo legacy** (memoria) y `GET /api/omni/health` devuelve `databaseConfigured: false`.

## URLs webhook (Cloud Run)

- **WhatsApp Cloud API:** `GET|POST /webhooks/whatsapp` (sin cambio de path).
- **Messenger + Instagram (Graph):** `GET|POST /webhooks/meta`  
  Configurar en Meta Developers el callback con la misma base URL del servicio, p. ej.  
  `https://<tu-servicio>.run.app/webhooks/meta`

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` o `OMNI_DATABASE_URL` | Postgres para `omni_*` (obligatorio para persistencia y CRM desde DB). |
| `npm run omni:migrate` | Aplica `server/migrations/omni/*.sql`. |
| `WHATSAPP_*` | Igual que antes (verify, token, phone id, app secret / HMAC). |
| `META_WEBHOOK_VERIFY_TOKEN` | Opcional; default = `WHATSAPP_VERIFY_TOKEN` para GET verify de `/webhooks/meta`. |
| `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID` | Envío Messenger (`send-approved` y auto-reply). |
| `META_INSTAGRAM_ACCOUNT_ID`, `META_INSTAGRAM_ACCESS_TOKEN` | Instagram (default token = page token si no se setea). |
| `META_GRAPH_VERSION` | Default `v21.0`. |
| `OMNI_GCS_BUCKET` | Medios WA: descarga y STT/PDF/imagen. |
| `OMNI_MODE_DEFAULT` | `off` \| `listen` \| `auto` (hilos nuevos). |
| `OMNI_MAX_ATTACHMENT_BYTES` | Tope de descarga (default 25 MiB). |
| `OMNI_IMAGE_EXTRACT_ENABLED` | `true` para caption IA de imágenes (OpenAI). |
| `OPENAI_API_KEY` | STT (Whisper) y extracción imagen opcional. |

## Verificación GET (Meta)

Mismo patrón que WhatsApp; sustituir token y URL:

```bash
curl -sS "https://<HOST>/webhooks/meta?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=OK_META"
```

Esperado: cuerpo `OK_META` y HTTP 200.

## Flujo de datos

1. Webhook → filas `omni_threads` / `omni_messages` (idempotente por `channel` + `external_message_id`).
2. Adjuntos WA → `omni_outbox` job `wa_media_download` → GCS → `wa_media_transcribe` / `wa_media_pdf_text` / opcional imagen.
3. Tras **5 min** sin mensajes en el hilo (o **🚀** en WhatsApp/Messenger/IG) → `parse-conversation` + escritura **Form responses 1** + **CRM_Operativo** (`WA-Auto` / `FB-Auto` / `IG-Auto`).
4. **Modo `auto`:** si `omni_policy.allow_auto` para el tipo de consulta, respuesta automática breve (WhatsApp / Messenger / Instagram).
5. Cockpit `POST /api/crm/cockpit/send-approved` admite orígenes **FB-Auto/Messenger** e **IG-Auto/Instagram** además de WA y ML.

## Operación

- **Health:** `GET /api/omni/health` — `databaseConfigured`, `gcsBucketConfigured`.
- **Export:** `npm run omni:export` — JSONL + Markdown en `.omni-export/`.
- **Playbook borrador:** `npm run omni:playbook` (opcional `OPENAI_API_KEY`).
- **Worker outbox (opcional proceso aparte):** `npm run omni:worker` o `--once`.

## Gates humanos

- App Review Meta para producción abierta (IG/Messenger).
- `docs/team/HUMAN-GATES-ONE-BY-ONE.md` (cm-0 WhatsApp) sigue vigente para WA; replicar checklist para `/webhooks/meta`.

## Documentación relacionada

- `docs/team/WHATSAPP-META-E2E.md` — E2E WhatsApp.
- `docs/team/panelsim/CRM-OPERATIVO-COCKPIT.md` — cockpit AG–AK.
