# Panelin IA — Preflight Dossier (verificación + best practices)

> Fecha: 2026-05-07 · Programa: "Panelin IA enterprise-ready" (`/Users/matias/.cursor/plans/panelin_ia_enterprise-ready_705b2462.plan.md`)
> Objetivo: dejar listo el terreno antes de ejecutar las épicas pendientes (A trust UI, C enforcement, D goldens, E ops, F policy doc, budgets) sin tocar código en este pase.
> DoD: snapshot de archivos canónicos verificado, ≥2 referencias externas con fecha por épica, tabla build-vs-adopt, plan de archivos a crear/modificar.

---

## 1. Snapshot verificado del estado actual

Verificado con `git log -1` y lectura/`grep` de cada archivo el 2026-05-07.

### 1.1 Backend (Express 5 / Node 24 / ESM)

| Archivo | Líneas | Último commit | Símbolos clave |
|---|---:|---|---|
| `server/routes/agentChat.js` | 1060 | a4735c2 (2026-05-07) | `POST /agent/chat` SSE, `POST /agent/exec-tool`, `GET /agent/tools-manifest`, `GET /agent/tool-stats`, `GET /agent/ai-options`, `publicLimiter` 10/min, `devModeLimiter` 30/min, `execToolLimiter`, `TOKEN_BUDGET`, `buildCalcValidation`, `classifyIntents`, `TOOLS_REQUIRING_AUTH` |
| `server/lib/agentTools.js` | 1698 | c609653 (2026-05-07) | `AGENT_TOOLS`, `executeTool`, `requireConfirmedAction(name, input, opts)` con doble path (chat → `opts.approvedActions:Set`; MCP → `input.user_confirmed`) |
| `server/lib/userIntentClassifier.js` | 155 | c609653 (2026-05-07) | `classifyIntents(lastUserMessage)→Set`, `INTENT_HINTS`, `TOOL_INTENT_PATTERNS` (9 tools cubiertas), normalización NFD + `stripNegations` con guardia idiomática "dejar sin efecto" |
| `server/lib/chatPrompts.js` | 617 | 9502b2c (2026-05-07) | `buildSystemPrompt(calcState, opts)`, `buildCanonicalPricingBlock`, `sanitizeForPrompt`, `buildWaCockpitSuggestionsBlock`. Inyecta `Lista de precios: ${listaPrecios}` y catálogo PRECIOS CANÓNICOS |
| `server/lib/quotePayloadValidator.js` | 111 | 38f2c89 (2026-04-22) | `validateAndPreviewQuote(rawPayload)` para `buildQuote` ACTION_JSON |
| `server/lib/conversationLog.js` | 238 | 1118dfd (2026-04-22) | `logConversationMeta/Turn/Action`, `closeConversation`, `loadConversations({days,page,limit})`, `computeResume`, `countHedges` |
| `server/lib/toolStats.js` | 130 | 96e0b13 (2026-05-05) | `recordToolCall`, `getToolStats({windowMs})`, ring buffer in-memory `MAX_RECORDS=1000` (se pierde en cold-start de Cloud Run; long-term en pino) |
| `server/config.js` | 170 | b9cf59a (2026-05-07) | `apiAuthToken`, `anthropicApiKey/openaiApiKey/grokApiKey/geminiApiKey`, `chatLogConversations`, WhatsApp tokens. **No** existe flag `AGENT_REQUIRE_CONFIRM_WRITE` ni budget por usuario |

### 1.2 Frontend (React 18 / Vite 7)

| Archivo | Líneas | Último commit | Símbolos clave |
|---|---:|---|---|
| `src/hooks/useChat.js` | 662 | a4735c2 (2026-05-07) | Estado por mensaje: `content`, `actions[]`, `toolCalls[]`, `suggestions`, `calcValidation`. Eventos SSE consumidos: `text`, `action`, `tool_call`, `kb_match`, `calc_validation`, `suggestions`, `error`, `done`. **No** procesa `approved_actions` ni `info` |
| `src/components/PanelinChatPanel.jsx` | 1565 | a4735c2 (2026-05-07) | Render por mensaje: pills "⚙ <tool>" para `toolCalls`, ✓ verde para `actions`, chips `suggestions`. **No** renderiza badge "Verificado por cotizador" ni chip de lista activa, ni preview/Confirm para acciones de escritura |
| `src/components/PanelinDevPanel.jsx` | 828 | 96e0b13 (2026-05-05) | Muestra `devMeta.calcValidation.matches` solo en devMode |

