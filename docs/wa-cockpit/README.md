# WA Cockpit — hub de documentación

Cockpit operativo de WhatsApp Web para Calculadora BMC. Capturamos conversaciones desde la sesión Chrome del operador (extensión MV3 en repo separado), las normalizamos en Postgres, y desde el SPA `/wa` listamos chats, generamos sugerencias AI, cotizamos en USD y sincronizamos con CRM_Operativo.

> **Plan canónico**: `.cursor/plans/wa_cockpit_f1-f5_plan_*.plan.md` (5 fases). Esta página es el hub vivo.

---

## Estado por fase

| Fase | Foco | Estado |
|------|------|--------|
| F1 | Read-only scrape + lista en `/wa`, sin AI | **en curso** |
| F2 | WS hook live + 3 sugerencias AI con paste-back manual | pendiente |
| F3 | Cotización auto + sync CRM (col AH) | pendiente |
| F4 | Follow-ups + outbound Cloud API + opt-in | pendiente |
| F5 | Multi-operador + métricas + magazine integration | pendiente |

---

## Arquitectura

```
[Chrome MV3 ext (repo aparte)]──HTTPS Bearer──> POST /api/wa/ingest
                                                       │
                                                       ▼
                                              Postgres wa_*
                                                       │
                                                       ▼
                                              SPA /wa (Vite)
                                                       │
                                          ┌────────────┼────────────┐
                                          ▼            ▼            ▼
                                  /api/crm/cockpit  /calc/cotizar  followups
```

Detalle completo en el plan F1-F5.

---

## Endpoints F1 (montados en `/api`)

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/wa/health` | público | Liveness + counters (`count_chats`, `count_msgs_24h`). |
| POST | `/api/wa/ingest` | Bearer cockpit | Batch idempotente por `msg_id`. Hasta 500 mensajes/POST. |
| GET | `/api/wa/conversations` | Bearer cockpit | List con filtros `status`, `q`, paginación por `cursor` (last_msg_at). |
| GET | `/api/wa/messages` | Bearer cockpit | Hilo paginado por `before` (timestamp keyset). |

### Auth

`Authorization: Bearer ${API_AUTH_TOKEN}` o `X-Api-Key: ${API_AUTH_TOKEN}` o `?key=${API_AUTH_TOKEN}`. Mismo token que `/api/crm/cockpit/*`.

### Schema de mensaje (POST /api/wa/ingest)

```json
{
  "operator_id": "matias",
  "batch_id": "uuid-v4",
  "live": false,
  "messages": [
    {
      "chat_id": "5491111111111@c.us",
      "msg_id": "ABC123",
      "ts": "2026-05-04T20:00:00.000Z",
      "direction": "in",
      "type": "text",
      "text": "hola, cuánto sale ISODEC EPS 100 mm 200 m²?",
      "from": { "phone": "5491111111111", "name": "Cliente" },
      "raw": {},
      "meta": {}
    }
  ]
}
```

`direction ∈ {in, out}`, `type ∈ {text, image, audio, doc, video, sticker, location}`, `source ∈ {wa_web, cloud_api, manual}`. Validador puro: [server/lib/waValidate.js](../../server/lib/waValidate.js).

---

## Postgres

Mismo `DATABASE_URL` que el módulo Transportista. Aislación lógica por prefijo `wa_*`.

| Tabla | Fase |
|-------|------|
| `wa_conversations` | F1 |
| `wa_messages` | F1 |
| `wa_suggestions` | F2 |
| `wa_quotes` | F3 |
| `wa_followups` | F4 |
| `wa_consent` (cols extra en `wa_conversations`) | F4 |

Migraciones en [wa-package/migrations/](../../wa-package/migrations/), runner [scripts/run-wa-migrations.mjs](../../scripts/run-wa-migrations.mjs):

```bash
DATABASE_URL=postgres://… npm run wa:migrate
```

---

## Comandos relevantes

| Comando | Descripción |
|--------|-------------|
| `npm run wa:migrate` | Aplica migraciones SQL (`wa-package/migrations/*.sql`). |
| `npm test` | Incluye `tests/wa-ingest-contract.js` (validación pura, sin servidor). |
| `npm run smoke:prod` | Incluye `GET /api/wa/health` (200 ok / 503 sin DB en entornos sin Postgres). |
| `npm run gate:local:full` | Lint + tests + build. Debe quedar verde antes de cada PR. |

---

## Extensión Chrome

Repo aparte: **calculadora-bmc-wa-extension** (MV3, WXT + TypeScript). Ver [EXTENSION-INSTALL.md](EXTENSION-INSTALL.md) para carga descomprimida en Chrome y futura publicación en Chrome Web Store.

Token cockpit se pega en el popup; queda guardado en `chrome.storage.local` (NO en el DOM de WhatsApp Web).

---

## Documentos relacionados

- [EXTENSION-INSTALL.md](EXTENSION-INSTALL.md) — instalación de la extensión.
- [API-REFERENCE.md](API-REFERENCE.md) — referencia completa de rutas (regenerable desde manifest).
- Plan canónico: `.cursor/plans/wa_cockpit_f1-f5_plan_*.plan.md`.

---

## Anti-patterns (recordatorio del plan)

- No persistir el cuerpo del mensaje en logs estructurados de Cloud Run — solo `msg_id` + `chat_id`.
- No mezclar "envío Cloud API" y "envío vía extensión" en la misma cola.
- No escribir en Sheet en cada keystroke. Postgres → batch → Sheet por save explícito.
- No exponer `/api/wa/*` sin Bearer.
- El system prompt de WhatsApp vive en `server/lib/chatPrompts.js` (no en el cliente).
