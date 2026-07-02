# Reporte de Conexiones de AI — calculadora-bmc

> **Fecha:** 2026-07-02 · **Repo:** `calculadora-bmc` (backend Express `server/`, frontend Vite `src/`)
> **Alcance:** todas las integraciones de AI/LLM de la app — proveedores, despacho, canales,
> tools nativas, RAG y el control plane de asistentes. Documento de referencia + snapshot operativo.
> **Cómo usarlo:** Parte A = arquitectura (cómo está construido). Parte B = estado (qué está vivo hoy).

---

## Resumen ejecutivo

Toda la AI de la app converge en **un cerebro compartido**: `callAgentOnce()` en
`server/lib/agentCore.js`. Cada superficie (web/Panelin, WhatsApp, email, MercadoLibre, CRM,
wolfboard) le pasa mensajes + un `channel`, y el core recorre una **cadena de fallback de
proveedores** `claude → grok → gemini → openai`, devolviendo la primera respuesta no vacía y
tirando `ALL_PROVIDERS_FAILED` sólo si los cuatro fallan.

Sobre esa base hay **dos capas ortogonales de robustez**:

1. **Capa de proveedores** — dentro de `callAgentOnce` (failover entre LLMs).
2. **Capa de asistentes** — `dispatchAssistant()` (`assistantRegistry.js`) degrada de un asistente
   a otro hasta el `seam` siempre-encendido. Gobernada por el master switch `ASSISTANTS_ACTIVE`.

Y existe una **ruta alternativa unificada**: el **Vercel AI Gateway** (`aiGatewayClient.js`), que
las rutas CRM prefieren si hay token de gateway; si no, caen a la cadena legacy de 4 SDKs.

```
                         ┌─────────────────────────────────────────────┐
  Canales / superficies  │ web  wa  email  ml  crm  wolfboard           │
                         └───────────────┬─────────────────────────────┘
        master switch ASSISTANTS_ACTIVE  │  (gate 503 assistant_disabled)
                         ┌───────────────▼─────────────────────────────┐
   Capa de asistentes    │ dispatchAssistant() → fallback line → seam   │
                         └───────────────┬─────────────────────────────┘
                         ┌───────────────▼─────────────────────────────┐
   Cerebro compartido    │ agentCore.callAgentOnce(messages, {channel}) │
                         └───────────────┬─────────────────────────────┘
        ┌────────────────────────────────┼────────────────────────────────┐
   Capa de proveedores   claude ───────► grok ───────► gemini ───────► openai   (fallback)
        └───────── o vía Vercel AI Gateway (aiGatewayClient) si hay token ──────┘
```

---

# PARTE A — Inventario técnico (arquitectura)

## 1. Proveedores de LLM

Fuente única de verdad: **`server/lib/aiProviderConfig.js`** (elimina el drift de modelos entre
`agentChat`, `aiCompletion`, `autoLearnExtractor`, `aiGatewayClient`, `config.js`).

| Interno  | Label              | Env key             | Modelo default      | Fast/cheap                  | Slug gateway              |
|----------|--------------------|---------------------|---------------------|-----------------------------|---------------------------|
| `claude` | Claude (Anthropic) | `ANTHROPIC_API_KEY` | `claude-opus-4-7`   | `claude-haiku-4-5-20251001` | `anthropic/claude-haiku-4.5` |
| `openai` | OpenAI             | `OPENAI_API_KEY`    | `gpt-4o-mini`       | `gpt-4o-mini`               | `openai/gpt-4o-mini`      |
| `grok`   | Grok (xAI)         | `GROK_API_KEY`      | `grok-3-mini`       | `grok-3-mini`               | `xai/grok-3-mini`         |
| `gemini` | Gemini (Google)    | `GEMINI_API_KEY`    | `gemini-2.5-flash`  | `gemini-2.5-flash`          | `google/gemini-2.5-flash` |

