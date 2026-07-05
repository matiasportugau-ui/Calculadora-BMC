# Auditoría de Arquitectura — Calculadora BMC / Panelin

**Fecha:** 2026-07-04 · **Base:** `main` @ post-#577 (WA canonical ON en prod, smoke gate duro activo)
**Método:** 4 auditorías paralelas exhaustivas (frontend, backend, IA/agentes, integraciones) + síntesis.
**Regla dura:** este informe **documenta** — ningún desarrollo oficial se marca para borrar. Los solapamientos son de *presentación*, y toda evolución propuesta es incremental y reversible.

---

## 1. Estructura exacta actual — visión de conjunto

```
┌─ Vercel (SPA React 18 + Vite 7) ──────────────────────────────┐
│  34 rutas · ~25 módulos grandes · 4 design systems             │
└──────────────────┬─────────────────────────────────────────────┘
                   │ /api (CORS allowlist)
┌─ Cloud Run: panelin-calc (Express 5) ──────────────────────────┐
│  ~50 route files · 10+ workers al boot · 4 capas de auth       │
│  IA: 7 asistentes + seam · omni orchestrator (6 job types)     │
└───┬──────────────┬───────────────┬─────────────────────────────┘
    │              │               │
 Google Sheets   Postgres        GCS
 (6 workbooks)   (omni_*, wa_*,  (ML tokens, PDFs,
                 identity.*,      brain lessons)
                 traktime, transportista)

Integraciones: Meta WA (canonical) · MercadoLibre · Gmail · Chatwoot ·
Shopify · Google Tasks · Drive · OpenAI Realtime (voz)
CI/CD: 23 workflows · deploy con smoke gate duro · Doppler + GSM + GH vars
```

---

## 2. Frontend — rutas y módulos

### 2.1 Las 34 rutas (`src/App.jsx`)

| Grupo | Rutas | Guard típico |
|---|---|---|
| **Hub operativo** | `/hub`, `/hub/ml`, `/hub/ml-manager`, `/hub/wa`, `/hub/canales`, `/hub/tareas`, `/hub/clientes`, `/hub/proyecto`, `/hub/planos`, `/hub/traktime/*`, `/hub/marketing` | `RequireGrant module=… minLevel=read` |
| **Admin** | `/hub/admin`, `/hub/admin/users`, `/hub/admin/analytics`, `/hub/admin/assistants`, `/hub/cotizaciones` (flag V2), `/hub/bugs`, `/hub/agent-admin` | `RequireGrant role="admin"` |
| **Core negocio** | `/` (landing+calculadora), `/calculadora`, `/logistica`, `/conductor`, `/mi-espacio` | `Shell` |
| **Herramientas** | `/inspector`, `/especificaciones`, `/presentacion-licitacion`, `/fichas`, `/panelin/live` | mixto |
| **Preview/legacy** | `/preview/pdf`, `/preview/design-mockups`, redirects (`/wa`, `/hub/plan-import`, `/hub/crear-plano`, `*`) | — |

Feature flag activo: `VITE_FEATURE_ADMIN_COT_V2` conmuta `/hub/admin` (V1) ↔ `/hub/cotizaciones` (V2) con escape `?legacy=1`.

### 2.2 Módulos principales (tamaño ≈ complejidad)

