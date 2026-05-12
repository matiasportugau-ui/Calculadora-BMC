# KB Multi-canal — Parking Lot de ideas

> **Función:** capturar ideas valiosas que aparecen durante la run pero **NO** entran en la DoD del [`KB-MULTICANAL-E2E-RUN.md`](./KB-MULTICANAL-E2E-RUN.md). Cada idea queda lista para retomarse después con todo el contexto.
>
> **Regla:** ningún ítem se borra hasta que esté implementado o explícitamente descartado por el usuario. Las ideas se ordenan por área de desarrollo, no cronológicamente.

---

## Schema de cada ítem

```
### [TÍTULO]
- **Área:** Calculator | Chat | Admin | API | Sheets | Deployment | Security | Docs | Fiscal
- **Origen:** dónde apareció (sesión, fase, sugerencia del usuario, hallazgo del brief).
- **Motivación:** qué problema resuelve o qué oportunidad abre.
- **Esfuerzo estimado:** S (< 1 día) | M (1-3 días) | L (1+ semana).
- **Punto de entrada:** archivo y línea aproximada donde tocaría empezar.
- **Dependencias:** otras tareas que deben existir primero.
- **Estado:** OPEN | IN_PROGRESS | BLOCKER | DONE | DROPPED.
- **Notas:** cualquier contexto adicional, links a docs, ejemplos.
```

---

## Backlog activo

### Re-ranking de KB con Cohere v4 o Voyage

- **Área:** API (retrieval).
- **Origen:** Brief §3.5 — research benchmark.
- **Motivación:** cuando la KB pase de 500 entries, `scoreOverlap` puro se va a degradar. Cross-encoder rerank top-N → top-K es upgrade probado.
- **Esfuerzo:** M.
- **Punto de entrada:** `server/lib/trainingKB.js:368` (`findRelevantExamples`) — añadir paso de rerank tras el filtro inicial.
- **Dependencias:** decisión de pricing Cohere ($1/1k searches) o Voyage. Vercel AI Gateway ya soporta ambos vía `cohere/rerank-v4.0-fast` y `voyage/rerank-2`.
- **Estado:** OPEN.
- **Notas:** evitar BGE-reranker local — Brief §3.5 confirma incompatibilidad transformers.js. Activar sólo cuando se note degradación medible.

### EnsembleRetriever (BM25 + dense) interno

- **Área:** API (retrieval).
- **Origen:** Brief §3.4 — patrón LangChain.
- **Motivación:** combinar `scoreOverlap` (token overlap) con `minisearch` (BM25) y/o embeddings vía AI Gateway. Reciprocal Rank Fusion sobre los dos canales.
- **Esfuerzo:** M.
- **Punto de entrada:** `server/lib/trainingKB.js` — refactor interno de `findRelevantExamples` para componer múltiples retrievers.
- **Dependencias:** decisión sobre embeddings (cuesta tokens; AI Gateway expone `voyage/voyage-3-lite` y `openai/text-embedding-3-small`).
- **Estado:** OPEN.
- **Notas:** experimentar primero con `minisearch` local (sin costo) antes de meter embeddings.

### Migración de `agentChat.js` a Vercel AI Gateway + AI SDK

- **Área:** Chat.
- **Origen:** Brief §5.3 — diferida explícitamente.
- **Motivación:** unificar la capa multi-provider. Eliminar imports dinámicos de 4 SDKs distintos. Streaming `pipeUIMessageStreamToResponse` simplifica chat.
- **Esfuerzo:** L (3-5 días).
- **Punto de entrada:** `server/routes/agentChat.js:1-700`.
- **Dependencias:** F8 cerrada (CRM endpoints estables en AI Gateway). Benchmark SSE custom vs AI SDK streaming. A/B en producción con telemetría.
- **Estado:** OPEN.
- **Notas:** riesgo de regresión SSE alto; el chat tiene eventos custom (`kb_match`, `approved_actions`, `info`, `text`, `action`, `suggestions`). Validar uno por uno.

### Langfuse self-hosted en Cloud Run

