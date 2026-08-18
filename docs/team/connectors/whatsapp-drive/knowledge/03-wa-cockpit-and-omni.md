# WA Cockpit y Omni

Dos superficies de operador; no mezclar sus SoT.

## `/hub/wa` — Cockpit

- Shell: `src/components/BmcWaModuleWithTabs.jsx` (Cockpit + Sheet legacy).
- UI: `BmcWaCockpit.jsx`. API: `server/routes/wa.js` bajo `/api/wa/*`.
- Postgres `wa_*` (migraciones `wa-package/migrations/000`–`018`). Apply: `npm run wa:migrate`.
- Ingest extensión: `POST /api/wa/ingest`. Lista: `GET /api/wa/conversations`, hilo `GET /api/wa/messages`.
- Auth operador: magic-link / JWT (`WA_JWT_SECRET`). Ingest máquina: `API_AUTH_TOKEN`.
- Enricher: `waEnricher.js` + worker. `callAgentOnce(channel:"wa")` → **3 borradores** en `wa_suggestions` (paste-back humano). Flag `WA_ENRICHER_ENABLED`.
- Quotes: `waQuoteRunner.js` / `waQuoteParams.js` (auto-quote desde hilo → calc).
- Follow-ups, SLA, rules, webhooks HMAC salientes: workers + `wa_settings` / `wa_flags`.
- Docs: `docs/wa-cockpit/` (`README`, `API-REFERENCE`, `CONFIG-REFERENCE`, `OPERATOR-GUIDE`).

`/wa` redirige a `/hub/wa`. Tab Sheet legacy lee CRM por `origen=WA`.

## `/hub/canales` — Omni inbox

- API: `server/routes/omni.js`. UI: `CanalesModule.jsx` + `WaInboxPanel.jsx`.
- Adapters inbound: `server/lib/omni/adapters/waWebhook.js`, `waExtension.js`.
- Reply: `server/lib/omni/outbound/waReply.js` → mismo Graph core.
- AI worker: classify / suggest / `wa_crm_sync` / embed. Retrieval: `kbBridge.buildOmniRetrievalContext` (últimos 5 `omni_messages` + RAG opcional).
- Reads opcionales del cockpit desde Omni: `OMNI_WA_READS` (`omniReadAdapter.js`).

## Flags de convergencia

| Env | Efecto |
|-----|--------|
| `OMNI_WA_SHADOW_WRITE` | Dual-write webhook → Omni con legacy ON |
| `OMNI_WA_CANONICAL` | Ingest canónico (necesita bus + orchestrator) |
| `OMNI_EVENT_BUS_ENABLED` | Bus de eventos Omni |
| `OMNI_AI_ORCHESTRATOR_ENABLED` | Drena jobs AI |
| `OMNI_WA_CRM_SYNC_DELAY_MS` | Debounce burst para `wa_crm_sync` |
| `OMNI_WA_READS` | Cockpit lee `omni_*` |

Canonical en prod se documentó ON (2026-07-04) en PROJECT-STATE. Verificar flags reales en Cloud Run; no inventar.

## Assistant registry

Clave `wa` = “WhatsApp Cockpit” (`assistantRegistry.js`). Superficie Training KB: `whatsapp` (`kbSurface.js`). Brand surface → channel `wa` (`surface.js`).
