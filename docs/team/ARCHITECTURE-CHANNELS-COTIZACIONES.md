# Arquitectura & Specs — Módulos de Canales y Cotizaciones

> **Alcance:** mapa arquitectónico y funcional de cinco módulos operativos `/hub/*` de `calculadora-bmc`
> (React 18 + Vite SPA · Express 5 API en Cloud Run `panelin-calc`).
> Validado contra el código vivo (componentes de entrada en `src/App.jsx`, registros de rutas backend, existencia de archivos).
> Las citas son `archivo:línea` y deben confiarse a nivel de símbolo; algunos números de línea pueden derivar por unas pocas líneas.
>
> Generado 2026-06-25. Sin cambios de comportamiento en producción — documento de referencia.

Módulos cubiertos:

| Ruta | Módulo | Storage | Grant | Función |
|---|---|---|---|---|
| `/hub/canales` | `BmcCanalesUnificadosModule` | Sheets `CRM_Operativo` + Postgres Omni | `canales` | Cola omnicanal unificada (ML/WA/IG/FB) |
| `/hub/wa` | `BmcWaModuleWithTabs` → `BmcWaCockpit` | Postgres `wa_*` | `wa` | Cockpit WhatsApp profundo (F1–F5) |
| `/hub/ml-manager` | `MlManagerModule` | API ML en vivo | `canales` | Admin de cuenta vendedor ML |
| `/hub/ml` | `BmcMlOperativoModule` | Sheets `CRM_Operativo` `A:AK` | `canales` | Cola de preguntas ML con IA + automatización |
| `/hub/cotizaciones` | `AdminCotizacionesModule` | Sheets `Admin 2.0` + merge CRM | **admin** | Gestión de cotizaciones |

---

## 0. Fundaciones compartidas (válido para los 5 módulos)

- **Routing** — los cinco se cargan con `lazy()` en `src/App.jsx`, envueltos en `<Shell>` + `<RequireGrant>`:
  - `BmcMlOperativoModule` (`src/App.jsx:45`) → `/hub/ml` (`:193`)
  - `MlManagerModule` (`:61`) → `/hub/ml-manager` (`:205`)
  - `BmcWaModuleWithTabs` (`:46`) → `/hub/wa` (`:217`)
  - `BmcCanalesUnificadosModule` (`:47`) → `/hub/canales` (`:229`)
  - `CotizacionesRoute` (`:132`) → `/hub/cotizaciones` (`:303`), renderiza `AdminCotizacionesModule` (`:49,139`)
- **RBAC** — HOC `RequireGrant` (`src/components/auth/RequireGrant.jsx`), grants por módulo `none < read < write < admin`, `superadmin` lo saltea. Módulo por ruta:
  - `/hub/ml`, `/hub/ml-manager`, `/hub/canales` → `module="canales", minLevel="read"`
  - `/hub/wa` → `module="wa", minLevel="read"`
  - `/hub/cotizaciones` → `role="admin"` (solo admin)
- **Auth de operador** — el frontend usa `useCockpitOperatorAuth({ module, minLevel })`: prefiere JWT de operador (magic-link), cae a token compartido legacy `API_AUTH_TOKEN`. El backend (`requireServiceOrUser` / `requireCrmCockpitRead|Write` / `requireWaAccess`) acepta JWT BmcAuth, JWT de operador WA o token legacy (deprecación `Sunset: 2027-01-01`).
- **Semántica de errores Sheets** — `503` = store no disponible, `200` + vacío = sin datos, **nunca `500`** para fallas de Sheets. Los frontends dependen de esto.
- **Puntos de montaje API** (`server/index.js`): `app.use("/api", omniRouter)` (`:1000`), `app.use("/api", createWaRouter(...))` (`:1002`); las rutas proxy ML son top-level `/ml/*` y `/auth/ml/*` en `server/index.js`; rutas de cotizaciones/CRM bajo `/api/wolfboard/*` y `/api/crm/*`.

---

## 1. `/hub/canales` — Canales Unificados