- **Área:** Deployment + Chat + API.
- **Origen:** Brief §3.8 — observability.
- **Motivación:** traces de KB retrieval (qué entries se inyectaron, score, latencia, costo por turn). Prompt versioning con A/B. Datasets de regresión para `findRelevantExamples` antes de cambiar scoring.
- **Esfuerzo:** L.
- **Punto de entrada:** crear servicio Cloud Run separado con imagen Docker oficial Langfuse + envolver llamadas en `agentChat.js` y `bmcDashboard.js`.
- **Dependencias:** decisión cloud free tier vs self-hosted. Langfuse v3.38 (MIT, 26.8k stars). Verificar costo Cloud Run del servicio (Postgres + Clickhouse).
- **Estado:** OPEN.
- **Notas:** alternativa: Langfuse Cloud free tier (50k units/mes) sin self-hosting. Decisión a tomar después de F8.

### Endpoint `/generate-wa-overrides` (espejo del ML existente)

- **Área:** API (Admin).
- **Origen:** Brief §6.7 — UI Admin recomienda botón Auto-WA simétrico.
- **Motivación:** generar `responses.whatsapp` automáticamente para entries con `goodAnswer > 700 chars` sin override WA.
- **Esfuerzo:** S.
- **Punto de entrada:** `server/routes/agentTraining.js:374` — copiar el patrón de `/generate-ml-overrides` cambiando límite (700 chars) y prompt (formato semi-formal con emojis permitidos).
- **Dependencias:** F1 (resolver) cerrada para que `responses.whatsapp` exista en el shape.
- **Estado:** OPEN — **incluido en F5** del E2E Run (cobertura por canal en Admin requiere botón Auto-WA). Mover acá si la complejidad explota.

### Per-segment threshold de confidence en `findRelevantExamples`

- **Área:** API.
- **Origen:** Brief §3.3 — patrón Glean.
- **Motivación:** hoy el filter es `score > 0`. Para canales como ML donde queremos sólo políticas con match fuerte, threshold debería ser configurable por surface.
- **Esfuerzo:** S.
- **Punto de entrada:** `server/lib/trainingKB.js:381` — extender opciones con `minScore`.
- **Dependencias:** F3 cerrada (suggest-response cableado).
- **Estado:** OPEN — el E2E Run ya lo hardcodea a `>= 2` en suggest-response, pero hacerlo configurable por surface es upgrade futuro.

### Citations: surface en producción del evento `kb_match`

- **Área:** Chat (UI).
- **Origen:** Brief §3.2 — patrón Inkeep.
- **Motivación:** hoy `kb_match` (server/routes/agentChat.js:660) sólo se emite en `devMode`. Mostrar al usuario qué entries soportan la respuesta aumenta confianza.
- **Esfuerzo:** M.
- **Punto de entrada:** `agentChat.js:660` (servidor) + `PanelinChatPanel` (cliente, footer del mensaje).
- **Dependencias:** decisión UX — ¿mostramos siempre o detrás de un toggle? Privacidad: la KB tiene políticas internas que no queremos surfaceaer.
- **Estado:** OPEN — más bien post-F8.

### Trending topics + gap detection (queries sin match)

- **Área:** Admin + API.
- **Origen:** Brief §3.2 — patrón Inkeep.
- **Motivación:** hoy `zeroRetrieval` mide entries sin uso. Falta el inverso: queries de usuarios que no matchearon nada. Eso identifica gaps reales en la KB.
- **Esfuerzo:** M.
- **Punto de entrada:** `appendTrainingSessionEvent` ya loguea (`trainingKB.js:576`). Agregar agregación por query → endpoint `/training-kb/gaps`.
- **Dependencias:** F4 cerrada.
- **Estado:** OPEN.

### Anthropic prompt caching ya en `agentChat.js` (sin migrar a AI Gateway)

