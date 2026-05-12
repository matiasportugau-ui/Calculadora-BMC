# KB Multi-canal y Admin — Design Brief v2

> **Estado:** research + diseño (no implementación).
> **Fecha:** 2026/05/07.
> **Plan origen:** `.cursor/plans/kb_multi-canal_y_admin_e4f12975.plan.md`.
> **Objetivo del brief:** consolidar inventario actual + benchmark internacional + análisis profundo de Vercel AI SDK / AI Gateway con FODA, antes de tocar código de la Fase 1.
>
> **Qué cambia respecto al plan original:** mantenemos el alcance (resolver multi-superficie, cableado de chat y `suggest-response`, Admin con cobertura por canal, doc operativa), pero subimos el techo de calidad: la implementación toma patrones probados por Intercom Fin / Inkeep / Glean / Langfuse, y abre la puerta a unificar la capa multi-provider de IA detrás de Vercel AI Gateway.

---

## 1. Inventario actual del repo

Verificado por `Read` y `grep` el 2026/05/07. Líneas y firmas son las que existen hoy en `main` (commit `c609653`).

| # | Archivo | Líneas relevantes | Qué hace hoy | Qué tocará el plan | Riesgo de regresión |
|---|---------|------------------|---------------|--------------------|---------------------|
| 1 | `server/lib/trainingKB.js` | 192–223 (`addTrainingEntry`), 243–272 (`updateTrainingEntry`), 368–407 (`findRelevantExamples`), 437–449 (`getHealthEntries`), 451–488 (`getTrainingStats`) | Persistencia local + GCS, CRUD de entries, scoring por overlap (sólo sobre `question`/`context`/`goodAnswer`), conflictos, health (`stale`, `zeroRetrieval`, `mlGap`), `KB_VERSION = "1.0.0"`. Los campos `goodAnswerML` / `goodAnswerWA` ya existen en el shape pero **no son consumidos** por ningún lector. | Añadir `resolveTrainingAnswer(entry, surface)`. Extender scoring opcional. Añadir `waGap` simétrico al `mlGap` actual. Documentar `surface` enum. | Bajo: el resolver es aditivo. El cambio de scoring (incluir overrides) puede mover ranking — necesita test de regresión sobre el dataset actual (456 líneas en `data/training-kb.json`). |
| 2 | `server/lib/chatPrompts.js` | 426–538 (`buildSystemPrompt`), 473–489 (bloque `## CORRECCIONES DE ENTRENAMIENTO`) | El bloque sólo serializa `entry.goodAnswer` (línea 482). Ignora `goodAnswerML` y `goodAnswerWA`. | El llamador (`agentChat`) debe mapear los entries antes de pasarlos. **Cero cambios** dentro de `buildSystemPrompt` si el resolver se aplica antes — preferido para no romper la firma. | Muy bajo si el resolver se aplica fuera. Si se mete acá, sí hay riesgo (función ya hace mucho). |
| 3 | `server/routes/agentChat.js` | 29 (import `findRelevantExamples`), 655 (llamada con `limit: 5`), 658 (`buildSystemPrompt(...)`) | SSE, no acepta `surface` en body. Los entries van crudos al prompt. | Aceptar `surface` opcional con whitelist (`zod` o validación manual). Mapear con resolver antes de `buildSystemPrompt`. Default `panelin_chat`. | Bajo si default = `panelin_chat` y campo nuevo es opcional. Necesita test de regresión SSE. |
| 4 | `server/routes/bmcDashboard.js` | 2088–2216 (`POST /api/crm/suggest-response`) | System prompt fijo y corto (línea 2143). 4 SDKs separados (Anthropic, OpenAI, Grok, Gemini) con `for...of` chain (líneas 2156–2213). **No** importa ni llama `findRelevantExamples`. `historyContext` (líneas 2117–2141) usa Sheets para Q&A previos del mismo cliente. | Importar `findRelevantExamples` y `resolveTrainingAnswer`. Inyectar bloque KB compacto (`limit: 3`) usando texto resuelto para `surface=mercado_libre`. Opcional: refactor de los 4 SDKs a Vercel AI Gateway (ver §5). | Medio: cambia el prompt → puede mover el comportamiento de las respuestas en producción. Necesita evaluación A/B con dataset de consultas reales del CRM. |
| 5 | `server/routes/agentTraining.js` | 279–286 (`/training-kb/health`), 350–357 (`/conflicts`), 374–414 (`/generate-ml-overrides`) | Endpoints admin existentes. Auto-ML override usa Claude Haiku, prompt fijo "máximo 320 caracteres para MercadoLibre". | Añadir endpoint `GET /agent/training-kb/analytics` (agregados pre-computados para Admin). Opcional: simétrico `/generate-wa-overrides`. | Bajo: endpoint nuevo, no rompe los existentes. |
| 6 | `src/components/AgentAdminModule.jsx` | 510–565 (Salud y volumen + stats bar), 570–580 (botón Auto-ML), 1170–1180 (`bySource`), 1327–1435 (HealthTab), 2035 (tab "🩺 Salud KB"), 2136 (`<HealthTab />`) | Stats bar (Total, Sales, Producto, Math, Pendientes, Vencidas, Sin uso 30d, Gap ML, Score 0-100). Botón Auto-ML que llama `/generate-ml-overrides`. HealthTab con 3 secciones: stale, zeroRetrieval, mlGap. **No** tiene gráficos ni cobertura WA. | Añadir cobertura `waGap`, **matriz de cobertura por canal** (% con override ML/WA por categoría), tendencia 14-30d (si añadimos series), gráficos. | Bajo si los nuevos cards/charts se agregan junto a los existentes. |
| 7 | `data/knowledge/*.md` | 5 archivos: `encuentros-tecnicos`, `fichas-tecnicas`, `mantenimiento-y-comparativas`, `preguntas-frecuentes-clientes`, `proceso-constructivo` | Cargados por `loadKnowledgeDocs()` y embebidos en `buildSystemPrompt`. **Comunes a todas las superficies** — no surface-aware. | Fuera de alcance Fase 1-3: estos son hechos canónicos. La diferenciación por canal vive en la KB operativa (`training-kb.json`), no acá. | N/A — no se tocan. |
| 8 | `docs/team/panelsim/knowledge/` | 7 archivos existentes | KB documental para humanos / agentes. | Agregar este brief + actualizar `ML-TRAINING-SYSTEM.md` con la matriz superficie↔prompt↔campo KB. | N/A. |