**Entrada:** `BmcCanalesUnificadosModule` (`src/components/BmcCanalesUnificadosModule.jsx`). Auth `useCockpitOperatorAuth({ module:"canales", minLevel:"write" })`.

**Función:** una sola cola de operador que unifica leads/preguntas de **ML, WA, IG, FB** desde la planilla `CRM_Operativo`, más un inbox Omni opcional sobre Postgres + kanban de deals.

**Árbol de componentes:**
- Cola unificada (desde `CRM_Operativo`) — cargar/filtrar por canal, copiar respuesta IA (col AF), pegar link de cotización (col AH), aprobar (col AI), enviar (col AJ).
- Paneles en `src/components/hub/canales/`: `MlManagerPanel`, `WaInboxPanel`, `UnifiedContactsPanel` (stubs de fase temprana), más los gated por flag:
  - `OmniInboxPanel` (`VITE_OMNI_INBOX=1`) → `OmniThreadPanel` + `OmniContactSidebar`
  - `OmniDealsKanban` (`VITE_OMNI_DEALS=1`)

**Backend consumido:**
- Cola CRM: `GET /api/crm/cockpit/unified-queue`, `POST /api/crm/cockpit/sync-all`, `.../quote-link`, `.../approval`, `.../send-approved` (Sheets `CRM_Operativo` + APIs ML/WA).
- Omni (real, `server/routes/omni.js`, montado en `/api`): `GET /api/omni/conversations`, `.../messages`, `POST .../reply`, `PATCH .../read`, `GET /api/omni/deals` + `PATCH`, `GET /api/omni/suggestions`. Hooks en `src/hooks/useOmniConversations.js`.

**Modelo de datos:** Sheet `CRM_Operativo` (tag de origen por fila; col AF respuestaSugerida, AH linkPresupuesto, AI aprobado, AJ enviadoEl) + tablas Postgres `wa_*`/omni para la superficie Omni.

**Estado:** fetch al montar/filtrar, `reload()` manual tras mutaciones, token en localStorage. **Sin SSE/WebSocket.**

**Cross-links:** `OmniContactSidebar` enlaza a `/hub/wa`, `/hub/ml`, y `/hub/cotizaciones?row=<crm_row_id>`.

---

## 2. `/hub/wa` — WhatsApp Cockpit

**Entrada:** `BmcWaModuleWithTabs` (`src/components/BmcWaModuleWithTabs.jsx`) — switch entre el **Cockpit** sobre Postgres (`BmcWaCockpit.jsx`) y una vista Sheet legacy (`BmcWaOperativoModule`). Auth `module="wa"`.

**Función:** la herramienta profunda de engagement WhatsApp (F1–F5): ingest del inbox, sugerencias IA, generación de cotizaciones, follow-ups/consentimiento, outbound multi-operador.

**Layout (`BmcWaCockpit.jsx`):** 3 columnas — lista de chats (ordenada `last_msg_at DESC`) · hilo de mensajes · panel derecho con pestañas (Sugerencias AI · Cotizar · CRM · Follow-ups · Configuración).

**Backend (`server/routes/wa.js`, montado en `/api`, declaraciones multilínea `router.get|post|patch|delete`):**
- Inbox: `GET /api/wa/health|conversations|messages`, `POST /api/wa/ingest` (batch idempotente desde extensión Chrome).
- F2 Sugerencias: `GET /api/wa/suggestions`, `POST .../run`, `POST .../{id}/chosen` (3 tonos: corta/técnica/cierre).
- F3 Cotizaciones: `GET /api/wa/quotes`, `POST .../run` (loopback al motor de cálculo), `POST /api/wa/conversations/{id}/upsert-lead` (vincular fila CRM + owner).
- F4 Follow-ups/Consent: `GET|POST /api/wa/followups`, `PATCH .../{id}`, `POST /api/wa/conversations/{id}/consent`.
- Outbound: `POST /api/wa/outbound` (`paste_back` vía extensión **o** `cloud_api` vía WhatsApp Cloud API, respetando la ventana de servicio de 24h de Meta), `POST .../{msg_id}/confirm`. Rate limits: 6/min por chat, 30/min por operador, tope diario 50/24h.
- Admin/F5: `GET /api/wa/config`, `PATCH /api/wa/settings`, `PATCH /api/wa/flags/{key}`, CRUD de operadores + auth magic-link (`/api/wa/auth/*`), `wa_rules`, `wa_webhooks`, `wa_audit_log`.