- **Cadena de fallback:** `DEFAULT_PROVIDER_ORDER = ["claude", "grok", "gemini", "openai"]`
  (`aiProviderConfig.js:94`, "best Spanish + tool use first"). `getProviderChain()` (`:152`) la
  filtra dejando sólo proveedores con key presente.
- **Allowlists estrictas por proveedor** (`ALLOWED_MODELS`, `:59-82`) + `resolveModel()` (`:134`):
  si se pide un modelo fuera de la allowlist, cae al default (evita drift/typos).
- **Lección diagnóstica:** `gemini-2.0-flash` fue retirado por Google en 2026-06 ("no longer
  available"); el default es `gemini-2.5-flash` (`:45`). Un modelo retirado se manifiesta como
  `All providers failed`, no como key muerta.
- **Telemetría de costo:** `COST_PER_MILLION` + `estimateCostUSD()` (`:202-235`) por llamada.
- **Helpers expuestos:** `getApiKey`, `getAvailableProviders`, `getProviderChain(preferFast)`,
  `getExtractorModel` (Claude fast para auto-learn), `buildAiOptionsResponse` (alimenta
  `GET /api/agent/ai-options`).

## 2. agentCore — despacho + failover

**`server/lib/agentCore.js`** — "Shared agent brain for all channels".

- `callAgentOnce(messages, opts)` construye la cadena a probar (`:137-146`):
  1. `opts.provider` explícito → sólo ese.
  2. `eff.provider` (vía `taskKey`/override en `waConfig.js`) primero, luego el resto de la cadena central.
  3. si no, `getProviderChain()` completa.
- Recorre la cadena (`:149`), saltea proveedores sin key (`"${p}: no key"`), e importa el SDK
  lazily por proveedor:
  - `claude` → `@anthropic-ai/sdk` `messages.create` (`:164`)
  - `openai` → `openai` `chat.completions.create` (`:178`)
  - `grok`   → SDK `openai` con `baseURL: "https://api.x.ai/v1"` **hardcoded** (`:193`)
  - `gemini` → `@google/generative-ai`, con `thinkingConfig.thinkingBudget: 0` para no gastar
    el presupuesto de tokens en "thinking" oculto (`:204-223`)
- Ante el primer texto no vacío loguea un evento `agent_core_call` (provider/model/latency/costo)
  y retorna (`:225-247`).
- **`ALL_PROVIDERS_FAILED`** (`:255-258`): si la cadena se agota, tira
  `new Error("All providers failed: " + errors.join("; "))` con `err.code` y `err.errors[]`.
- **`CHANNEL_RULES`** (`:26-49`): reglas por canal inyectadas al system prompt —
  `ml` (≤350 chars, sin markdown/URLs/emojis), `wa` (≤800 chars, tono amigable),
  `chat` (sin límite, markdown + tools habilitadas).

**Otras rutas de despacho que reusan el mismo patrón:**
- `server/routes/agentChat.js` — path de **chat SSE streaming** (`POST /api/agent/chat`), con su
  propio loop inline de proveedores y ejecución de tools (Anthropic `tool_use` + Gemini function-calling).
- `server/lib/aiCompletion.js` — `callAiCompletion()` one-shot con `getProviderChain(true)` (modelos fast).
- Consumidores de `callAgentOnce`: `suggestResponse.js`, `routes/wa.js`, `routes/wolfboard.js`, `emailAgentChat.js`.

## 3. Vercel AI Gateway (capa unificada)

**`server/lib/aiGatewayClient.js`** — wrapper fino sobre el `ai` SDK v6.

- **Activación** (`isAiGatewayEnabled()`, `:47-55`): `VERCEL_OIDC_TOKEN` (preferido, auto-rotativo)
  o `AI_GATEWAY_API_KEY` (estático, para Cloud Run). Sin ninguno → `false` y los callers mantienen
  la cadena legacy de 4 SDKs (deploy siempre seguro).
- `DEFAULT_MODEL_SLUG = "anthropic/claude-haiku-4.5"` (`:32`);
  `DEFAULT_PROVIDER_ORDER = ["anthropic","openai","xai","google"]` (`:39`), en sync con
  `CRM_AI_PROVIDER_RANKING` en `bmcDashboard.js`.
- Exporta `generateTextViaGateway` / `generateObjectViaGateway`; consumido por las rutas CRM
  (`/crm/suggest-response`, `/crm/parse-email`, `/crm/ingest-email`) y `agentTraining.js`.

## 4. Canales / superficies wired al cerebro

| Canal                 | Ruta / entry point                                   | Assistant key | Reglas de canal        |
|-----------------------|------------------------------------------------------|---------------|------------------------|
| Web chat (Panelin)    | `routes/agentChat.js` (`/api/agent/chat`, SSE)       | `panelin`     | `chat` (tools ON)      |
| WhatsApp / Omni       | `routes/wa.js` (`callAgentOnce`), `routes/omni.js` (`dispatchAssistant("canales")`) | `wa` / `canales` | `wa` (≤800)  |
| Email (Chatwoot)      | `routes/emailAgentChat.js` (`callAgentOnce`)         | `email`       | `chat`                 |
| MercadoLibre          | `lib/mlAutoAnswer.js` → `suggestResponse.js` → `callAgentOnce` | `ml`  | `ml` (≤350)            |
| CRM dashboard         | `routes/bmcDashboard.js` → `suggestResponse.js` (o gateway) | `ml`    | `ml`                   |
| Wolfboard batch       | `routes/wolfboard.js` (`callAgentOnce`)              | `wolfboard`   | `chat` (batch)         |

`server/lib/suggestResponse.js` es el adaptador fino ML/CRM que resuelve superficie → canal y
delega en `callAgentOnce`.

## 5. Prompt + tools nativas de calculadora

- **Constructor de prompt:** `server/lib/chatPrompts.js` — `buildSystemPrompt(calcState, {channel,...})`
  ensambla identidad ("Panelin"), catálogo, pricing canónico, conocimiento, **brainBlock**,
  **toolsBlock**, protocolo de extracción y ejemplos.
- **toolsBlock ("## TOOLS DE CALCULADORA (OBLIGATORIO)"):** regla dura — todo precio/total que el
  modelo declare **debe** provenir de una tool nativa (`calcular_cotizacion`, `obtener_precio_panel`,
  `presupuesto_libre`, `comparar_listas`), nunca inventado por el LLM.
- **Definición + dispatch de tools:** `server/lib/agentTools.js` — `AGENT_TOOLS[]` (schema
  Anthropic tool_use, ~30 tools) y `executeTool(name, input, calcState, opts)` como dispatcher
  provider-agnóstico.
- **Motor de cálculo nativo:** las tools llaman la superficie in-process `/calc/*` vía
  `server/lib/calcLoopbackClient.js` (`postCotizar`, `postCotizarPdf`, `postPresupuestoLibre` sobre
  `127.0.0.1:${port}`), manteniendo las rutas de cálculo como única fuente de verdad de la
  matemática/BOM/warnings.
- **Paridad Gemini:** `server/lib/geminiTools.js` traduce `AGENT_TOOLS` a `functionDeclarations` de
  Gemini para que el fallback gratuito ejecute las **mismas** tools (no invente texto de tool).
- **Invariante del proyecto:** toda superficie de AII rutea cálculo/cotización/precio por las tools
  nativas; los modelos nunca computan números. Cablear un nuevo proveedor/canal **exige** wiring de
  ejecución de tools (por eso Gemini recibió function-calling).

## 6. Cerebro centralizado (Brain KB)

- **Módulo de lectura:** `server/lib/brainKB.js` — "lessons"/políticas auto-evolutivas verificadas
  por humanos. `brainBlock(query)` rankea por `confidence·0.6 + overlap·0.4` e inyecta el top-N como
  "## CONOCIMIENTO ACUMULADO". Read-only, fail-soft (devuelve `""` si vacío/deshabilitado).
- **Flag:** `VITE_FEATURE_BRAIN` → `config.brainEnabled` (`config.js:359`, default `false`).
- **Fuente:** `gs://bmc-ml-tokens/bmc-brain/lessons.json` (`config.js:360-361`), mantenido por el
  sheet-quote pipeline; `BRAIN_LOCAL_PATH` overridea en dev. Cap de inyección `BRAIN_INJECT_CAP`
  (default 10, `:364`). Se carga fuera del request path (warm load + `setInterval`).
- **Conexión al agente:** `chatPrompts.buildSystemPrompt` inyecta `brainBlock(userText)` cuando
  `config.brainEnabled`; con el flag OFF el prompt es byte-idéntico → todos los canales heredan las
  lecciones transparentemente cuando se enciende.

## 7. Embeddings / Vector / RAG

- **`server/lib/embeddings.js`** — `embedText()` provider-agnóstico. Usa OpenAI
  `text-embedding-3-small` (1536 dims) si `OPENAI_API_KEY` es usable; si no, un **stub
  determinístico hash-based** (misma forma 1536, NO semántico). `isSemanticEmbeddingAvailable()`
  gatea a los callers de RAG real. Cache in-memory por sha256.
- **`server/lib/rag.js`** — `retrieveSimilarQuotes(query, k, threshold)`: embebe la query, corre
  búsqueda **pgvector** cosine (`embedding <=> $1::vector`) sobre la tabla `quote_embeddings`
  (`DATABASE_URL`), y devuelve metadata de leads sanitizada (PII-stripped).
  `formatRetrievedContextForPrompt()` la inyecta en el system prompt de Panelin.
- **Omni knowledge RAG** — `server/lib/omni/knowledge/embedPipeline.js` + `kbBridge.js`: segunda
  superficie RAG, gateada por `isSemanticEmbeddingAvailable()` + `RAG_ENABLED`.
- **Setup/migración:** `scripts/training/embedQuotes.js`;
  `migrations/0001_add_pgvector_and_quote_embeddings.sql`.

## 8. Env vars / API keys (referencia)

Leídas centralmente en `server/config.js` y documentadas en `.env.example`:

- `ANTHROPIC_API_KEY` (+ `ANTHROPIC_CHAT_MODEL`, default `claude-opus-4-7`)
- `OPENAI_API_KEY` (+ `OPENAI_CHAT_MODEL`=`gpt-4o-mini`, `OPENAI_REALTIME_MODEL` para voz)
- `GEMINI_API_KEY` (+ `GEMINI_CHAT_MODEL`=`gemini-2.5-flash`; `BMC_GEMINI_MODEL` para el path de BMC Chat/Sheets)
- `GROK_API_KEY` (+ `GROK_CHAT_MODEL`=`grok-3-mini`)
- Gateway: `AI_GATEWAY_API_KEY` y/o `VERCEL_OIDC_TOKEN`
- Control plane / features: `ASSISTANTS_ACTIVE`, `VITE_FEATURE_BRAIN`, `BRAIN_*`
- Dependencias de asistentes: `CHATWOOT_API_TOKEN` (email), `DATABASE_URL` (wa/RAG), `ML_CLIENT_SECRET` (ml)
- Nota: Grok no tiene env de base-URL — `https://api.x.ai/v1` está hardcoded en `agentCore.js:193`.

---

# PARTE B — Snapshot operativo (qué está vivo hoy)

> **Fuente de datos:** Doppler `bmc-backend/prd` (mirror local de GCP Secret Manager
> `chatbot-bmc-live`) + defaults de código. **Caveat:** el runtime real de Cloud Run
> (`panelin-calc`) lee de GCP directo, y `ASSISTANTS_ACTIVE` / `VITE_FEATURE_BRAIN` podrían estar
> seteados como env vars de Cloud Run fuera de Doppler. Para el estado autoritativo en vivo, ver
> §11 (endpoint `/api/assistants/status`).

## 9. Control Plane de asistentes

**`server/lib/assistantRegistry.js`** declara 7 asistentes (single source of truth):

| Key         | Label                 | Canal  | Dependencia (deps probe)   | Fallback |
|-------------|-----------------------|--------|----------------------------|----------|
| `canales`   | Canales (Omni copilot)| chat   | Omni DB (`DATABASE_URL`)   | `seam`   |
| `panelin`   | Panelin Chat          | chat   | — (sólo provider)          | `seam`   |
| `email`     | Email Agent           | chat   | `CHATWOOT_API_TOKEN`       | `seam`   |
| `wa`        | WhatsApp Cockpit      | wa     | `DATABASE_URL`             | `seam`   |
| `ml`        | MercadoLibre          | ml     | `ML_CLIENT_SECRET`         | `seam`   |
| `wolfboard` | Wolfboard Batch       | chat   | — (sólo provider)          | `seam`   |
| `seam`      | Shared agentCore seam | chat   | — (terminal, siempre ON)   | `null`   |

- **Master switch:** `config.assistantsActive` = `ASSISTANTS_ACTIVE` (comma-split, lowercase),
  **default `canales`** (`config.js:336`). Sólo los keys listados pueden **generar**; `seam`
  siempre habilitado.
- **Gate:** `middleware/requireAssistantEnabled.js` → `503 {reason:"assistant_disabled"}`. Montado
  **sólo en rutas de generación** en `server/index.js:955-960`:
  `/api/agent/chat`→panelin · `/api/email-agent/chat`→email · `/api/wa/suggestions/run` &
  `/api/wa/quotes/run`→wa · `/api/crm/suggest-response`→ml · `/api/wolfboard/quote-batch`→wolfboard.
  El ingest/webhooks quedan **ungated** (un asistente deshabilitado sigue recibiendo, sólo deja de responder).
- **Failover de asistentes:** `dispatchAssistant()` recorre `ASSISTANT_PRIORITY` saltando los
  deshabilitados hasta el `seam` (que sólo requiere una key de proveedor). `canales-only` se mantiene
  `canales-only` (los deshabilitados nunca se promueven).
- **Health:** `GET /api/assistants/status` (admin-gated, cache ~30s, `?deep=1` bypass) →
  `routes/assistantsStatus.js` + `lib/assistantHealth.js`. Admin UI: `/hub/admin/assistants`
  (`src/components/hub/admin/AssistantsStatusPanel.jsx`, polling 15s).

## 10. Estado run-time observado (2026-07-02)

**API keys presentes en `bmc-backend/prd`:**

| Secret                | Presente | Efecto                                                        |
|-----------------------|:--------:|--------------------------------------------------------------|
| `ANTHROPIC_API_KEY`   | ✅       | Claude disponible (primero en la cadena)                     |
| `GROK_API_KEY`        | ✅       | Grok disponible (2º)                                         |
| `GEMINI_API_KEY`      | ✅       | Gemini disponible (3º)                                       |
| `OPENAI_API_KEY`      | ✅       | OpenAI disponible (4º) + embeddings semánticos ON            |
| `DATABASE_URL`        | ✅       | Omni/wa DB + RAG pgvector operativos                         |
| `ML_CLIENT_SECRET`    | ✅       | Dependencia de `ml` satisfecha                               |
| `AI_GATEWAY_API_KEY`  | ❌       | Gateway OFF                                                  |
| `VERCEL_OIDC_TOKEN`   | ❌       | Gateway OFF                                                  |
| `CHATWOOT_API_TOKEN`  | ❌       | Dependencia de `email` (Chatwoot) **sin satisfacer**        |

**Derivados:**
- **Cadena efectiva de proveedores:** las 4 keys presentes → `getProviderChain()` =
  `claude → grok → gemini → openai` (completa). Robustez de fallback máxima.
- **Vercel AI Gateway: OFF** (sin `AI_GATEWAY_API_KEY` ni `VERCEL_OIDC_TOKEN`). Las rutas CRM usan
  la cadena legacy de 4 SDKs.
- **`ASSISTANTS_ACTIVE`: no seteado en Doppler → default `canales`.** Bajo ese default, sólo
  `canales` genera; `panelin`, `email`, `wa`, `ml`, `wolfboard` devuelven `503 assistant_disabled`
  en sus rutas de generación (el `seam` sigue siempre disponible como red terminal).
  ⚠️ **Verificar en vivo** (§11): Cloud Run podría tener `ASSISTANTS_ACTIVE` seteado más amplio como
  env var fuera de Doppler.
- **`VITE_FEATURE_BRAIN`: no seteado → default `false`.** El Brain KB ship dormido; el prompt es
  byte-idéntico al de sin-brain. ⚠️ mismo caveat de verificación en vivo.

## 11. Matriz de salud por asistente (según defaults observados)

| Asistente   | Canal | Dependencia        | Dep OK (Doppler) | Habilitado (default `canales`) | Provider chain | Fallback |
|-------------|-------|--------------------|:----------------:|:------------------------------:|----------------|----------|
| `canales`   | chat  | Omni DB            | ✅               | ✅ (activo)                    | claude→…→openai| seam     |
| `panelin`   | chat  | —                  | n/a              | ❌ (503) *verificar*           | claude→…→openai| seam     |
| `email`     | chat  | `CHATWOOT_API_TOKEN`| ❌ (degradado)  | ❌ (503) *verificar*           | claude→…→openai| seam     |
| `wa`        | wa    | `DATABASE_URL`     | ✅               | ❌ (503) *verificar*           | claude→…→openai| seam     |
| `ml`        | ml    | `ML_CLIENT_SECRET` | ✅               | ❌ (503) *verificar*           | claude→…→openai| seam     |
| `wolfboard` | chat  | —                  | n/a              | ❌ (503) *verificar*           | claude→…→openai| seam     |
| `seam`      | chat  | — (terminal)       | n/a              | ✅ siempre                     | claude→…→openai| —        |

> Nota sobre `email`: su probe de salud depende de `CHATWOOT_API_TOKEN` (integración Chatwoot,
> dormida). El Email Operations Manager en prod opera vía Gmail OAuth evolucionando Omni/`canales`,
> no vía este probe — por eso `email` puede figurar degradado aunque el flujo de email esté vivo por
> otro camino. Revisar si el probe sigue siendo el indicador correcto.

### Verificación autoritativa en vivo

Para el estado real de Cloud Run (que puede diferir de Doppler), consultar el endpoint admin:

```bash
# Requiere token admin (secret API_AUTH_TOKEN en GCP Secret Manager, proyecto chatbot-bmc-live)
curl -s "https://<panelin-calc-url>/api/assistants/status?deep=1" \
  -H "Authorization: Bearer $API_AUTH_TOKEN" | jq
```

o abrir **`/hub/admin/assistants`** en la app (polling cada 15s, badges enabled/health + provider
sirviendo + fallback target por asistente).

---

## Índice rápido de archivos

- **Proveedores / core:** `server/lib/aiProviderConfig.js`, `agentCore.js`, `aiCompletion.js`, `aiGatewayClient.js`
- **Control plane:** `server/lib/assistantRegistry.js`, `assistantHealth.js`, `routes/assistantsStatus.js`, `middleware/requireAssistantEnabled.js`, `src/components/hub/admin/AssistantsStatusPanel.jsx`
- **Prompt / tools:** `server/lib/chatPrompts.js`, `agentTools.js`, `geminiTools.js`, `calcLoopbackClient.js`, `channelRenderer.js`, `suggestResponse.js`
- **Brain KB:** `server/lib/brainKB.js` (flag `VITE_FEATURE_BRAIN`)
- **Embeddings / RAG:** `server/lib/embeddings.js`, `rag.js`, `omni/knowledge/embedPipeline.js`, `kbBridge.js`
- **Canales:** `routes/agentChat.js`, `omni.js`, `wa.js`, `emailAgentChat.js`, `mlAutoAnswer.js`, `wolfboard.js`, `bmcDashboard.js`
- **Config:** `server/config.js`, `.env.example`, `server/index.js` (gates `:955-960`)