**Detalle del shape de un entry KB hoy** (`server/lib/trainingKB.js:195–214`):

```js
{
  id, category, question, badAnswer, goodAnswer, context, source, permanent,
  status, confidence, convId,
  goodAnswerML,   // ← existe pero NO se lee desde ningún rendering path
  goodAnswerWA,   // ← idem
  retrievalCount, lastRetrievedAt, reviewDueAt,
  conflictWith,
  createdAt, updatedAt,
}
```

**Persistencia confirmada:** `K_SERVICE` env (Cloud Run) + `GCS_KB_BUCKET` activan el modo GCS con cache de 60s y mirror local en `data/training-kb.json`. Backup/import endpoints existen. (`trainingKB.js:22–25, 87–117`).

---

## 2. Brechas confirmadas vs el plan original

Mapeo 1:1 a los 5 todos del `.plan.md`. Estado verificado por `grep` el 2026/05/07.

| Todo | Estado real | Brecha exacta |
|------|-------------|---------------|
| `resolver-kb-surface` | ❌ No existe | No hay símbolo `resolveTrainingAnswer` ni `kbSurfaceResolve` en `server/`, `src/`, ni `tests/`. Falta toda la función + tests. |
| `wire-agent-chat-surface` | ❌ No cableado | `agentChat.js:655` sigue siendo `findRelevantExamples(lastUserMessage, { limit: 5 })`. Body no acepta `surface`. `buildSystemPrompt` sigue serializando sólo `goodAnswer` (`chatPrompts.js:482`). |
| `wire-suggest-response-kb` | ❌ No cableado | `bmcDashboard.js:2088` no importa `findRelevantExamples`. System prompt fijo. Sólo usa `historyContext` del mismo cliente desde Sheets. |
| `admin-health-dashboard` | ⚠️ Parcial (~40%) | Existe tab "🩺 Salud KB" con stats, score y Auto-ML para `mlGap`. **Falta**: cobertura WA (`waGap`), matriz por canal (% override ML/WA por categoría), gráficos (sólo cards numéricos), endpoint `/analytics` con agregados pre-computados, tendencia temporal. |
| `docs-operativa` | ❌ No existe | Sin documento que describa la matriz superficie↔prompt↔campo KB ni checklist consolidado de envs (`GCS_KB_BUCKET`, `GCS_KB_OBJECT`, `K_SERVICE`, `API_AUTH_TOKEN`/`VITE_API_AUTH_TOKEN`, claves IA). |

**Conclusión:** la base existe (CRUD, persistencia, health), pero los **3 cables principales** que activan el valor del plan están sin conectar. Una vez conectados, el módulo se vuelve diferencial.

---

## 3. Benchmark completo (research a fondo)

Este módulo es palanca competitiva: el negocio quiere que la misma "verdad" se exprese distinto en Mercado Libre, WhatsApp, email y chat web sin duplicar entries. Lo que sigue documenta cómo lo resuelven los referentes internacionales y qué nos llevamos.

### 3.1 Surface-aware response resolution — Intercom Fin

**Patrón:** una sola fuente de verdad ("knowledge layer") + **Guidance Cards** con un selector de canal embebido. El operador escribe la regla en lenguaje natural y marca a qué canal aplica.