**Modelo de datos (Postgres, `wa-package/migrations/*.sql`):** `wa_conversations`, `wa_messages` (idempotente por `msg_id`), `wa_suggestions`, `wa_quotes`, `wa_followups`, `wa_operators`, `wa_audit_log`, `wa_rules`, `wa_webhooks`, `wa_settings`, `wa_flags`.

**Workers de fondo** (arrancados en `server/index.js`): `startWaSlaWorker`, `startWaFollowupsWorker`, `startWaEnricherWorker`, más el AI worker de Omni.

**Estado:** fetch con debounce (250ms) sobre query/status; lazy-load por chat de sugerencias/cotizaciones; token en localStorage + puente `postMessage` con la extensión Chrome. **Sin SSE/WebSocket** (el ingest de la extensión es estilo webhook).

---

## 3. `/hub/ml-manager` — ML Manager

**Entrada:** `MlManagerModule` (`src/components/hub/ml/MlManagerModule.jsx`). Shippeado en PR #412, cableado al `panelin-calc` vivo. Auth `module="canales"` (gate solo en frontend). Estilado con tokens `adminCot` (`data-skin="macos"`).

**Función:** admin directo de la **cuenta vendedor** de MercadoLibre (publicaciones, preguntas, pedidos) vía proxy a la API ML en vivo.

**Pestañas:** `OverviewTab` (vendedor + reputación, conteos), `ListingsTab` (filtro de estado, paginación 50/página, `EditDrawer` → editar precio/stock/estado/fotos/descripción con confirmación de 2 etapas), `QuestionsTab` (`UNANSWERED`, respuesta inline), `OrdersTab` (solo lectura).

**Backend (proxy ML en `server/index.js`, todo público — token validado/refrescado por llamada):**
- OAuth: `GET /auth/ml/start` (`:297`), `/auth/ml/callback` (`:311`), `/auth/ml/status` (`:337`).
- `GET /ml/users/me` (`:357`), `/ml/listings` (`:373`), `/ml/items/:id` (`:383`), `PATCH /ml/items/:id` (`:391`), `POST /ml/items/:id/description` (`:400`), `GET /ml/questions` (`:421`), `POST /ml/questions/:id/answer` (`:479`), `GET /ml/orders` (`:495`).

**Cliente:** `src/components/hub/ml/utils/mlFetch.js` (credentials:include, misma API base que la calc), hooks en `src/components/hub/ml/hooks/useMlConnector.js` usando **@tanstack/react-query** (staleTime 30s; las mutaciones invalidan keys). Es el único de los cinco que usa React Query.

**Modelo de tokens OAuth (`server/mercadoLibreClient.js` + `server/tokenStore.js`):** access token ~6h (auto-refresh ~60s antes de expirar, dedup de in-flight), refresh token ~6mo. Storage: dev en archivo `./server/.ml-tokens.json` (AES-256-GCM opcional vía `TOKEN_ENCRYPTION_KEY`); prod en **GCS `gs://bmc-ml-tokens`** con identidad de Cloud Run. Modos de falla: 401 → re-login `/auth/ml/start`; 429 → backoff; 503 → GCS/creds faltantes.

---

## 4. `/hub/ml` — ML Operativo

**Entrada:** `BmcMlOperativoModule` (`src/components/BmcMlOperativoModule.jsx`). Auth `module="canales"`, write requerido para mutaciones.

**Función:** cola operativa para responder preguntas ML (y filas CRM) con IA, gateada por aprobación humana, luego auto-enviar — con automatización completa opcional.