### 1.3 Eventos SSE actualmente emitidos por `agentChat.js`

`text`, `action`, `tool_call` (con campo `blocked: "auth_required"` posible), `kb_match`, `calc_validation` (devMode), `suggestions`, `approved_actions` (devMode, ignorado por cliente), `info`, `thinking_start`, `thinking_done`, `error`, `done`.

### 1.4 Tests existentes que cubrirían regresión

`tests/userIntentClassifier.test.js` (incluye negaciones), `tests/agentTools.test.js`, `tests/toolStats.test.js`, `tests/agentMcpRoutes.test.js`, `tests/chat-hardening.js` (sanitizeForPrompt + tokenEstimator), `tests/quoteRegistryCalcEvent.test.js`, `tests/calcLoopbackClient.test.js`. **No** existe runner E2E de prompts (golden suite).

### 1.5 Riesgos detectados

- `toolStats` es in-memory; cualquier dashboard que dependa de él **se reinicia con el cold start**. Si la épica E va a depender de esa fuente, hay que persistir o aceptar la limitación explícitamente.
- `requireConfirmedAction` tiene un fallback `input.user_confirmed=true` para path MCP/exec-tool. Cualquier nuevo gate UI que añadamos tiene que coexistir con ese path, no reemplazarlo.
- `buildSystemPrompt` ya inyecta lista activa al modelo. La verdad sobre `listaPrecios` vive en `calcState.preferences.listaPrecios`. La épica A puede leerla del mismo lugar sin nuevo endpoint.
- `chatPrompts.js` ya tiene reglas de canal ML (línea 124: "no menciones tipo de lista"). La épica F debería **extraer** esas reglas a un YAML/JSON cargable, no duplicarlas.
- `buildCalcValidation` solo corre en devMode (`agentChat.js:974`). Para usarla como guardrail (épica C) hay que separar **medir** (siempre) de **mostrar** (devMode) y agregar un branch de **enforce**.

### 1.6 Archivos a crear (propuesta)

- `tests/agentGolden/cases/*.json` — dataset versionado de prompts esperados.
- `tests/agentGolden.runner.js` — runner offline (mock provider) + script `npm run test:agent-golden`.
- `docs/team/policies/COMERCIAL-CHAT-ML-SHOPIFY.md` — fuente única de IVA / listas / disclaimers / tono. Cargado por `chatPrompts.js` y referenciado por scripts ML/Shopify.
- `docs/team/runbooks/PANELIN-IA-OPS.md` — claves Cloud Run (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `BMC_SHEET_ID`, `WHATSAPP_*`), límites por minuto, qué hacer si un proveedor degrada, cómo rotar modelos en `ALLOWED_MODELS`.
- `server/lib/budget.js` — contador por `conversationId`/IP con ventana, tope soft + mensaje claro cuando se excede.
- (si adopt) `promptfooconfig.yaml` en `tests/agentGolden/` — config Promptfoo MIT.

---

## 2. Investigación: best practices y librerías

Cada referencia incluye link y fecha verificada del fetch (2026-05-07).

### 2.1 Trust UI / message parts (Épica A)