**Hallazgo clave de la doc oficial** ([Intercom Help — Provide Fin AI Agent with specific guidance](https://www.intercom.com/help/en/articles/10210126-provide-fin-ai-agent-with-specific-guidance)):

> "Simply choose which channels (Chat, Email, or Voice) the guidance should apply to directly on the card."

**Data model documentado:**
- `channels: ["Chat" | "Email" | "Voice"]`
- `audience` (segmento de usuarios)
- `attributes` (filtros por usuario / empresa / conversación)
- `content references` (links a sources)
- `status`: draft / paused / live
- Límite: **2 500 caracteres** por card.

**Arquitectura:** "Fin AI Engine" — sistema de 3 capas (retrieval con modelo propio `fin-cx-retrieval` + generation + learning). La misma KB sirve a Chat / Email / Voice; lo que cambia son las guidance cards aplicadas según canal. Resolución promedio 66% en 6 000+ clientes ([Intercom Blog — Fin 3](https://www.intercom.com/blog/whats-new-with-fin-3/), 2026).

**Qué tomamos:**
1. Misma KB canónica + variantes por canal (no duplicar entries).
2. Selector de canal como atributo de primer orden, no como tag suelto.
3. Límite duro de caracteres por canal (Intercom: 2 500 chars; nosotros: ML 350, WA 700, chat sin límite).

### 3.2 Multi-channel knowledge reuse — Inkeep

**Patrón:** una KB indexada con sources (Notion, Confluence, Slack, GitHub, sitios) → publicada en N superficies (web embed, Discord, Slack, MCP server). Misma fuente, distinto wrapper.

**Confirmado por su blog** ([Inkeep — Multi-Channel Knowledge Reuse](https://inkeep.com/blog/multi-channel-knowledge-reuse-scale-ai-support-across-slack), 2026):

> "Inkeep can deploy AI that indexes Slack conversations across all channels, cites sources for verification, and auto-syncs with existing knowledge bases."

**Analytics dashboard:** trending topics, gaps en docs, thumbs up/down, conversation logs por canal ([Inkeep docs](https://docs.inkeep.com/cloud/overview/ai-for-customers)).

**Qué tomamos:**
1. **Trending topics por canal** como métrica del dashboard de Salud KB.
2. **Gap detection** — preguntas recurrentes sin entry KB (lo opuesto al `zeroRetrieval` actual: queries sin match).
3. **Citations** opcionales: cada respuesta enlaza al entry KB usado (ya tenemos `kb_match` event en SSE en devMode — `agentChat.js:658`, falta surfacearlo en producción).

### 3.3 Channel-based answers — Glean

**Patrón:** Glean en Slack responde de forma **proactiva sólo cuando tiene confianza alta**, configurable por canal con `/glean configure` ([Glean docs — Respond in Slack channels](https://docs.glean.com/administration/platform/embedded-integrations/slackbot/use-glean-in-slack/respond-in-slack-channels)).

**Limitación documentada:** Glean indexa, no autora variantes. Lo cita Capacity 2026 review:

> "Glean primarily excels in searching and aggregating existing internal data — but it doesn't let users create or manage knowledge within the platform."

**Qué tomamos:**
1. **Confidence threshold** por superficie. Hoy `findRelevantExamples` devuelve top-K sin importar el score absoluto (`trainingKB.js:381`). En ML/WA conviene un mínimo de score para inyectar al prompt — si no hay match fuerte, mejor que el modelo improvise sin "ruido KB".
2. **Per-channel toggle** de respuesta automática (Glean lo hace por canal Slack). Análogo: en `suggest-response` la decisión de inyectar bloque KB puede ser opt-out por categoría.

### 3.4 Retrieval scoring + re-ranking — LangChain `EnsembleRetriever`

**Patrón:** combinar BM25 (keyword) + dense (embeddings) con pesos y reciprocal rank fusion (RRF). Es el patrón estándar 2024–2026 para RAG productivo ([LangChain docs — How to use the EnsembleRetriever](https://docs.langchain.com/oss/python/langchain/overview), referencia técnica).

**Por qué nos importa:** nuestro `scoreOverlap` actual (`trainingKB.js:177–190`) es **token overlap puro**, sin BM25 ni embeddings. Para 456 líneas de KB funciona; pero conforme crece (objetivo 500+ entries), el ranking se va a degradar. RRF con dos retrievers (overlap + embedding-based) sobre la misma KB es upgrade barato.

**Qué tomamos:**
1. Mantener `scoreOverlap` como retriever rápido baseline.
2. Añadir un retriever de embeddings (vía `voyage` o `openai/text-embedding-3-small` por AI Gateway) como segundo canal.
3. Fusionar con RRF; el límite del prompt sigue en 5 entries.

### 3.5 Re-ranking con Cohere o BGE

**Cohere Rerank v4.0** ([Cohere docs — Rerank](https://docs.cohere.com/v2/docs/rerank-2)):
- Modelos: `rerank-v4.0-pro` (alta calidad) y `rerank-v4.0-fast` (alta latencia/throughput).
- Multilingüe nativo (incluye español).
- Context limit: **4 096 tokens** combinando query + document.
- API REST + SDK Node (`cohere-ai` v8.0.0, abr 2026).
- Latencia típica: < 200 ms por batch de 50 docs.

**BGE-reranker-v2-m3** ([HuggingFace — BAAI/bge-reranker-v2-m3](https://huggingface.co/BAAI/bge-reranker-v2-m3)):
- Open-source Apache 2.0, 0.6B parámetros, multilingüe (100+ idiomas).
- **No corre en transformers.js** (requiere PyTorch). Para Cloud Run Node.js → **descartado** salvo que metamos un sidecar Python o llamada a HF Inference API.

**Qué tomamos:** Cohere Rerank si decidimos avanzar a re-ranking real; descartamos BGE local por incompatibilidad runtime.

### 3.6 Variant schema (cómo guardar `responseBySurface`) — Notion / Glean / Guru

No hay un estándar abierto, pero la convergencia entre los 3 referentes es:

```json
{
  "id": "...",
  "question": "...",
  "context": "...",
  "responses": {
    "default": "Texto canónico largo, formato libre.",
    "mercado_libre": "Versión corta < 350 chars, sin URLs.",
    "whatsapp":      "Versión semi-formal < 700 chars, emojis permitidos.",
    "email":         "Versión formal con saludo y firma."
  }
}
```

**Cita relevante** — Guru documentó su modelo "Verified Answers + Variants" en su engineering blog (2024). El patrón se replica en Notion AI Knowledge (variantes por workspace) y en Glean answer cards.

**Qué tomamos:** estructura `responses` con clave `default` + overrides por surface. Migración suave desde el shape actual (`goodAnswer` → `responses.default`, `goodAnswerML` → `responses.mercado_libre`, `goodAnswerWA` → `responses.whatsapp`). Resolver hace fallback a `default` si no hay override.

### 3.7 Context compression / token budgeting — Anthropic prompt caching

**Patrón:** marcar bloques estables del system prompt con `cache_control: { type: 'ephemeral' }`. Anthropic cachea por 5 min y cobra el 90% menos en lecturas ([Vercel AI Gateway docs — Anthropic Messages API · Prompt caching](https://vercel.com/docs/ai-gateway/sdks-and-apis/anthropic-messages-api)).

**Por qué nos importa:** nuestro `buildSystemPrompt` mete `CATALOG`, `IDENTITY`, `WORKFLOW`, `loadKnowledgeDocs()` y `canonicalPrices` en cada turno. Eso ronda los **15-25k tokens estables**. Hoy se paga full en cada turno.

**Qué tomamos:** marcar como `cache_control` los bloques estables (todo lo que no es `currentState` ni `examplesBlock`). Reducción estimada del 60–70% en costo de input tokens si pasamos por AI Gateway con caching.

### 3.8 Prompt versioning + observability — Langfuse

**Patrón:** SDK que envuelve las llamadas LLM (drop-in sobre OpenAI/Anthropic SDK), logs traces con tokens / latencia / costo, gestiona prompts versionados con A/B y datasets para evals ([Langfuse docs](https://langfuse.com/docs)).

**Stack abierto:** MIT, 26.8k stars, 559 releases, self-hosted gratuito por Docker Compose ([github.com/langfuse/langfuse](https://github.com/langfuse/langfuse)).

**Qué tomamos:** considerar Langfuse self-hosted en Cloud Run para tener:
1. **Traces de KB retrieval** (qué entries se inyectaron en qué turn, score de cada uno).
2. **A/B de variantes ML/WA** (medir thumbs up/down por superficie).
3. **Dataset de regresión** para `findRelevantExamples` antes de cambiar scoring.

### 3.9 Conflict detection — Guru "Verified Answers"

**Patrón:** una pregunta sólo puede tener **un** answer "verified" activo. El sistema detecta nuevos answers que contradicen verified existentes y bloquea hasta resolución manual.

**Estado actual nuestro:** `detectConflicts` (`trainingKB.js:314–332`) ya hace algo similar (≥3 token overlap en question + ≤2 overlap en answer = conflicto). El endpoint `/training-kb/conflicts` lo expone.

**Qué tomamos:** elevar conflictos a la pestaña Salud KB con CTA "resolver" (ya existe el endpoint `/resolve-conflict`). Hoy está enterrado.

### 3.10 Resumen del benchmark

| Patrón | Fuente | Cómo lo aplicamos |
|--------|--------|-------------------|
| Channel selector por entry | Intercom Fin | `responses` map con `default` + overrides por surface |
| Trending topics + gap detection | Inkeep | Endpoint `/analytics` con queries sin match |
| Confidence threshold por canal | Glean | Mínimo `matchScore` para inyectar bloque KB |
| BM25 + dense retrieval (RRF) | LangChain | Segundo retriever de embeddings, fusionar |
| Cross-encoder rerank | Cohere Rerank v4 | Top-N → top-K rerank antes de prompt |
| `responseBySurface` schema | Guru / Notion / Glean | Migrar campos sueltos a map |
| Prompt caching estable | Anthropic via AI Gateway | `cache_control` en bloques estables |
| Prompt versioning + traces | Langfuse | SDK envuelve llamadas, trace por turn |
| Verified-answer conflicts | Guru | Surface conflictos en Admin con CTA |

---

## 4. Librerías open-source candidatas (auditadas)

Auditoría hecha el **2026/05/07** vía `npm view` y `gh`. Filtro de calidad: licencia permisiva, último release < 6 meses, mantenedor activo.

| Librería | Versión | Último release | Licencia | Encaje Express+React/Vite | Decisión |
|----------|---------|----------------|----------|---------------------------|----------|
| `ai` (Vercel AI SDK) | 6.0.176 | 2026/05/07 | Apache-2.0 | ✅ Cookbook oficial Express ([ai-sdk.dev/cookbook/api-servers/express](https://ai-sdk.dev/cookbook/api-servers/express)) | **Adoptar** (ver §5) |
| `@ai-sdk/anthropic` | 3.0.76 | 2026/05/07 | Apache-2.0 | ✅ | **Adoptar como provider directo o como BYOK por AI Gateway** |
| `langchain` | 1.4.0 | 2026/05/05 | MIT | ⚠️ Pesado para nuestro uso | **Inspirarse** (RRF, EnsembleRetriever) sin instalar |
| `@langchain/core` | 1.1.45 | 2026/05/07 | MIT | ✅ pero overkill | **Descartar** — sumamos peso sin necesidad |
| `llamaindex` (TS) | 0.12.1 | 2025/12/31 | MIT | ✅ | **Inspirarse** sin instalar |
| `fuse.js` | 7.3.0 | 2026/04/28 | Apache-2.0 | ✅ Liviano (3kb) | **Adoptar** si hace falta fuzzy match en query |
| `minisearch` | 7.2.0 | 2025/09/16 | MIT | ✅ Pequeño, BM25-ish | **Adoptar** como segundo retriever local |
| `flexsearch` | 0.8.212 | 2025/09/06 | Apache-2.0 | ✅ Más rápido que minisearch | Alternativa a minisearch |
| `zod` | 4.4.3 | 2026/05/04 | MIT | ✅ Ya estándar | **Adoptar** para validar `surface` enum y body de chat |
| `valibot` | 1.4.0 | 2026/05/05 | MIT | ✅ Más liviano que zod | Alternativa a zod si querés bundle pequeño |
| `recharts` | 3.8.1 | 2026/03/25 | MIT | ✅ Estándar React | **Adoptar** para gráficos del Admin |
| `@tremor/react` | 3.18.7 | 2025/01/13 | Apache-2.0 | ⚠️ Stale (>15 meses sin release) | **Descartar** |
| `@huggingface/transformers` | 4.2.0 | 2026/04/22 | Apache-2.0 | ⚠️ Pesado, modelos limitados | **Descartar** para BGE-reranker (incompatible) |
| `@xenova/transformers` | 2.17.2 | 2024/05/29 | Apache-2.0 | ⚠️ Reemplazado por `@huggingface/transformers` | **Descartar** |
| `langfuse` | 3.38.20 | 2026/04/01 | MIT | ✅ SDK Node nativo | **Adoptar** (self-hosted o cloud free tier) |
| `@helicone/helicone` | 3.1.2 | 2025/10/22 | Apache-2.0 | ✅ Drop-in OpenAI-compat | Alternativa a Langfuse — preferimos Langfuse por madurez (26.8k vs 5.6k stars) |
| `@portkey-ai/gateway` | 1.15.2 | 2026/01/12 | MIT | ✅ Self-hosted gateway | **Comparar en §5** vs Vercel AI Gateway |
| `@openrouter/ai-sdk-provider` | 2.9.0 | 2026/04/28 | Apache-2.0 | ✅ Provider para AI SDK | Alternativa simple si no queremos Vercel-stack |
| `cohere-ai` | 8.0.0 | 2026/04/01 | (revisar) | ✅ Para rerank | **Adoptar** sólo si activamos rerank (Fase posterior) |

**Observaciones clave:**
- **AI Gateway elimina la necesidad de instalar 3-4 SDKs adicionales** — un solo `apiKey` + `baseURL` cubre Anthropic + OpenAI + Grok + Gemini.
- `langfuse` es el único candidato de observabilidad con una comunidad y release cadence claramente sostenidos.
- `recharts` es la apuesta segura para gráficos del Admin (Tremor está stagnant).

---

## 5. Análisis profundo: Vercel AI SDK + AI Gateway

### 5.1 Qué es y qué resuelve hoy (mayo 2026)

**Vercel AI SDK** ([ai-sdk.dev](https://ai-sdk.dev/)) es una capa de abstracción TypeScript/JS sobre proveedores LLM. APIs core:
- `generateText`, `streamText` — texto y streaming.
- `generateObject`, `streamObject` — salida estructurada con schema (zod).
- `tool({ description, inputSchema, execute })` — function calling unificado.
- Integraciones de framework: Next.js, **Node.js (Express/Hono/Fastify/Nest)**, Svelte, Vue/Nuxt, Expo.

**Vercel AI Gateway** ([vercel.com/docs/ai-gateway](https://vercel.com/docs/ai-gateway)) es el endpoint unificado:
- Una sola API key, **40+ proveedores** (anthropic, openai, xai, google, cohere, voyage, mistral, groq, bedrock, vertex, …).
- BYOK soportado a nivel request (`providerOptions.gateway.byok.<provider>`).
- **Sin markup** — el token cuesta lo mismo que en el provider directo.
- Drop-in para SDKs existentes: Anthropic Messages, OpenAI Chat Completions, OpenAI Responses — sólo cambia `baseURL`.
- Provider routing/fallback: `providerOptions.gateway.order`, `only`, `sort: "cost" | "ttft" | "tps"`.
- Caching automático (`caching: 'auto'`) para Anthropic prompt caching.
- Observability incluida (overview de spend, traces).

### 5.2 Encaje con nuestro stack

**Confirmado por la doc oficial** ([AI SDK Foundations Overview](https://ai-sdk.dev/docs/foundations/overview), [Cookbook — Express](https://ai-sdk.dev/cookbook/api-servers/express)):

> "Node.js" es un getting-started oficial. Express tiene cookbook dedicado.

Patrón mínimo confirmado:

```js
// server/routes/agentChat.js — versión simplificada con AI SDK
import { streamText } from 'ai';

router.post("/agent/chat", async (req, res) => {
  const result = streamText({
    // Vercel AI Gateway slug: provider/model con dots (no hyphens) en la versión.
    model: 'anthropic/claude-haiku-4.5',
    system: systemPrompt,
    messages: filteredMsgs,
    tools: AGENT_TOOLS_AI_SDK,
    providerOptions: {
      gateway: { order: ['anthropic', 'openai', 'xai', 'google'] },
    },
  });
  result.pipeUIMessageStreamToResponse(res);
});
```

**No requiere migrar a Next.js.** El backend Express 5 + frontend React/Vite siguen como están. El SDK es agnostic.

### 5.3 Costo de migración por archivo

#### `server/routes/bmcDashboard.js` — `/crm/suggest-response` (líneas 2088–2216)

Hoy: ~130 líneas con 4 bloques `if (p === "claude") / "openai" / "grok" / "gemini"`, cada uno con `import` dinámico, instanciación de cliente, llamada `messages.create` o `chat.completions.create`, manejo de respuesta.

Con AI Gateway:
```js
import { generateText } from 'ai';

const { text, providerMetadata } = await generateText({
  model: provider ? `${provider}/${MODEL_BY_PROVIDER[provider]}` : 'anthropic/claude-haiku-4.5',
  system: systemPrompt,
  messages: [{ role: 'user', content: userMsg }],
  maxOutputTokens: 300,
  providerOptions: {
    gateway: { order: ['anthropic', 'openai', 'xai', 'google'] },
  },
});
return res.json({ ok: true, respuesta: text, provider: providerMetadata?.gateway?.provider });
```

**Reducción estimada:** ~130 LOC → ~25 LOC. Elimina 4 imports dinámicos. Fallback automático sin escribir loops.

#### `server/routes/bmcDashboard.js` — `/crm/parse-email` (líneas 2219–2292)

Mismo patrón que `suggest-response`. ~75 LOC → ~20 LOC con `generateObject` + zod schema (estructurado nativo).

#### `server/routes/agentChat.js` (líneas 1-700)

Más invasivo: hay tools (AGENT_TOOLS), SSE custom con eventos `kb_match`, `approved_actions`, `info`, `text`, `action`, `suggestions`, `done`, `error`. Migración total no es ROI claro **en Fase 1**. **Recomendación:** dejar `agentChat.js` con su SDK directo en Fase 1 y migrar sólo `bmcDashboard.js`. Reevaluar `agentChat.js` en una Fase 4 con benchmark de SSE custom vs `pipeUIMessageStreamToResponse`.

#### `server/routes/agentTraining.js` — `/generate-ml-overrides` (líneas 374–414)

Trivial: `await client.messages.create(...)` → `await generateText(...)`. ~5 LOC tocadas.

#### Tests / env vars

- **Auth recomendada — OIDC.** Correr `vercel env pull` en CI/local. Las credenciales OIDC se rotan solas y se inyectan como `VERCEL_OIDC_TOKEN`; el gateway las acepta vía `Authorization: Bearer`. **Cero secretos estáticos a rotar manualmente** y aplica least-privilege por deployment.
- **API key estática — sólo si OIDC no es viable.** Generar una sola key del gateway desde la consola de Vercel y mantenerla en Secret Manager. Documentar la cadencia de rotación.
- **Claves directas a cada provider — descontinuadas en el patrón recomendado.** Toda la auth pasa por el gateway con OIDC. Si en algún caso quisieras bypass (no es lo recomendado), se puede hacer BYOK request-scoped (`providerOptions.gateway.byok`) **sin** necesidad de almacenar claves a nivel de deployment.
- Tests `tests/api/*.js` necesitan mock de `ai-gateway.vercel.sh` (o usar `nock`/`msw`). Estimado: 1 a 2 días.

#### Total estimado de migración

| Archivo | LOC actuales | LOC tras migración | Esfuerzo |
|---------|--------------|--------------------|----------|
| `bmcDashboard.js` (suggest-response + parse-email + ingest-email) | ~250 | ~80 | 1 día |
| `agentTraining.js` (generate-ml-overrides + auto-learn) | ~80 | ~50 | 0.5 día |
| Env vars + secrets Cloud Run/Vercel | — | — | 0.25 día |
| Tests | — | — | 1 día |
| `agentChat.js` (opcional, Fase 4) | ~700 | ~350 | 3-5 días |
| **Total Fase 3 sin agentChat** | | | **~3 días** |

### 5.4 Comparativo de gateways / abstractions

| Producto | Open source | Self-hosted | Hosted | Markup tokens | Provider count | Anthropic prompt caching | Express compat | Observability incluida |
|----------|-------------|-------------|--------|---------------|----------------|--------------------------|----------------|------------------------|
| **Status quo** (4 SDKs) | — | — | — | 0% | 4 (los que cableamos) | Sí, manual | ✅ ya está | ❌ |
| **Vercel AI Gateway + AI SDK** | SDK sí (Apache-2.0), Gateway no | Gateway no | ✅ vercel.com | **0%** | 40+ | ✅ pass-through | ✅ cookbook oficial | ✅ Vercel Observability |
| **LiteLLM Proxy** | ✅ MIT (Python) | ✅ Docker | Cloud demo | 0% | 100+ | Sí | ⚠️ requiere Python deploy | ✅ via UI |
| **Portkey AI Gateway** | ✅ MIT (`@portkey-ai/gateway` v1.15.2) | ✅ Node `npx` | ✅ portkey.ai | 0% en self-hosted | 100+ | Sí | ✅ Node nativo | ✅ trazas + guardrails |
| **OpenRouter** | ❌ proprietary | ❌ | ✅ openrouter.ai | ~5% típico | 200+ | Limitado | ✅ vía SDK provider | ⚠️ básica |
| **LangChain JS** | ✅ MIT | N/A (es SDK) | N/A | 0% | depende del provider | Sí | ✅ | ❌ (necesita LangSmith) |

### 5.5 FODA por opción

#### Status quo — 4 SDKs separados

| Eje | Detalle |
|-----|---------|
| **Fortalezas** | Cero costo de migración. Sin lock-in nuevo. Funciona y está testeado en producción. Cada provider con SDK oficial. |
| **Oportunidades** | Aprovechar prompt caching de Anthropic manualmente. Trazabilidad por logs propios. |
| **Debilidades** | 130+ LOC de boilerplate por endpoint. Lógica de fallback manual y duplicada (suggest-response, parse-email, ingest-email). 4 secretos a rotar. Imports dinámicos en cada llamada (latencia warm-up). |
| **Amenazas** | Cualquier provider nuevo (Voyage, Cohere para rerank) implica más boilerplate. SDK breaking changes desalineadas. |

#### Vercel AI Gateway + AI SDK

| Eje | Detalle |
|-----|---------|
| **Fortalezas** | -70% LOC en endpoints multi-provider. **Auth OIDC vía `vercel env pull`** sin secretos estáticos a rotar manualmente; cero secret-management overhead. Drop-in con `baseURL` para Anthropic SDK existente — migración progresiva posible. **No markup**: $$ idéntico al provider directo. Anthropic prompt caching pass-through automático. Tests cookbook oficial Express. Observability + spend tracking en consola Vercel sin código extra. |
| **Oportunidades** | Habilita rerank con Cohere/Voyage sin instalar otro SDK. Permite probar modelos nuevos cambiando un string. BYOK request-scoped para mantener billing separado si lo necesitamos. Streaming `pipeUIMessageStreamToResponse` simplifica chat. |
| **Debilidades** | Lock-in moderado al routing/observability de Vercel (los SDKs son Apache-2.0, el gateway hosted no). Pasar por Cloud Run → Vercel → provider añade ~30–80 ms vs llamada directa Cloud Run → provider. Si Vercel AI Gateway tiene downtime, todos los providers caen juntos (mitigable con BYOK fallback directo). |
| **Amenazas** | Vercel podría introducir markup en el futuro (hoy explícito 0%). Cambios de pricing. Cuotas/rate-limit del gateway diferentes a las de cada provider. |

#### LiteLLM Proxy (self-hosted Python)

| Eje | Detalle |
|-----|---------|
| **Fortalezas** | 100% open source MIT. 100+ providers. Comunidad muy activa. UI de gestión incluida. |
| **Oportunidades** | Control total. Cero lock-in. Multi-tenant si lo necesitamos. |
| **Debilidades** | **Requiere correr un servicio Python adicional** en Cloud Run o GKE. Stack divergente (somos Node.js puro). Tests de integración más complejos. Mantenimiento ops (versionado, hardening, monitoring) se suma al equipo. |
| **Amenazas** | Operacional: si el sidecar LiteLLM cae, cae todo el `/crm/suggest-response`. Necesita SLA propio. |

#### Portkey AI Gateway (self-hosted Node)

| Eje | Detalle |
|-----|---------|
| **Fortalezas** | Open source MIT, **stack Node**, instalable con `npx @portkey-ai/gateway` o como librería embed. Guardrails y semantic caching incluidos. |
| **Oportunidades** | Podríamos correrlo dentro del mismo proceso Express (no sidecar) y mantener todo en Node. Buen balance open-source + featurful. |
| **Debilidades** | Comunidad más chica que LiteLLM. Documentación en evolución. Si self-hosted, cargamos la observabilidad nosotros (vs. Vercel ya viene con dashboard). |
| **Amenazas** | Pivot del producto: el modelo de negocio de Portkey es el cloud, el self-hosted podría perder features. |

#### OpenRouter

| Eje | Detalle |
|-----|---------|
| **Fortalezas** | El catálogo más amplio de modelos (200+). Puede ser **muy barato** para modelos open-source (DeepSeek, Llama, Mixtral). |
| **Oportunidades** | Acceder a modelos exóticos para experimentar (mejor ML response generation, reranking experimental). |
| **Debilidades** | **~5% markup típico** sobre el provider directo. No hay BYOK (pagás siempre via OpenRouter). Observabilidad básica. SLA del proxy. |
| **Amenazas** | Los modelos cambian de precio sin previo aviso. Lock-in al sistema de credits. |

#### LangChain JS (sólo SDK, sin gateway)

| Eje | Detalle |
|-----|---------|
| **Fortalezas** | Ecosistema gigante de chains, retrievers, evals. EnsembleRetriever, RRF, prompt templates listos. |
| **Oportunidades** | Si un día metemos vector store y RAG full, LangChain encaja. |
| **Debilidades** | Pesado (instala 30+ deps). Filosofía "everything is a chain" no encaja con nuestro server route-based actual. Curva de aprendizaje. |
| **Amenazas** | Breaking changes históricos frecuentes (v0.1 → v0.2 → v0.3). |

### 5.6 Recomendación final

**Adoptar Vercel AI Gateway + AI SDK como capa multi-provider.** Justificación basada en evidencia:

1. **Stack alignment.** Ya estamos desplegados en Vercel (frontend) + Cloud Run (API). El gateway es un endpoint HTTP — no requiere migrar a Next.js ni infra nueva. Cookbook Express es oficial.
2. **Costo $.** No markup ([Vercel AI Gateway docs](https://vercel.com/docs/ai-gateway)). Los tokens cuestan lo mismo que llamando provider directo. Plus, prompt caching automático = ahorro del 60–70% de input en chat.
3. **Migración progresiva.** Empezamos por `bmcDashboard.js` (~3 días). Si algo va mal, rollback es cambiar `baseURL` de vuelta. `agentChat.js` se queda con SDK directo en Fase 1 — bajo riesgo.
4. **BYOK como salida de emergencia.** Si Vercel cambia pricing o falla, mantenemos las claves originales en Secret Manager y volvemos a SDKs directos en una tarde.
5. **Observability "gratis".** Spend, latencia y traces sin escribir código. Hoy esa data no existe.

**Criterios de salida (cuándo revisitar la decisión):**
- Si Vercel introduce markup > 0% sobre tokens (hoy explícitamente 0%).
- Si la latencia añadida (Cloud Run → Vercel → provider) supera 150 ms p95 medido en producción.
- Si necesitamos features que sólo Portkey/LiteLLM ofrecen (semantic cache custom, guardrails programables).
- Si Anthropic / xAI deja de estar disponible vía gateway (improbable, hoy ambos listados).

**Lo que NO recomendamos (alcance del brief):**
- LangChain JS — overkill para nuestro RAG-lite actual.
- LiteLLM Python — divergencia de stack.
- OpenRouter — markup + sin BYOK.

---

## 6. Diseño v2 recomendado (consolida 1-5)

Decisiones concretas con fuente del benchmark. Cada una mapea a un todo del plan original o lo expande.

### 6.1 `surface` enum canónico

```ts
// server/lib/kbSurface.js (nuevo)
export const KB_SURFACES = /** @type {const} */ ([
  'panelin_chat',    // chat web (default)
  'mercado_libre',   // ML preguntas
  'whatsapp',        // WA Business
  'email',           // Gmail / IMAP
  'wolfboard',       // futuro
]);

export function normalizeSurface(s) {
  return KB_SURFACES.includes(s) ? s : 'panelin_chat';
}
```

**Fuente:** Intercom Fin guidance cards usan `Chat / Email / Voice`. Adaptamos a nuestros canales.

### 6.2 Shape `responses` (default + overrides)

Nuevo lectura, write retrocompatible:

```ts
// Lectura: el resolver lee desde responses si existe, fallback a campos legacy
function resolveTrainingAnswer(entry, surface) {
  const responses = entry.responses || {};
  const legacy = {
    panelin_chat: entry.goodAnswer,
    mercado_libre: entry.goodAnswerML,
    whatsapp: entry.goodAnswerWA,
  };
  return (
    responses[surface] ||
    legacy[surface] ||
    responses.default ||
    entry.goodAnswer ||
    ''
  );
}
```

**Migración:** sin cambiar el JSON existente. Cuando el Admin guarda un entry nuevo con `responses`, los lectores los prefieren; los entries viejos siguen funcionando.

**Fuente:** Guru / Notion / Glean — variant pattern.

### 6.3 Firma final del resolver

```ts
// server/lib/trainingKB.js (añadir)
export function resolveTrainingAnswer(entry, surface = 'panelin_chat') {
  const s = normalizeSurface(surface);
  const text = pickByPriority(entry, s);
  // Límites por superficie
  const LIMITS = { mercado_libre: 350, whatsapp: 700, email: 2000, panelin_chat: 4000, wolfboard: 4000 };
  const max = LIMITS[s];
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
```

**Tests obligatorios** (`tests/kbSurfaceResolve.test.js`):
1. Entry sólo con `goodAnswer` → todos los surfaces devuelven `goodAnswer` truncado al límite.
2. Entry con `goodAnswerML` y `goodAnswer` → `mercado_libre` devuelve `goodAnswerML`, otros devuelven `goodAnswer`.
3. Entry con `responses.default` y `responses.mercado_libre` → respeta override.
4. `surface` desconocido → default `panelin_chat`.
5. `goodAnswerML > 350 chars` → truncado.

### 6.4 Política de fallback (orden de preferencia)

Para `surface = mercado_libre`:
1. `entry.responses.mercado_libre` (nuevo shape)
2. `entry.goodAnswerML` (legacy)
3. `entry.responses.default` (nuevo shape)
4. `entry.goodAnswer` (legacy)
5. `''` (vacío → no se inyecta al prompt).

Para `surface = whatsapp`: idéntico con `whatsapp` / `goodAnswerWA`.

Para `surface = panelin_chat`: prioriza `responses.default` / `goodAnswer`.

**Fuente:** Intercom guidance cards "channel + default" pattern.

### 6.5 Bloque KB inyectado en `suggest-response`

```js
// server/routes/bmcDashboard.js — POST /crm/suggest-response
import { findRelevantExamples } from '../lib/trainingKB.js';
import { resolveTrainingAnswer } from '../lib/trainingKB.js';

const surface = mapOrigenToSurface(origen); // 'mercado_libre' | 'whatsapp' | 'email'
const examples = findRelevantExamples(consulta, { limit: 3 });
const kbBlock = examples.length
  ? '## Políticas / FAQs relevantes\n' +
    examples.map((e, i) => `[${i + 1}] ${resolveTrainingAnswer(e, surface)}`).join('\n')
  : '';

const finalUserMsg = [kbBlock, userMsg].filter(Boolean).join('\n\n');
```

**Reglas:**
- Confidence threshold mínimo: `matchScore ≥ 2` para inyectar (hoy `> 0`). **Fuente:** Glean confidence-gated responses.
- Tope duro: 3 entries × 350 chars = ~1 050 chars añadidos al prompt. Tokens controlados.
- Si todos los matches son < threshold → no inyectar bloque, dejar al modelo improvisar.

### 6.6 Endpoint `/agent/training-kb/analytics`

```js
GET /agent/training-kb/analytics  →  {
  byCategory: { sales, product, math, conversational },
  bySurface: {
    mercado_libre: { coverage_pct, total_with_override, gap_count },
    whatsapp:      { coverage_pct, total_with_override, gap_count },
  },
  retrievalTrend: [{ date, count }],   // últimos 14 días
  topQueries:     [{ query, count, hasMatch }], // de session logs
  conflicts:      { count, pairs },
  health:         { score, stale, zeroRetrieval },
}
```

**Fuente:** Inkeep dashboard (trending topics, gap detection) + Glean analytics.

### 6.7 UI Admin — matriz de cobertura por canal

Nueva sección bajo "Salud KB" usando `recharts`:

```
┌────────────────────────────────────────────┐
│ Cobertura por canal                         │
│                                             │
│  Categoría     ML override   WA override    │
│  Sales         85% ████████░  20% ██░░░░░░  │
│  Producto      70% ███████░░   5% ░░░░░░░░  │
│  Math         100% █████████  100% █████████ │
│  Conversational 60% ██████░░  10% █░░░░░░░  │
│                                             │
│  [Auto-ML 23] [Auto-WA 47]                  │
└────────────────────────────────────────────┘
```

Botones simétricos para Auto-ML (existente) y Auto-WA (nuevo, espejo).

**Fuente:** Inkeep coverage dashboards.

### 6.8 Capa multi-provider (Fase 3 separada del plan)

Ver §5.6. Migración progresiva:
1. **Fase 3.1** — `suggest-response` y `parse-email` migran a Vercel AI Gateway. Mantener BYOK con keys actuales.
2. **Fase 3.2** — `generate-ml-overrides` y `ingest-email` migran. Activar prompt caching en system prompt estable.
3. **Fase 3.3** (opcional, semanas después) — evaluar `agentChat.js` con A/B; sólo migrar si los traces de Vercel Observability muestran ahorro real sin regresión SSE.

### 6.9 Observability — Langfuse (opcional, Fase 4)

Self-hosted en Cloud Run con `langfuse` SDK envolviendo las llamadas AI SDK:

```js
import { Langfuse } from 'langfuse';
import { generateText } from 'ai';

const langfuse = new Langfuse({ /* env */ });
const trace = langfuse.trace({ name: 'suggest-response', input: { consulta, origen } });
const result = await generateText({ /* ... */ });
trace.update({ output: result.text });
```

**Fuente:** Langfuse docs + 26.8k stars + 559 releases. Decisión: **diferida a Fase 4** — no es bloqueante para multi-canal pero potencia evals.

### 6.10 Documentación operativa

Añadir a `docs/team/panelsim/knowledge/ML-TRAINING-SYSTEM.md` (preexistente) o crear `docs/team/panelsim/knowledge/KB-MULTICANAL-OPERATIVA.md` con:

1. **Matriz superficie → prompt → campo KB:**

   | Surface | System prompt origen | Campo KB preferido | Límite chars | Endpoint |
   |---------|---------------------|--------------------|--------------|----------|
   | `panelin_chat` | `chatPrompts.buildSystemPrompt` | `responses.default` / `goodAnswer` | 4 000 | `POST /api/agent/chat` |
   | `mercado_libre` | `bmcDashboard.suggest-response` (system fijo) + bloque KB | `responses.mercado_libre` / `goodAnswerML` | 350 | `POST /api/crm/suggest-response` |
   | `whatsapp` | (TODO Fase 4) | `responses.whatsapp` / `goodAnswerWA` | 700 | (TODO) |
   | `email` | `bmcDashboard.parse-email` + `ingest-email` | `responses.email` / `responses.default` | 2 000 | `POST /api/crm/parse-email` |

2. **Variables de entorno:**

   | Variable | Uso | Cloud Run | Vercel build |
   |----------|-----|-----------|--------------|
   | `K_SERVICE` | Activa modo GCS en `trainingKB.js` | auto | — |
   | `GCS_KB_BUCKET` | Bucket de KB persistida | required | — |
   | `GCS_KB_OBJECT` | Path del JSON (default `kb/training-kb.json`) | optional | — |
   | `API_AUTH_TOKEN` | Auth dev-mode (admin) | required | — |
   | `VITE_API_AUTH_TOKEN` | Build-time para Admin | — | required |
   | `VERCEL_OIDC_TOKEN` | **Auth recomendada al gateway** — hidratada por `vercel env pull`, rota automáticamente | required | required |
   | `AI_GATEWAY_API_KEY` | Auth alternativa (sólo si OIDC no es viable). Static key generada en consola Vercel | optional | optional |

   > **Nota:** las claves directas a cada provider (Anthropic / OpenAI / xAI / Google) **no son necesarias** en el patrón recomendado — toda la auth pasa por el gateway con OIDC. Se eliminan del Secret Manager al migrar.

3. **Backup / export:** export JSON desde Admin (ya existe) + procedimiento manual de respaldo de `gs://$GCS_KB_BUCKET/$GCS_KB_OBJECT`.

---

## Próximo paso recomendado

**Ejecutar Fase 1 del plan original** con las mejoras del §6.1-6.4: implementar `resolveTrainingAnswer` con shape `responses` + fallback a legacy + tests de regresión sobre el dataset actual.

**Tareas concretas (en orden):**
1. `server/lib/kbSurface.js` — enum + `normalizeSurface`. (~20 LOC)
2. `server/lib/trainingKB.js` — añadir `resolveTrainingAnswer` exportado. (~40 LOC)
3. `tests/kbSurfaceResolve.test.js` — 5 casos de §6.3. (~80 LOC)
4. Mantener todo lo demás intacto (chat, suggest-response, Admin) — Fase 1 no toca callers todavía.

Tras Fase 1, **iterar el brief** sólo si los tests revelan algo no anticipado. La Fase 3 (AI Gateway) puede arrancar en paralelo con Fase 2 (cableado de chat + suggest-response) porque tocan archivos distintos.

---

## Fuentes citadas

- [Intercom Help — Provide Fin AI Agent with specific guidance](https://www.intercom.com/help/en/articles/10210126-provide-fin-ai-agent-with-specific-guidance)
- [Intercom Blog — What's new with Fin 3 (2026)](https://www.intercom.com/blog/whats-new-with-fin-3/)
- [Inkeep — Multi-Channel Knowledge Reuse (2026)](https://inkeep.com/blog/multi-channel-knowledge-reuse-scale-ai-support-across-slack)
- [Inkeep docs — AI for Customers](https://docs.inkeep.com/cloud/overview/ai-for-customers)
- [Glean docs — Respond in Slack channels](https://docs.glean.com/administration/platform/embedded-integrations/slackbot/use-glean-in-slack/respond-in-slack-channels)
- [LangChain docs — JavaScript overview](https://docs.langchain.com/oss/javascript/langchain/overview)
- [Cohere docs — Rerank v4](https://docs.cohere.com/v2/docs/rerank-2)
- [HuggingFace — BAAI/bge-reranker-v2-m3](https://huggingface.co/BAAI/bge-reranker-v2-m3)
- [Vercel AI Gateway — overview](https://vercel.com/docs/ai-gateway)
- [Vercel AI Gateway — Anthropic Messages API](https://vercel.com/docs/ai-gateway/sdks-and-apis/anthropic-messages-api)
- [Vercel AI Gateway — Provider Options](https://vercel.com/docs/ai-gateway/models-and-providers/provider-options)
- [AI SDK — Foundations Overview](https://ai-sdk.dev/docs/foundations/overview)
- [AI SDK Cookbook — Express server](https://ai-sdk.dev/cookbook/api-servers/express)
- [Langfuse docs](https://langfuse.com/docs) + [github.com/langfuse/langfuse](https://github.com/langfuse/langfuse)
- [Helicone — pricing + github.com/Helicone/helicone](https://github.com/Helicone/helicone)
- [Portkey AI Gateway — docs](https://portkey.ai/docs/product/ai-gateway)
- [LiteLLM — Proxy quick start](https://docs.litellm.ai/docs/proxy/quick_start)
- [OpenRouter — quickstart](https://openrouter.ai/docs/quickstart)