**Layout:** pills de stats · log estilo terminal CRT · botones de acción (PULL ML / PULL CRM / SYNC / GENERAR / ENVIAR TODO) · panel **AUTOMATISMOS** (switches: ML-AUTO-PULL 5min, CRM-AUTO-PULL 2min, AUTO-SYNC 10min, AI-RESPONSE-AUTO-GEN, tapado `100% AUTÓNOMO`, eyectar `CORTAR TODO`) · panel de token · tabla ordenable con edit/aprobar/enviar inline.

**Backend (`server/routes/bmcDashboard.js`, bajo `/api`):**
- `GET /api/crm/cockpit/ml-queue` (`:3289`), `POST /api/crm/cockpit/sync-ml` (`:3344`), `POST /api/crm/suggest-response` (`:2321`, cascada de 4 LLM), `POST /api/crm/cockpit/save-response` (`:3142`), `.../approval` (`:3075`), `.../send-approved` (`:3287`, dual-write ML + WA + omni outbox).
- Toggle full-auto: `GET|POST /api/ml/auto-mode` (`server/index.js:619,623`; persiste `server/.ml-automode.json`, efímero en cold start).

**Modelo de datos:** Sheet `CRM_Operativo` rango `A:AK` (cols de gate AG provider, AH link, AI aprobado, AJ enviadoEl, AK bloquearAuto). Parser `server/lib/crmRowParse.js` (`parseCrmRowAtoAK`), motor de sync `server/ml-crm-sync.js`. Las preguntas ML se rastrean por `Q:<id>` en la col W (observaciones).

**Estado:** refs para esquivar stale closures (`autoRef`/`itemsRef`/`firingRef`), timers `setInterval` limpiados al desmontar, config de automatización persistida en localStorage `bmc-auto-cfg`. **Basado en polling, sin SSE.**

**Sistema lateral de market-intel** (`server/lib/marketIntel/`, cron 03:00 UTC vía `scheduler.js` → `etl/runner.js`): scraping de competidores (consciente de robots.txt y CAPTCHA con uniones discriminadas), delta dedup, historial de precios + alertas en Postgres `bmc_market_intel.*`; alimenta el contexto RAG, no se expone directamente en la UI de ML.

---

## 5. `/hub/cotizaciones` — Admin Cotizaciones (solo admin)

**Entrada:** `CotizacionesRoute` → `AdminCotizacionesModule` (`src/components/AdminCotizacionesModule.jsx`), gated por `VITE_FEATURE_ADMIN_COT_V2==="true"` (si no, redirige al legacy `/hub/admin`). Envuelto en `SkinProvider` (5 skins) + `HelpProvider`. Hook de estado `src/hooks/useAdminCotizaciones.js`.

**Función:** board admin para triar, cotizar con IA, aprobar, asignar y archivar pedidos de cotización fusionados desde la planilla **Admin 2.0** y la cola **ML de CRM_Operativo**.

**Árbol de componentes (`src/components/admin-cotizaciones/`):** `Topbar`, `StatStrip` (KPIs), `Toolbar` (scope/status/search + batch IA + sync + export + nueva fila), vistas `QuotesTable` / Kanban / `QuoteCard`, `DetailDrawer` (editar/aprobar/enviar, `WaTimelineInline` inline, ✦ Sugerir IA), `CommandPalette` (⌘K). Anclas de ayuda en `src/components/help/anchors.js`.

**Backend (`server/routes/wolfboard.js`, bajo `/api/wolfboard`):** `GET /pendientes?scope=consulta|admin` (`:356`, Admin 2.0 `A2:M` + merge best-effort de `/api/crm/cockpit/ml-queue`), `POST /sync` (`:394`, Admin J → CRM AF), `POST /row` (`:475`, guardar/aprobar + PATCH best-effort de responsable), `POST /row-create` (`:570`), `POST /enviados` (`:631`, archivar+borrar), `GET /export` (`:715`, CSV), `POST /quote-batch` (`:755`, cotización IA en lote: extracción de params → `runBatchCalc` → 4 LLM → escribir col J, PDF/sync CRM opcional). Más `POST /api/crm/suggest-response` para IA de fila única, contador de cotizaciones en `server/routes/quotes.js`, export org en `server/routes/quoteExport.js`.