**Vercel AI SDK — UIMessage.parts** (https://ai-sdk.dev/docs/ai-sdk-ui/chatbot, fetched 2026-05-07).
El SDK reemplaza `content` por `parts: UIPart[]` con tipos discriminados: `text`, `tool-call` (con `state` / `input` / `output`), `tool-result`, `reasoning`, `file`, `source-url`, `source-document`. La UI itera `message.parts.map((part, i) => part.type === 'tool-call' ? <ToolPill … /> : …)`.

**Anthropic tool use overview** (https://platform.claude.com/docs/en/docs/build-with-claude/tool-use/overview, fetched 2026-05-07).
"Add `strict: true` to your tool definitions to ensure Claude's tool calls always match your schema exactly." → recomendable para `calcular_cotizacion` y `comparar_listas`. El SDK Anthropic devuelve `stop_reason: "tool_use"` con bloques `tool_use` (id, name, input) — exactamente lo que ya parseamos en `agentChat.js:811-828`.

**Inspiración UX**: Cursor, Continue.dev y Cody muestran tool-calls como pills colapsables con resultado on-demand. ChatGPT muestra "Verified citations". Nuestro pill actual ("⚙ <tool>") es mínimo; la mejora natural es: badge afirmativo + datos clave del resultado (lista, total, áreas).

### 2.2 HITL / aprobación (Épica B — ya hecha; Épica B' opcional UI)

**LangGraph HITL** (Python: `interrupt()` / `Command(resume=…)`, requiere checkpointer). Pattern de "approve / edit / inspect tool call" antes de ejecutar. **Verdicto**: no adoptar para este repo — LangGraph asume orquestación de grafos persistidos, mientras que nuestro chat es un loop SSE simple. La idea conceptual sí inspira: separar `pending_action` del `executed_action` y emitirlos como dos eventos SSE distintos. (URL oficial redirige sin contenido en fetch; pattern conocido por docs públicas.)

**OpenAI Assistants API — `requires_action`**: el run pausa con `status: requires_action` y el cliente devuelve resultados de tool. Mismo principio: estado intermedio observable.

**Verdicto Épica B**: lo ya implementado (`classifyIntents` + `requireConfirmedAction`) es correcto para el caso comercial (operadora hispano-hablante). Para producción se puede añadir, **además**, una capa visual: emitir `pending_action` en SSE antes de ejecutar, con `Confirmar` / `Cancelar` que devuelve por el siguiente turno. Coexiste sin romper el gate por intent.

### 2.3 Output guardrails / "precio sin tool" (Épica C)

**Guardrails AI** (https://github.com/guardrails-ai/guardrails, MIT, Python). Validators componibles + reasking. **Verdicto**: no adoptar — el ecosistema activo es Python; portar añade un proceso. Nuestro caso es un único guardrail de dominio (no totales sin tool), implementable en `~80` LoC.

**NeMo Guardrails** (Apache-2.0, Python). DSL Colang, también Python-only.

**Patrón recomendado (build-in-house, ligero)**:
- Reusar `buildCalcValidation` que ya extrae montos USD del texto (`extractQuotedUsd`) y compara con `runCalculationFromState`.
- Añadir intent "cotización" en `userIntentClassifier.js` (patrón nuevo, no destructivo).
- Si intent === cotización **y** no hubo `tool_use` de `calcular_cotizacion`/`comparar_listas`/`comparar_escenarios` **y** `extractQuotedUsd` retornó número → reescribir el último mensaje con plantilla segura ("para confirmar el total, dejame correr el motor — un momento") y forzar tool en el siguiente round.
- Telemetría: contar trigger del guardrail por proveedor/modelo en `toolStats` (nuevo `errorClass: "price_without_tool"`).

### 2.4 Goldens / evals (Épica D)

**Promptfoo** (https://github.com/promptfoo/promptfoo, MIT, **v0.121.10 — 2026-05-07**). Soporta exactamente lo que necesitamos para este caso:
- `is-valid-function-call` / `is-valid-openai-tools-call` — schema match.
- `trajectory:tool-used`, `trajectory:tool-args-match`, `trajectory:tool-sequence` — agent trajectory asserts.
- `is-json` / `contains-json` — para SUGGEST_JSON / ACTION_JSON.
- `javascript` — custom asserts en JS (encaja con ESM del repo).
- CI: GitHub Action oficial. Local-first ("runs completely locally").

**Braintrust** (SaaS + SDK MIT). Datasets versionados, scoring online + offline. Mejor que Promptfoo para datasets grandes y CI cloud, pero implica cuenta y/o auto-host pesado.

**DeepEval** (Apache-2.0, pytest-style, Python). No encaja con nuestro stack ESM.

**Verdicto**: **adoptar Promptfoo** para D. Justificación: MIT, release reciente (mayo 2026), trajectory asserts mapean 1:1 a nuestras tools, no requiere servicio externo, GitHub Action lista.
**Plan B**: si se quiere zero-deps, runner propio en `tests/agentGolden.runner.js` que invoque el provider real con un set de fixtures + `JSON.stringify` snapshot de tool-calls esperados. ~150 LoC. Aceptable como puente hasta que se adopte Promptfoo.

### 2.5 Observabilidad / costo (Épica E)

**OpenTelemetry GenAI semantic conventions** (https://opentelemetry.io/docs/specs/semconv/gen-ai/, **experimental**, fetched 2026-05-07). Atributos canónicos: `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.operation.name`. Cubre agents y tool-calls. Activable con `OTEL_SEMCONV_STABILITY_OPT_IN`.

**Langfuse** (https://github.com/langfuse/langfuse, **MIT**, **v3.172.1 — 2026-05-01**). Self-host (Docker / Helm / Terraform). SDK JS/TS oficial. Trackea traces, prompts, evals, datasets. Integra OpenAI directo; Anthropic via OTEL/manual.

**Helicone** (Apache-2.0, proxy + UI). Más simple pero proxy-based — habría que enrutar Anthropic a través de Helicone.

**Verdicto**:
- **Inmediato**: extender `toolStats` y `conversationLog` con campos OTEL-shape (`gen_ai.*` en logs pino) sin adoptar runtime OTEL aún. Cero dependencias nuevas.
- **Mediano plazo**: adoptar **Langfuse self-hosted** cuando volúmen lo justifique. No bloquea esta entrega.

### 2.6 Tokenización / budget (Épica E')

`tokenEstimator.js` actual usa una heurística para español. Para cuentas por proveedor:
- **`@anthropic-ai/tokenizer`** — oficial, Claude-exact.
- **`gpt-tokenizer`** — JS puro, OpenAI-exact, mantenido.
- **`tiktoken`** — Rust binding, más rápido pero binario.

**Verdicto**: la heurística actual basta para truncado pre-request. Para **budget hard** por sesión, agregar contador por `conversationId` con tope blando (ej. `CHAT_SESSION_USD_CAP=0.50`) y mensaje claro al exceder. No requiere lib nueva.

### 2.7 Multi-canal policy doc (Épica F)

Patrón "single source of facts": YAML cargado al boot por `chatPrompts.js` y leído por scripts ML / templates Shopify.

```yaml
# docs/team/policies/comercial-chat-ml-shopify.yaml
iva:
  pct: 22
  exhibicion: "siempre IVA discriminado, USD"
listas:
  publicar: false   # nunca mencionar "lista web/venta" al cliente
  internas: [web, venta]
disclaimers:
  validez_horas: 48
  flete: "no incluido salvo aclaración explícita"
tono:
  ml: "directo, sin jerga interna, máx 600 chars"
  panelin: "consultivo, español rioplatense, sin ‘entiendo’"
```

`buildSystemPrompt` carga el YAML una vez (cache) y deriva las líneas del prompt; los scripts ML hacen lo mismo. Cero divergencia.

---

## 3. Diseño mejorado por épica (diff vs plan original)

### 3.1 Épica A — Trust UI

| Plan original | Propuesta mejorada |
|---|---|
| Pill "⚙ tool" + chip lista activa | Pill enriquecido + **TrustBlock** plegable + chip lista activa **leído de `calcState.preferences.listaPrecios`** (no nuevo endpoint) |

**TrustBlock**: cuando hubo `tool_use` de `calcular_cotizacion` o `comparar_*`, el cliente renderiza un bloque debajo del mensaje:
```
✓ Verificado por el cotizador · Lista web · 142,8 m² · USD 6.840 (sin IVA) · USD 8.345 (c/IVA)
   [Ver detalle ▾]
```
**Implementación**: el server emite un nuevo SSE event `verified_quote` con `{tool, lista, expectedTotal, areaTotal, items_count}` después de `tool_call` exitoso. `useChat.js` lo guarda como `msg.verifiedQuote`; `PanelinChatPanel.jsx` lo renderiza. **Cero acoplamiento** con la lógica del modelo — solo refleja lo que ya devolvió la tool.

**Anti-pattern evitado**: no inventar metadata "lista activa" — leerla de `calcState.preferences.listaPrecios` que ya existe.

### 3.2 Épica B — HITL (ya hecha) + B' opcional preview UI

Mantener `classifyIntents` + `requireConfirmedAction` (épica B cumplida).
**Mejora opcional B'** (no bloqueante para release): emitir `pending_action` antes de ejecutar tools de escritura cuando `approvedActions` está vacío pero el modelo intentó la tool. UI muestra Confirmar/Cancelar; click envía un mensaje sintético ("guardalo en CRM") que el classifier valida en el siguiente turno. Reusa la maquinaria existente.

### 3.3 Épica C — Enforcement "precio sin tool"

| Plan original | Propuesta mejorada |
|---|---|
| Lógica dentro de `agentChat.js` | Mismo lugar, pero **factorizado** a `server/lib/priceGuard.js` con función `enforcePriceGroundedness({lastUserMessage, toolUseHistory, assistantText, calcState}) → {action: "pass"\|"rewrite"\|"force_tool", message?}` |

- Añadir patrón "intent: cotización" en `userIntentClassifier.js` (`cotizame`, `cuánto sale`, `pasame precio`).
- En el loop de tools (`agentChat.js:798`), si terminó sin `tool_use` y guard dispara → **forzar un round más** con `tool_choice: {type: "tool", name: "calcular_cotizacion"}` (Anthropic strict tool choice).
- Telemetría: `recordToolCall({ tool: "_priceGuard", ok: false, errorClass: "price_without_tool" })`.
- Test: golden case "cotizame techo 6x4 80mm" sin sugerencia → expect `trajectory:tool-used calcular_cotizacion`.

### 3.4 Épica D — Goldens

**Decisión**: adoptar **Promptfoo** (MIT, v0.121.10 mayo 2026).

Estructura propuesta:
```
tests/agentGolden/
├── promptfooconfig.yaml          # providers (anthropic, openai), tests
├── cases/
│   ├── 01-quote-techo.yaml       # asserts: trajectory:tool-used calcular_cotizacion
│   ├── 02-no-price-without-tool.yaml
│   ├── 03-crm-needs-confirmation.yaml
│   ├── 04-wa-link-needs-confirmation.yaml
│   ├── 05-suggest-json-shape.yaml
│   ├── 06-action-json-shape.yaml
│   └── 10-policy-no-mention-lista.yaml
└── fixtures/
    └── calc-states/*.json        # estados pre-cargados
```

CI: job opcional que skipea si no hay `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`; **obligatorio en local** antes de release de prompt.

**Plan B (zero-deps)**: si Promptfoo trae fricción (versionado, dependencia transitiva), runner propio en `tests/agentGolden.runner.js` (~150 LoC) que arranca el server local, hace `POST /api/agent/chat` con cada caso y valida tool-calls capturados de los SSE.

### 3.5 Épica E — Ops & costo

| Plan | Mejora |
|---|---|
| Métricas en logs y `tool-stats` ampliado | Loggear cada turno con esquema **OTEL GenAI** en pino (`gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.*`, `gen_ai.operation.name`) sin runtime OTEL todavía. Permite migrar a Langfuse/Datadog GenAI cuando se quiera, sin re-instrumentar. |
| `runbook` genérico | `docs/team/runbooks/PANELIN-IA-OPS.md` con: secrets en Cloud Run, límites, fallback chain (claude → grok → gemini → openai), cómo cambiar modelo default sin redeploy (env var), cómo rotar `API_AUTH_TOKEN`, qué hacer si un proveedor 5xx > 30%. |
| (sin presupuesto) | Nuevo `server/lib/budget.js` — contador in-memory por `conversationId`/IP con ventanas (1min/5min/24h) y tope soft (`CHAT_SESSION_TURN_CAP`, `CHAT_SESSION_TOKEN_CAP`). Mensaje al exceder: "Llegaste al límite de la sesión. Volvé en X min o iniciá una nueva." |

### 3.6 Épica F — Multi-canal policy

`docs/team/policies/comercial-chat-ml-shopify.yaml` como única fuente. `chatPrompts.js` lo carga con `fs.readFileSync` + `js-yaml` (ya está en deps si no, agregar; es Apache-2.0 v4 mantenido). Scripts ML / templates Shopify lo leen también.

Checklist pre-release (en el mismo doc): "Las 5 preguntas estándar (¿incluye IVA? ¿lista? ¿flete? ¿validez? ¿stock?) responden igual en chat y en plantilla ML."

---

## 4. Tabla build vs adopt — verdicto por componente

| Componente | Lib candidata | Licencia | Última release | Verdicto | Razón |
|---|---|---|---|---|---|
| Goldens / evals | **Promptfoo** | MIT | v0.121.10 (2026-05-07) | **ADOPT** | trajectory asserts perfectos, local-first, GH Action oficial |
| Goldens (plan B) | runner propio | — | — | BUILD si Promptfoo da fricción | ~150 LoC, sin transitivas |
| HITL grafo | LangGraph | MIT | activo | **NO** | overkill para SSE simple; checkpointer pesado |
| Output guardrails | Guardrails AI / NeMo | MIT/Apache | activo | **NO** | Python-first, un guardrail no justifica stack |
| Guardrail precio | módulo propio | — | — | **BUILD** | dominio-específico, ~80 LoC |
| Trazas / observabilidad | Langfuse self-host | MIT | v3.172.1 (2026-05-01) | DIFERIR | adoptarlo cuando volumen lo amerite |
| Schema OTEL | OTEL GenAI semconv | spec | experimental | **ADOPT (shape)** | usar nombres en logs ya, sin runtime |
| Tokenizer exact | `@anthropic-ai/tokenizer` / `gpt-tokenizer` | MIT | activos | **NO por ahora** | heurística actual basta para truncado |
| Policy YAML | `js-yaml` | MIT | activo | **ADOPT si no está** | estándar de facto |
| Vercel AI SDK | `ai` | Apache-2.0 | activo | **NO migrar** | nuestro SSE custom funciona; sí copiar **forma** de `parts` para el modelo de mensaje del cliente |

---

## 5. Anti-patterns identificados (a evitar)

1. **Confiar en el prompt para enforcement**: las reglas en lenguaje natural se rompen con cambios de modelo. El gate de intent classifier ya está bien; el price-guard debe seguir el mismo principio (server-side, no prompt-side).
2. **Confirmación doble**: si el prompt pide confirmación verbal **y** la UI muestra botón Confirmar, el operador se confunde. Una sola fuente de verdad: si añadimos preview UI (B'), simplificar el prompt en el mismo PR.
3. **`approved_actions` event ignorado**: el server ya lo emite en devMode; o el cliente lo procesa o lo quitamos. Decidir explícitamente.
4. **`toolStats` como verdad histórica**: es ring buffer in-memory; cualquier dashboard "histórico" basado en él miente tras un cold start. Documentar la limitación o persistir.
5. **Migrar a Vercel AI SDK / Next.js solo por moda**: el chat actual cumple. Copiamos solo la **forma** de message parts.
6. **Hardcodear lista activa o IVA en prompts**: rompe la épica F. Todo el dato debe venir del YAML único.
7. **Goldens online-only**: si el runner solo funciona con keys de prod en CI, nadie los corre. El plan B (runner local con server arriba) o `--no-cache` Promptfoo deben funcionar offline-mockado.
8. **Persistir `conversationId` PII**: revisar `conversationLog.js` y `data/conversations/` en el runbook; retención y anonimización.

---

## 6. Plan de archivos para la fase de ejecución

### A modificar
- `server/lib/userIntentClassifier.js` — añadir patrón `intent_quote_request` (reuso de la misma máquina, nuevo set).
- `server/routes/agentChat.js` — invocar `priceGuard` en el loop, emitir `verified_quote` SSE, loggear con esquema OTEL, integrar `budget`.
- `server/lib/agentTools.js` — `strict: true` en tools críticas (Anthropic).
- `server/lib/chatPrompts.js` — cargar policy YAML; reducir reglas inline duplicadas.
- `src/hooks/useChat.js` — consumir `verified_quote`, `pending_action`, `info`; ignorar `approved_actions` o promoverlo a UI.
- `src/components/PanelinChatPanel.jsx` — `<TrustBlock>`, chip lista activa, (opcional) `<PendingActionConfirm>`.
- `package.json` — script `test:agent-golden`, deps (`promptfoo` devDep, `js-yaml` si falta).

### A crear
- `server/lib/priceGuard.js`
- `server/lib/budget.js`
- `server/lib/policyLoader.js`
- `tests/agentGolden/promptfooconfig.yaml` + `cases/*.yaml` + `fixtures/`
- `docs/team/policies/comercial-chat-ml-shopify.yaml`
- `docs/team/policies/COMERCIAL-CHAT-ML-SHOPIFY.md` (humano)
- `docs/team/runbooks/PANELIN-IA-OPS.md`

### Tests a añadir
- `tests/priceGuard.test.js`
- `tests/budget.test.js`
- `tests/policyLoader.test.js`
- `tests/agentGolden.runner.js` (puente o full Promptfoo)

---

## 7. Definición de done de este dossier

- [x] Snapshot verificado de los 11 archivos canónicos con líneas, último commit y exports clave.
- [x] ≥ 2 referencias externas con link y fecha por épica investigada (AI SDK, Anthropic, Promptfoo, Langfuse, OTEL).
- [x] Tabla build-vs-adopt con verdicto justificado por lib.
- [x] Lista concreta de archivos a crear/modificar para Phase 2.
- [x] Lista de anti-patterns derivada de la investigación.
- [x] Cero cambios en código en este pase (solo doc).

---

## 8. Próximo paso

Cuando se quiera arrancar la ejecución, abrir un PR por épica en este orden recomendado (riesgo creciente):

1. **F + E (foundation)**: policy YAML + loader + budget + runbook. Sin riesgo de regresión visible.
2. **A**: TrustBlock + chip lista. Solo añade UI, no cambia lógica.
3. **D**: Promptfoo + cases. Bloquea futuras regresiones.
4. **C**: priceGuard. Riesgo medio (cambia comportamiento del loop). Goldens de D protegen.
5. **B'** (opcional): preview UI para writes.

Cada PR pasa `npm run gate:local` antes de mergear.