- **Área:** Chat.
- **Origen:** Brief §3.7.
- **Motivación:** -60-70% input tokens en chat estable. Se puede hacer ya con SDK directo, sin esperar migración a AI Gateway.
- **Esfuerzo:** S.
- **Punto de entrada:** `server/routes/agentChat.js` — donde se construye el llamado a Anthropic, marcar bloques estables con `cache_control: { type: 'ephemeral' }`.
- **Dependencias:** ninguna.
- **Estado:** OPEN — atractivo de pickup rápido tras F2 si el costo de tokens es prioridad.

### Sustituir `@xenova/transformers` references por `@huggingface/transformers`

- **Área:** Docs / API.
- **Origen:** Brief §4 — auditoría de librerías.
- **Motivación:** `@xenova/transformers` está stale (mayo 2024). Cualquier doc o ejemplo nuestro debería referenciar el sucesor.
- **Esfuerzo:** S.
- **Punto de entrada:** búsqueda `grep -r "xenova" .` y reemplazar.
- **Estado:** OPEN.

### Conflicts surface con CTA en pestaña Salud KB

- **Área:** Admin.
- **Origen:** Brief §3.9 — patrón Guru.
- **Motivación:** `findAllConflicts` (`trainingKB.js:335`) ya existe y `/training-kb/conflicts` lo expone. Hoy está enterrado — no surface en UI.
- **Esfuerzo:** S.
- **Punto de entrada:** `src/components/AgentAdminModule.jsx` HealthTab — agregar 4ta sección con conflictos.
- **Dependencias:** ninguna.
- **Estado:** OPEN — buen pickup tras F5.

### Migración `responses` map definitiva (drop legacy fields)

- **Área:** API + Admin.
- **Origen:** Brief §6.2 — segunda etapa de la migración suave.
- **Motivación:** una vez todas las entries tengan `responses.default` y los overrides correspondientes, eliminar los campos `goodAnswerML/goodAnswerWA` reduce confusión. Bumpear `KB_VERSION` a 2.0.0.
- **Esfuerzo:** S.
- **Punto de entrada:** `server/lib/trainingKB.js` shape + script de migración batch.
- **Dependencias:** D11 cumplido (5+ entries con override en cada canal). Confirmar que ningún consumidor externo lee `goodAnswerML/goodAnswerWA` directo (export JSON, integraciones).
- **Estado:** OPEN.

### Surface support en MCP server (panelin-mcp)

- **Área:** API (externa).
- **Origen:** futura interoperabilidad.
- **Motivación:** el MCP server de Panelin (`bmc-panelin-mcp`) podría exponer `resolveTrainingAnswer` como tool externa para que GPT Builder, Cursor, etc. consulten la KB con surface awareness.
- **Esfuerzo:** S.
- **Punto de entrada:** repo del MCP server (separado).
- **Dependencias:** F1 cerrada y `resolveTrainingAnswer` exportado.
- **Estado:** OPEN.

---

## Ideas drop-able (a confirmar para descartar)

### Migrar tests a `vitest`

- **Área:** Deployment / Tests.
- **Origen:** Brief §4 — librerías candidatas.
- **Motivación:** migración cosmética. Hoy `tests/validation.js` corre con runner custom y es robusto.
- **Esfuerzo:** M.
- **Punto de entrada:** `package.json` scripts + tests/.
- **Estado:** OPEN — **propuesta DROPPED** salvo que el usuario insista; no aporta a la DoD.

### Usar `tremor` para gráficos del Admin

- **Área:** Admin.
- **Origen:** Brief §4.
- **Motivación:** UI premade.
- **Esfuerzo:** M.
- **Estado:** **DROPPED**. `@tremor/react` está stale (Brief §4 confirma >15 meses sin release). `recharts` ya elegida.

### Adoptar LiteLLM Proxy

- **Área:** Deployment / API.
- **Origen:** Brief §5.5 FODA.
- **Motivación:** open source MIT, 100+ providers.
- **Estado:** **DROPPED**. Requiere correr servicio Python en Cloud Run — divergencia de stack (Brief §5.5 LiteLLM debilidades).

### Adoptar OpenRouter

- **Estado:** **DROPPED**. ~5% markup + sin BYOK (Brief §5.5).

---

## Histórico (DONE / merged)

*Vacío — se irá poblando a medida que ítems pasen a producción.*