**Modelo de datos:** fila Admin 2.0 (`rowNum,id,fecha,telefono,cliente,canal,zona,consulta,respuesta,link,estado,outcome,replaySnapshotUrl,source:"admin"`). Las filas ML de CRM mapeadas vía `mapCrmMlItemToRow` reciben `source:"crm-ml"` y **sin `rowNum`** → las acciones destructivas (Editar/Enviado/Aprobar) quedan deshabilitadas; el dedup prefiere la fila Admin ante colisión de `id`. Routing de operadores `src/utils/cotizacionAssignment.js` (`OPERATOR_CODES = [MA,RA,TIN,SA]`, `suggestOwner`). Helpers de edad/salud + `computeStats` en el hook.

**Funcionalidad:** filtrar por scope/status/search, table↔kanban↔card, editar y guardar respuesta, ✦ Sugerir IA (60s), aprobar, marcar enviado (único + serie bulk), asignar responsable (sincroniza CRM ASIGNADO_A), batch IA (force/syncToCrm/createCrmRows/syncQuoteLink), sync a CRM, crear fila manual, export CSV, paleta ⌘K, tutorial guiado.

**Estado/errores:** sin polling de fondo — `load()` al cambiar token/scope + tras acciones; 401→refresh, 503→banner de error + se mantiene usable, toast auto-clear 3.5s.

---

## Verificación (cómo confirmar este estudio end-to-end)

1. **Estático (ya hecho):** componentes de entrada en `src/App.jsx:45-61,193-303`; los archivos de ruta existen; rutas backend confirmadas con `grep -nE "router\.(get|post|patch)" server/routes/{wolfboard,wa,omni}.js` y `app.(get|post) .../ml|/auth/ml` en `server/index.js`.
2. **Walk-through de UI en vivo (opcional):** `doppler run -- npm run dev:full` (API :3001 + Vite :5173), loguearse con grant admin/canales+wa, visitar cada ruta `/hub/*`. O usar Playwright/Chrome MCP contra `https://calculadora-bmc.vercel.app/hub/{canales,wa,ml-manager,ml,cotizaciones}`.
3. **Contratos backend:** con la API corriendo, `npm run test:contracts` valida las shapes de rutas vivas; `npm run smoke:prod` chequea la API pública de Cloud Run.

---

## Patrones transversales (insights)

1. **Dos generaciones de storage conviven.** Los módulos viejos (`/hub/ml`, cola de `/hub/canales`, `/hub/cotizaciones`) son **respaldados por Google Sheets** (`CRM_Operativo`, `Admin 2.0`) con el contrato estricto `503/200-vacío/nunca-500`; las superficies nuevas (`/hub/wa`, Omni inbox) son **respaldadas por Postgres** (`wa_*`). La plataforma está a mitad de migración de Sheets-como-DB hacia Postgres — por eso `/hub/cotizaciones` *fusiona* ambas fuentes y marca las filas solo-CRM como read-only.
2. **Tres filosofías de estado de frontend lado a lado.** `/hub/ml-manager` usa **@tanstack/react-query** (stale-while-revalidate + invalidación de keys). `/hub/wa` usa **fetch manual con debounce** (250ms) + puente `postMessage` con extensión. `/hub/ml` usa **`setInterval` crudo + refs** para esquivar stale closures durante el polling autónomo. Ninguno usa SSE/WebSockets — incluso el "tiempo real" de WA es ingest por webhook (`POST /api/wa/ingest`) desde una extensión de navegador.
3. **El "gate de aprobación" es el patrón de negocio recurrente.** ML Operativo y Cotizaciones implementan *IA-genera → humano-aprueba → sistema-envía*, codificado como columnas de gate en Sheets (AI=`Aprobado Enviar`, AJ=`Enviado El`, AK=`Bloquear Auto`). El switch tapado `100% AUTÓNOMO` de `/hub/ml` es el override deliberado que colapsa ese gate — por eso es un toggle protegido con kill-switch `CORTAR TODO`. Las cotizaciones de WA reusan el mismo motor de cálculo vía loopback HTTP (`POST /api/wa/quotes/run` → `/calc/*`).