| Módulo | Líneas | Qué hace para el usuario | Madurez |
|---|---|---|---|
| `BmcLogisticaApp` | 2483 | Operación logística completa: cargas, rutas, remitos | activo, monolito |
| `AgentAdminModule` | 2187 | Consola IA: KB, prompt, logs, stats, scoring, voz | activo, monolito |
| `CalcLogicInspector` | 1901 | Ver/editar fórmulas de cálculo + comparativa Kingspan | activo |
| `PanelinCalculadoraV3_backup` | (grande) | **La calculadora canónica** (BOM, PDF, WA, historial) | ⚠ nombre confuso: "_backup" ES el activo |
| `BmcMlOperativoModule` | 940 | Cola CRM ML: sugerir (IA), aprobar, publicar | activo |
| `MySpacePage` | 812 | Área personal: cotizaciones, bandeja, tareas, requests | activo |
| `BmcAdminCotizacionesModule` | 729 | Admin cotizaciones V1 (wolfboard API) | activo |
| `BmcCanalesUnificadosModule` | 591 | Inbox unificado ML+WA+IG/FB + Omni Inbox embebido | activo, dual-surface |
| `TasksModule` | 533 | Google Tasks espejo bidireccional | activo |
| `ProyectoStatusModule` | 440 | Estado/progreso de proyecto | activo |
| `AdminCotizacionesModule` (V2) | 434 | Admin cotizaciones V2 tokenizada (skins) | flag-gated |
| `BmcPlanosModule` | 381 | Croquis/plano → DXF/SVG + cotización | activo |
| `ClientesMVP` | 294 | Vista 360 de clientes + marcar contactado | MVP |
| `MarketingHubModule` | 287 | Market intel: KPIs, alertas, mystery shopping, brief IA | activo |
| `DriverTransportistaApp` | 294 | App conductor: viajes, eventos, evidencia | activo |
| `BmcWolfboardHub` | 254 | Landing de cards del hub | activo, **incompleto** |
| `AssistantsStatusPanel` | 169 | Salud del control plane IA (poll 15s) | activo |
| `MlManagerModule` | 97 | Publicaciones/preguntas/pedidos ML | activo |

### 2.3 Los 4 design systems coexistentes

| Sistema | Definición | Usado por | Estética |
|---|---|---|---|
| **A. adminCot tokens `--ac-*`** + `SkinProvider` (6 skins: macos/bmc/gnome/anthropic/linear/intel-dark) | `admin-cotizaciones/styles.css` | AdminCotizaciones V2, Marketing, AssistantsStatus | glass tokenizado |
| **B. Apple inline** | estilos inline por componente | Hub, ML operativo, WA cockpit, la mayoría | app clásica clara |
| **C. Studio themes** (`--bmc-*`, `data-studio`) | `bmc-studio-themes.css` + `BmcStudioThemeProvider` | shell/live preview (6 studios) | premium glass |
| **D. CSS suelto** | `bmc-glass.css`, `OmniInboxPanel.css`, etc. | Omni inbox, chrome | mixto |

**Consecuencia:** el usuario cruza 2–3 lenguajes visuales en una sesión normal (hub Apple → cockpit inline → admin tokenizado).

### 2.4 Hub incompleto — 14 rutas sin card

Con ruta funcionando pero **sin card en el hub**: `/hub/admin/users`, `/hub/admin/analytics`, `/hub/admin/assistants`, `/hub/bugs`*, `/hub/traktime`, `/mi-espacio`, `/conductor`, `/inspector`*, `/especificaciones`, `/presentacion-licitacion`, `/fichas`, `/preview/pdf`, `/preview/design-mockups`, `/panelin/live`. (*bugs e inspector sí tienen card en "Herramientas internas" — el resto no.)

---

## 3. Backend — wiring y datos

### 3.1 Orden de middleware (server/index.js)

`x-powered-by off` + `trust proxy` → CORS manual OPTIONS → `cors()` allowlist → security headers (CSP frame-ancestors para /chat, X-Frame-Options DENY) → `express.raw()` **solo** para webhooks WA/Shopify (firma HMAC sobre bytes crudos) → `express.json()` → `cookieParser` → `pino-http`.

### 3.2 Gates de IA (los 6 + 1)

