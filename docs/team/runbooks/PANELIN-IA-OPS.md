# Panelin IA — Runbook de operación

> Servicio: **panelin-calc** (Cloud Run · us-central1) · Frontend: **calculadora-bmc.vercel.app**
> Último review: 2026-05-07. Owner técnico: equipo BMC/Panelin.

## 1. Secrets requeridos (Cloud Run)

| Variable | Origen | Bloquea boot si falta | Notas |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic console | No (degrada chain) | Default model: `claude-opus-4-7` (`config.anthropicChatModel`). |
| `OPENAI_API_KEY` | OpenAI console | No | Default: `gpt-4o-mini`. Fallback en chain. |
| `XAI_API_KEY` / `GROK_API_KEY` | xAI | No | Fallback. |
| `GEMINI_API_KEY` | Google AI Studio | No | Fallback. |
| `API_AUTH_TOKEN` | secret manager | Sí para devMode/exec-tool | Habilita `Bearer` y `x-api-key`; sin él, devMode = 503. |
| `BMC_SHEET_ID` | Sheets | Solo CRM tools | `guardar_en_crm`, `escribir_crm_taxonomia`. |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Meta | Solo WA tools | `enviar_whatsapp_link`. |
| `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_APP_SECRET` | Meta | Webhooks | HMAC del POST `/webhooks/whatsapp`. |
| `EMAIL_INGEST_TOKEN` | propio | Solo bridge IMAP | `POST /api/crm/ingest-email`. |
| `BUDGET_ENABLED` | propio | No | `true` para activar el budget soft (ver §4). Default `false`. |
| `BUDGET_TURNS_PER_MIN` / `BUDGET_TURNS_PER_5MIN` / `BUDGET_TURNS_PER_24H` / `BUDGET_TOKENS_PER_24H` | propio | No | Caps numéricos. Sin valor → cap inactivo. |
| `CHAT_LOG_CONVERSATIONS` | propio | No | `true` para persistir turnos en `data/conversations/` también en producción. |

**Nunca commitear** valores reales — `.env.example` lleva los nombres, los valores viven en Cloud Run secrets.

## 2. Provider fallback chain

`server/routes/agentChat.js` arma el `providerChain` en este orden cuando `aiProvider="auto"`:
`claude → grok → gemini → openai`.

Si el cliente fija `aiProvider`, ese provider se prueba primero y los demás quedan como fallback.
Cualquier error del provider hace que el loop pruebe el siguiente sin cortar el SSE.

**Cómo cambiar el modelo default sin redeploy**:
- `ANTHROPIC_CHAT_MODEL=claude-sonnet-4-6` (o el id que aplique).
- `OPENAI_CHAT_MODEL=gpt-4o`.
- Restart del servicio Cloud Run; el cliente puede seguir pidiendo `aiProvider="auto"`.

**Si un proveedor degrada (>30 % 5xx en 5 min)**:
1. `gcloud run services logs read panelin-calc --region us-central1 --limit 200` y filtrar por `provider`.
2. Forzar fallback temporal: setear `ANTHROPIC_API_KEY=""` (o el que sea) y redeploy → la chain salta ese provider.
3. Restaurar la key cuando estabilice.

## 3. Rate limits actuales

Definidos en `server/routes/agentChat.js`:
- `publicLimiter` — 10 req/min por IP en `/api/agent/chat` sin devMode.
- `devModeLimiter` — 30 req/min por IP cuando `devMode=true` y autorizado.
- `execToolLimiter` — sobre `/api/agent/exec-tool`.

Mensajes al cliente: "Demasiadas consultas. Esperá un momento." (HTTP 429).

## 4. Budget soft (épica E)

Implementado en `server/lib/budget.js`. **Default OFF** (`BUDGET_ENABLED=false`).

**Activación gradual**:
1. Setear `BUDGET_ENABLED=true` y solo `BUDGET_TURNS_PER_5MIN=40` para arrancar conservador.
2. Observar logs por 24 h: contar cuántos sessions tocan el cap.
3. Ajustar cap o agregar `BUDGET_TURNS_PER_24H` / `BUDGET_TOKENS_PER_24H`.
4. Si un usuario legítimo es bloqueado, subir el cap antes de desactivar la feature.

**Identity**: el módulo prefiere `conversationId` (estable por pestaña) y cae a IP cuando no hay.

**Mensaje al cliente cuando se excede**:
> "Llegaste al límite de la sesión. Volvé en X minutos o iniciá una nueva conversación."

## 5. Rotación de `API_AUTH_TOKEN`

1. Generar token nuevo: `openssl rand -hex 32`.
2. Subirlo como nuevo valor del secret en GCP Secret Manager (versión nueva).
3. Cloud Run referencia el secret por nombre; redeploy o "rotate revision" hace que tome la última versión.
4. Avisar a cualquier integración externa (MCP, Cursor) que tenía el token viejo.
5. Rotar también en Vercel si el frontend lo guardaba en env de build (no debería — vive en localStorage del operador).

## 6. Si CRM (Sheets) o WhatsApp degradan

- Las tools que dependen de ellos retornan `{ok: false, error: …}`. El modelo recibe el error y debería avisar al usuario.
- Verificar credenciales: `BMC_SHEET_ID` accesible por la service account; `WHATSAPP_ACCESS_TOKEN` no caducado.
- En el peor caso, las tools de escritura quedan bloqueadas pero el chat sigue funcionando para cotizar.

## 7. Logs y observabilidad

- **Estructurados (pino)**: cada turn loggea `tool`, `latencyMs`, `inputTokens`, `outputTokens`, `provider`, `model`, `kbMatchCount`.
- **In-memory** (`server/lib/toolStats.js`): ring buffer de hasta 1000 calls (24 h). Visible en `/api/agent/tool-stats` (devMode). **Se reinicia con cold start** — no usar como fuente histórica.
- **Conversaciones**: si `CHAT_LOG_CONVERSATIONS=true`, persiste en `data/conversations/` (file-based). Revisar retención antes de habilitar en prod por PII.

## 8. Checklist pre-release de cambios al agente

- [ ] `npm run gate:local` verde.
- [ ] Si tocaste `chatPrompts.js` → smoke manual de las 5 preguntas estándar (ver `docs/team/policies/COMERCIAL-CHAT-ML-SHOPIFY.md`).
- [ ] Si tocaste `agentTools.js` → `npm test` corre `tests/agentTools.test.js` y `tests/userIntentClassifier.test.js`.
- [ ] Si agregaste env nueva → documentada en `.env.example` y en este runbook §1.
- [ ] Si tocaste rate limit / budget → observar 24 h antes de subir caps.

## 9. Ver también

- [`docs/team/policies/COMERCIAL-CHAT-ML-SHOPIFY.md`](../policies/COMERCIAL-CHAT-ML-SHOPIFY.md)
- [`docs/team/panelsim/PANELIN-IA-PREFLIGHT-DOSSIER.md`](../panelsim/PANELIN-IA-PREFLIGHT-DOSSIER.md)
- [`docs/team/PROJECT-STATE.md`](../PROJECT-STATE.md) — estado del programa BMC.
