# Env y secretos (solo nombres)

Nunca pegar valores. Mapeo runtime: `server/config.js`.

## Meta Cloud API

| Variable | Uso |
|----------|-----|
| `WHATSAPP_VERIFY_TOKEN` | GET subscribe (Meta = Cloud Run, idéntico) |
| `WHATSAPP_ACCESS_TOKEN` | Bearer Graph send |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número API (no el MSISDN) |
| `WHATSAPP_APP_SECRET` | HMAC `x-hub-signature-256` en POST |
| `PUBLIC_BASE_URL` | Callback = `{base}/webhooks/whatsapp` |
| `BMC_PROD_WA_PHONE_ID` | Aislamiento staging vs prod (check) |

## Cockpit / workers

| Variable | Uso |
|----------|-----|
| `WA_JWT_SECRET` | JWT operador (rotar invalida sesiones) |
| `WA_AUTH_EMAIL_FROM` | Magic-link from |
| `WA_ENRICHER_ENABLED` / `_INTERVAL_MS` / `_BATCH_SIZE` | Worker sugerencias |
| `WA_TRANSCRIPT_CLOUD` / `WA_TRANSCRIPT_DISABLED` | STT worker |
| `WA_OUTBOUND_RATE_LIMIT` | Tope de envíos |
| `WA_TTL_DAYS` | Purge de texto |
| `API_AUTH_TOKEN` | Bearer ingest `/api/wa/ingest` y CRM cockpit |
| `DATABASE_URL` | `wa_*` + Omni |

`WA_JWT_SECRET` debe ser distinto del JWT de identidad BMC (hard-fail en prod si vacíos o iguales).

## Omni WA

`OMNI_WA_SHADOW_WRITE`, `OMNI_WA_CANONICAL`, `OMNI_WA_CRM_SYNC_DELAY_MS`, `OMNI_WA_READS`, `OMNI_EVENT_BUS_ENABLED`, `OMNI_AI_ORCHESTRATOR_ENABLED`.

## Drive (servidor)

| Variable | Uso |
|----------|-----|
| `GOOGLE_DRIVE_CLIENT_ID` | Desktop OAuth (cuenta dueña de cotizaciones) |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Secret de ese client |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Refresh long-lived |
| `DRIVE_QUOTE_FOLDER_ID` | Root de archivo empresa (creada por **ese** client) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Sheets + fallback Drive SA (My Drive **sin cuota**) |

## Drive (SPA GIS) + login BMC

| Variable | Uso |
|----------|-----|
| `VITE_GOOGLE_CLIENT_ID` | GIS en el bundle Vite (`drive.file` + OIDC) |
| `GOOGLE_OAUTH_CLIENT_ID` | `aud` de `/api/auth/google` — **mismo** Web client |

`VITE_*` se hornea en **build**. Cambio en Vercel = redeploy. Mismatch `aud` → `tokeninfo_aud_mismatch`.

## RAG / AI (contexto, no secretos de WA)

`RAG_ENABLED`, `RAG_TOP_K`, `RAG_THRESHOLD`, keys de providers (`GROK_API_KEY`, etc.). WA inbound usa la cadena de `callAgentOnce`.

Flags de producto extra viven en Postgres `wa_settings` / `wa_flags` (`docs/wa-cockpit/CONFIG-REFERENCE.md`).