| Ruta | Gate |
|---|---|
| `/api/agent/chat` | `requireAssistantEnabled("panelin")` (público by design detrás de limiter) |
| `/api/email-agent/chat` | `requireCrmCockpitWrite` + gate `email` |
| `/api/wa/suggestions/run`, `/api/wa/quotes/run` | `requireWaAccess` + gate `wa` |
| `/api/crm/suggest-response` | `aiGenLimiter` (20/min) + `requireServiceOrUser({authOnly})` + gate `ml` (endurecido hoy, PR #567) |
| `/api/wolfboard/quote-batch` | `requireWolfboardWrite` + gate `wolfboard` |
| `omniRouter` (canales) | **nunca gated** — no se puede apagar por accidente |

### 3.3 Workers al boot (10)

| Worker | Condición | Función |
|---|---|---|
| `startOmniAiWorker` | `OMNI_AI_ORCHESTRATOR_ENABLED` | drena `omni_ai_jobs` (SKIP LOCKED, batch 5, 5s) |
| `startOmniSnoozeWorker` | pool omni | despierta conversaciones snoozed |
| `startOmniFrtBreachWorker` | `OMNI_FRT_WORKER_ENABLED` | registra breaches de SLA primera respuesta |
| `startWaSlaWorker` + `startWaFollowupsWorker` | pool WA | SLA y follow-ups WA |
| `startWaEnricherWorker` | flag DB o env | enriquecimiento WA |
| `startTransportistaOutboxWorker` | pool | outbox transporte |
| `startTraktimeMirrorWorker` | pool + flag | espejo Sheets nocturno |
| `startOrphanCloseScheduler` | — | cierra sesiones huérfanas |
| marketIntel scheduler | import side-effect | ETL diario 03:00 UTC |

### 3.4 Capas de auth (4 sistemas coexistentes)

1. **Service token** (`API_AUTH_TOKEN` via Bearer/x-api-key) — CI, crons, scripts
2. **Identity JWT** (Google login; roles `superadmin>admin>operator>comprador`; 10 módulos con grants read/write) — usuarios BMC
3. **WA operator JWT** (magic link; `wa_operators`) — cockpit WA
4. **Dev-mode auth** (`requireDevModeAuthMiddleware`) — paneles de entrenamiento

`requireServiceOrUser` es el puente (acepta 1 o 2; `authOnly:true` = cualquier identidad sin exigir grant).

### 3.5 Datos

- **Sheets (6 workbooks):** CRM_Operativo (contrato header-anchored anti column-shift), Pagos, Ventas, Stock, Calendario, MATRIZ. Escritores: crmIngestWrite (WA), ml-crm-sync, wolfboard, quoteDualWrite, traktimeMirror.
- **Postgres:** `omni_*` (9 tablas: conversations, messages, ai_jobs, suggestions, prompt/model registry, ingest_dedup, notes, frt_breaches, contact_merge_log) · `wa_*` (5) · `identity.*` (users, grants, MFA) · traktime/transportista.
- **GCS:** tokens ML, PDFs de cotización, brain lessons.
- **Config:** ~70 keys en `server/config.js`. Transporte a prod: `env_vars` del deploy (⚠ separa por comas → `ASSISTANTS_ACTIVE` usa `;`), `--set-secrets` de GSM (21 secrets tras #570), o **default-only** (gap latente: `ML_CLIENT_ID`, `BMC_MATRIZ_SHEET_ID`, `CHATWOOT_*`, `TRAKTIME_*`, `TRANSPORTISTA_*`, `BRAIN_*`, `RAG_*` — hoy llegan por Cloud Run env histórico o quedan en default).

---

## 4. IA y agentes — configuración exacta

### 4.1 Control plane

- **Registry** (`assistantRegistry.js`): 7 asistentes — `canales` (probe: omni DB), `panelin` (sin deps), `email` (probe: Chatwoot completo), `wa` (probe: DATABASE_URL), `ml` (probe: ML_CLIENT_SECRET), `wolfboard` (sin deps), `seam` (terminal, always-on).
- **Master switch:** `ASSISTANTS_ACTIVE` — prod hoy = `canales;ml` (separador `;` por el bug del deploy action; parser acepta `/[,;]/` desde PR #561). Gate → 503 `assistant_disabled`.
- **Fallback line:** `canales→panelin→email→wa→ml→wolfboard→seam`, salta disabled.

### 4.2 Seam (cadena de proveedores)

- Orden capability-aware (hoy): **claude → gemini → grok → openai** (gemini 2º porque ejecuta tools nativas; grok/openai text-only en chat).
- `callWithTimeout` 30s default (`AGENT_PROVIDER_TIMEOUT_MS`) — aborta y race-rechaza.
- Cooldown: 3 fallos/60s → **depriorización** (nunca eliminación); expuesto en `providerCooldowns` de `/api/assistants/status`.
- Costos: `estimated_cost_usd` calculado en `agentCore` y `aiCompletion`.

### 4.3 Omni orchestrator

- Bus → `enqueueIngestAiJobs`: `classify` + `suggest` (+ `wa_crm_sync` si canonical).
- 6 job types permitidos; claim SKIP LOCKED; retries → dead a los 2 intentos; dead-letter alertable por métrica.
- `wa_crm_sync`: coalescido por conversación (índice parcial), debounce `run_after` 60s re-stampable, **exento del budget** (lead capture nunca se frena por spend).
- Budget diario (`OMNI_AI_DAILY_BUDGET_USD=50`): scoped **solo a `suggest`**.
- 🚀 canónico: `triggerWaCrmSyncNow()` adelanta `run_after` (spot-check e2e verificado hoy en prod).
- Prompt/model registry en DB (`omni_prompt_registry`/`omni_model_registry`) — solo omni lo usa; el resto de superficies tienen prompts hardcodeados.

### 4.4 Superficies IA (12) y su telemetría

Panelin chat (Claude+tools), suggest-response (chain), email agent (Anthropic tool-loop→seam), WA suggestions/quotes, wolfboard batch, omni assist (dispatchAssistant), ML auto-answer, superAgent (Haiku), teamAssist (OpenAI), plan interpret/cad (visión), marketing brief, voz (OpenAI Realtime + whisper-1).

**GAP CENTRAL:** la telemetría de uso/costo está **fragmentada en 4 lugares** (logs pino `agent_core_call`/`ai_completion`, `omni_ai_jobs.cost_usd`, `/api/ai-analytics/trends`, userActivityLog) — **no existe** tabla unificada `ai_usage_events` ni panel de spend. No hay inventario de keys ni rotación in-app.

---

## 5. Integraciones — flujos e2e verificados

### 5.1 WhatsApp (canonical ON desde hoy)

`Meta webhook → verifyWhatsAppSignature (HMAC raw body) → chooseWaIngestMode (exige canonical+bus+orchestrator) → normalizeAndPersist → omni → [🚀 → triggerWaCrmSyncNow] → wa_crm_sync (debounce 60s, insert-once por teléfono, header-anchored) → CRM_Operativo + mirror wa_messages → cockpit /hub/wa`

Outbound unificado: `postWhatsAppMessage` (único caller de Graph API) con adapters `sendWhatsAppText`/`sendWaReply`. Read-model `OMNI_WA_READS` listo (OFF). Cutover workflow con migrate/flip_on/flip_off/soak.

### 5.2 MercadoLibre

`webhook (HMAC template id:…;request-id:…;ts:…) → syncUnansweredQuestions (dedup Q:<id> en Observaciones) → [fullAuto: autoAnswerPipeline → AF + /answers + AJ]`. OAuth PKCE con refresh y token en GCS. Cockpits: /hub/ml (cola CRM) + /hub/ml-manager (publicaciones).

### 5.3 Cotización (core del negocio)

`POST /calc/cotizar/pdf → runCalculation → buildGptResponse → generatePrintHTML → storePdf → [GCS ∥ Drive] → registerQuotation → upsertQuote → sheetEnqueue (debounce 60s)`

### 5.4 CI/CD

23 workflows. Deploy: CI verde en main → build → Artifact Registry → Cloud Run → **smoke 9/9 gate duro** (con `API_AUTH_TOKEN`, desde PRs #566/#575). Crons: smoke 2×/día con auto-issues, email ingest 30min hábil, matriz-sync, ETL marketing. Secretos: Doppler (fuente humana) → GSM (runtime prod) → GH vars (flags de deploy).

---

## 6. Mapa de solapamientos (nada se borra — solo se documenta)

### 6.1 "Responder consultas de clientes" — 7 superficies

| Superficie | Especialización real | Estado |
|---|---|---|
| `/hub/canales` (BmcCanalesUnificados) | inbox multicanal + Omni embebido | **el más integrador** |
| `/hub/ml` (BmcMlOperativo) | cola CRM específica ML con IA | activo |
| `/hub/ml-manager` | gestión de publicaciones (no consultas per se) | activo, complementario |
| `/hub/wa` (BmcWaCockpit) | cockpit WA con SLA/followups | activo |
| `/hub/admin` (V1) | pendientes wolfboard + batch IA | activo |
| `/hub/cotizaciones` (V2) | ídem V1 con skin nueva | flag OFF |
| OmniInboxPanel | superficie estilo Chatwoot | embebido en canales |

**Lectura honesta:** no son duplicados accidentales — son especializaciones por canal que comparten backend (`/api/crm/cockpit/*`). El costo real es **cognitivo y de mantenimiento de UI**, no de lógica duplicada. La dupla V1/V2 de admin cotizaciones sí es una transición inconclusa (flag OFF hace meses).

### 6.2 Otros solapamientos

- **`/finanzas` estático** (HTML 3.5k líneas servido por la API, iframe desde calculadora legacy) vs módulos SPA — único gran surface fuera de React. Secciones que duplican presentación: Entregas (→ `/logistica`), Consultas Wolfboard (→ `/hub/canales`), Audit (→ admin analytics).
- **Calculadora**: `_backup.jsx` es el canónico (declarado en App.jsx); `_legacy_inline.jsx` sobrevive para transición. Nombres invertidos respecto a la realidad.
- **ClientesMVP vs CRM sheets**: complementarios (360 vs operación), no duplicados.
- **Tasks vs Proyecto**: superficies distintas, no sustitutas.

---

## 7. Interpretación funcional por usuario

| Usuario | Qué usa hoy | Fricción actual |
|---|---|---|
| **Operador de ventas** | Canales/ML/WA cockpits, calculadora, Mi Espacio | 3 cockpits con 3 looks distintos; hub no muestra todo |
| **Admin/dueño (Matias)** | Todo + admin users/analytics/assistants + finanzas + marketing | finanzas fuera de la SPA; sin vista de spend IA; sin rotación de keys in-app |
| **Conductor** | `/conductor` (app dedicada) | ok, aislada por diseño |
| **Cliente final** | calculadora pública + Panelin chat + PDFs | ok |
| **Agentes IA (GPT actions)** | `/calc/gpt-entry-point`, capabilities, superAgent | ok |
| **CI/crons** | service token: smoke, ingest, sync, ETL | ok tras endurecimiento de hoy |

---

## 8. Diagnóstico

### Fortalezas (no tocar)
1. **Backend por capas con gates componibles** — el patrón `limiter → auth → assistant-gate → router` es sólido y se acaba de endurecer.
2. **Omni orchestrator** — cola durable con coalescing/debounce/budget/dead-letter es arquitectura de adulto; el flip canonical de hoy lo confirmó e2e.
3. **Contrato header-anchored en Sheets** — anti column-shift, ya batalla-probado.
4. **Failover IA multicapa** — asistente→asistente y proveedor→proveedor con cooldowns y timeouts (hardening de hoy).
5. **CI/CD madura** — smoke gate duro, cutover dispatchable, crons con auto-issues.

### Deudas (ordenadas por impacto)
1. **Telemetría IA fragmentada** — sin `ai_usage_events` no hay respuesta a "¿cuánto gastamos ayer y en qué?"; el budget solo cubre `suggest` de omni.
2. **4 design systems** — inconsistencia visual real entre hub/cockpits/admin; duplicación de estilos.
3. **`/finanzas` fuera de la SPA** — sin auth de identidad (endpoints data abiertos o token-only), sin skins, con secciones que duplican presentación; el fix de parsing de hoy (#565) arregló los números pero la superficie sigue siendo legacy.
4. **Hub incompleto** — 14 rutas invisibles; el hub no es el mapa real de la app.
5. **Transición V1/V2 admin cotizaciones congelada** — flag OFF, dos módulos mantenidos.
6. **Monolitos frontend** — 3 módulos >1900 líneas dificultan cambios seguros.
7. **Nombres confusos** — `_backup` es canónico; `_legacy_inline` sigue vivo.
8. **Config default-only** — varias keys críticas no viajan por el deploy (quedaron en env histórico de Cloud Run); riesgo de drift silencioso (el caso `WHATSAPP_APP_SECRET` de hoy fue exactamente esto).
9. **Prompts hardcodeados** fuera de omni — el prompt/model registry existe pero solo omni lo usa.
10. **4 sistemas de auth** — coherentes pero con curva de aprendizaje alta para tocar rutas.

---

## 9. Propuesta de evolución (etapas incrementales, reversibles, sin borrar nada)

### Etapa 1 — Unificación visual y hub completo *(bajo riesgo, alto impacto percibido)*
- Elegir **sistema A (tokens `--ac-*` + SkinProvider)** como canónico — es el más maduro y tokenizado.
- Crear card component compartido; rediseñar `BmcWolfboardHub` en secciones (**Operación / IA & Automatización / Finanzas & Analytics / Herramientas**) mostrando TODAS las superficies (las 14 huérfanas incluidas, con badges admin-only donde aplique).
- Los módulos existentes migran de estética **gradualmente** (uno por PR); ninguno se rompe.
- *Reversión:* CSS/estructura de hub — trivial.

### Etapa 2 — AI Control Plane (`/hub/ia`) *(cierra deuda #1)*
- Migración `ai_usage_events` + hook writer en el seam (`callAgentOnce`/`aiCompletion`) → TODO uso IA queda en un lugar.
- `GET /api/ai/usage` (agregados por asistente/proveedor/día) · `GET /api/ai/keys` (inventario sin valores) · `POST /api/ai/keys/:name/rotate` (GSM addSecretVersion; superadmin-only, write-only, audit, rate-limit; nota churn/redeploy).
- UI 3 tabs: Estado (absorbe AssistantsStatusPanel con redirect reversible) · Claves & APIs · Consumo (budget bar).
- *Reversión:* flag por tab; el panel viejo sigue existiendo.

### Etapa 3 — Finanzas moderna (`/hub/finanzas`) *(cierra deuda #3)*
- Módulo React con best practices: KPI cards (por cobrar/pagar, split $/U$S, vencido), **aging buckets** 0-30/31-60/61-90/90+, timeline de flujo de caja (SVG, sin deps nuevas), breakdown con filtros, calendario, metas.
- Consume endpoints existentes (números ya confiables tras #565); auth de identidad real.
- Duplicados de presentación → links a `/logistica`, `/hub/canales`, admin.
- **El `/finanzas` estático queda intacto**; a lo sumo un link discreto "probar versión nueva". Su retiro sería decisión futura explícita.

### Etapa 4 — Convergencia de superficies de consultas *(medio plazo, decisión de producto)*
- `/hub/canales` como **superficie integradora canónica**; ML/WA cockpits quedan como vistas especializadas (ya casi lo son).
- Resolver la transición V1/V2 de admin cotizaciones: o flip del flag con plan, o V2 absorbe features faltantes y V1 pasa a `?legacy=1` permanente.
- Omni read-model (`OMNI_WA_READS=1`) tras validar en staging → luego retirar dual-write `wa_messages` (ya diseñado en runbook).

### Etapa 5 — Higiene de plataforma *(continuo)*
- Renames seguros: `PanelinCalculadoraV3_backup` → nombre canónico (con alias de import).
- Split incremental de los 3 monolitos (>1900 líneas) en submódulos.
- Mover config default-only crítica al deploy workflow (auditoría de drift: comparar env real de Cloud Run vs deploy YAML — el gap de hoy no debe repetirse).
- Extender prompt/model registry a superficies no-omni (una por vez).

### Secuencia recomendada
**1 → 2 → 3** son independientes entre sí tras la 1 (pueden paralelizarse), **4** requiere decisiones de producto de Matias, **5** es continuo. Cada etapa = PR(s) chicos con gate:local verde y reversión documentada.

---

## 10. Anexos — reportes fuente

Los 4 reportes de auditoría detallados (con paths y números de línea exactos) están archivados en la sesión de trabajo. Este documento es la síntesis; ante duda sobre un detalle, el código es la fuente de verdad y los paths citados arriba son verificables.

| Frente | Alcance verificado |
|---|---|
| Frontend | 34 rutas, ~25 módulos, 4 design systems, 14 gaps de hub |
| Backend | wiring completo index.js, ~50 routers, ~70 config keys, 4 auth layers |
| IA/agentes | registry 7+seam, cadenas, orchestrator, 12 superficies, telemetría |
| Integraciones | WA/ML/Email/Shopify/Tasks/TrakTime/Transportista/Marketing + 23 workflows |
