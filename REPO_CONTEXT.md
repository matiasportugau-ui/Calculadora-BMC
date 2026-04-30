# REPO_CONTEXT.md — Calculadora BMC

> Generado el 2026-04-06. Snapshot del repositorio para onboarding de agentes y contexto rápido.

---

## 1. Estructura de carpetas

```
.
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-calc-api.yml
│       ├── deploy-frontend.yml
│       ├── knowledge-antenna-reusable.yml
│       └── knowledge-antenna-scheduled.yml
├── api/                            # Vercel serverless stubs (legacy)
│   ├── cotizar.js
│   └── vitals.js
├── app/                            # Stub Next.js App Router (no activo)
│   └── api/chat/route.ts
├── docs/
│   ├── AGENTS.md
│   ├── API-REFERENCE.md
│   ├── ARCHITECTURE.md
│   ├── ATLAS-BROWSER-PROMPT-GO-LIVE.md
│   ├── bmc-dashboard-modernization/
│   │   ├── Code.gs / CalendarioRecordatorio.gs
│   │   ├── CRM_OPERATIVO_MAPPING.md
│   │   ├── DASHBOARD-FRONT-VISION.md / DASHBOARD-INTERFACE-MAP.md
│   │   ├── context-briefs/ (01–06 universos)
│   │   └── dashboard/ (index.html, app.js, styles.css)
│   ├── CALC-TECHO.md / CALC-PARED.md
│   ├── CHANGELOG.md
│   ├── DEPLOYMENT.md
│   ├── ML-OAUTH-SETUP.md
│   ├── PRICING-ENGINE.md
│   ├── SCENARIOS.md
│   └── UI-COMPONENTS.md
├── scripts/                        # ~60+ scripts npm (ver §7)
├── server/
│   ├── index.js                    # Entry point Express API (puerto 3001)
│   ├── config.js
│   ├── tokenStore.js
│   ├── mercadoLibreClient.js
│   ├── ml-crm-sync.js
│   ├── shopifyStore.js
│   ├── agentCapabilitiesManifest.js
│   ├── Dockerfile                  # Cloud Run API image
│   └── routes/
│       ├── calc.js                 # /calc/*
│       ├── agentChat.js            # /api/agent/chat
│       ├── agentTraining.js        # /api/agent/train*
│       ├── bmcDashboard.js         # /api/* (finanzas, CRM, ML, Shopify)
│       ├── followups.js            # /api/followups
│       ├── legacyQuote.js          # /find_products, /calculate_quote, etc.
│       ├── shopify.js              # /auth/shopify, /webhooks/shopify, /admin/*
│       └── transportista.js        # /api/driver/*, /api/trips/*
├── src/
│   ├── main.jsx                    # Entry point React
│   ├── App.jsx                     # Router raíz
│   ├── PanelinCalculadoraV3.jsx    # (alias; el activo es _backup)
│   ├── components/
│   │   ├── PanelinCalculadoraV3.jsx   # Componente principal activo
│   │   ├── PanelinChatPanel.jsx              # Chat IA Panelin
│   │   ├── PanelinDevPanel.jsx               # Developer Training Mode (Ctrl+Shift+D)
│   │   ├── BmcLogisticaApp.jsx               # Módulo logística
│   │   ├── DriverTransportistaApp.jsx        # App conductor
│   │   ├── BmcModuleNav.jsx                  # Navbar módulos
│   │   ├── BmcWolfboardHub.jsx               # Hub /hub
│   │   ├── RoofPreview.jsx                   # Vista previa techo 3D
│   │   ├── RoofPanelRealisticScene.jsx       # Escena 3D React Three Fiber
│   │   ├── QuoteVisualVisor.jsx              # Visor visual cotización
│   │   ├── GoogleDrivePanel.jsx              # Integración Drive
│   │   ├── FloorPlanEditor.jsx               # Editor planta
│   │   ├── roofPlan/
│   │   │   └── RoofPlanDimensions.jsx        # Plano 2D cotas
│   │   └── logistica/
│   │       └── LogisticaCargoScene3d.jsx
│   ├── data/
│   │   ├── constants.js            # Tokens, precios, paneles, escenarios (fuente de verdad)
│   │   ├── pricing.js
│   │   ├── calculatorDataVersion.js
│   │   ├── matrizPreciosMapping.js
│   │   └── quoteVisor*.js/json
│   ├── hooks/
│   │   ├── useChat.js
│   │   └── useRoofPreviewPlanLayout.js
│   ├── styles/
│   │   └── bmc-mobile.css
│   └── utils/
│       ├── calculations.js         # Motores de cálculo puros
│       ├── helpers.js              # BOM, PDF, WhatsApp
│       ├── calc/
│       │   ├── calcLibre.js
│       │   ├── calcTotales.js
│       │   └── skuResolver.js
│       ├── roofPlan*.js            # Geometría, temas, tipografía plano 2D
│       └── (30+ utils adicionales)
├── tests/
│   ├── validation.js
│   ├── roofVisualQuoteConsistency.js
│   └── chat-hardening.js
├── Dockerfile                      # Frontend nginx (para Cloud Run panelin-calc-web)
├── nginx.conf
├── index.html
├── vite.config.js
├── vercel.json
├── package.json
├── .env.example
└── README.md
```

---

## 2. Dependencias (package.json)

### dependencies

```json
{
  "@anthropic-ai/sdk": "^0.80.0",
  "@google-cloud/storage": "^5.18.3",
  "@google/generative-ai": "^0.24.1",
  "@react-three/drei": "^9.114.3",
  "@react-three/fiber": "^8.17.10",
  "cors": "^2.8.6",
  "dotenv": "^17.2.3",
  "express": "^5.1.0",
  "express-rate-limit": "^7.5.1",
  "googleapis": "^144.0.0",
  "html2pdf.js": "^0.14.0",
  "lucide-react": "^0.263.1",
  "openai": "^6.32.0",
  "pg": "^8.13.1",
  "pino": "^10.1.0",
  "pino-http": "^11.0.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-resizable-panels": "^2.1.9",
  "react-router-dom": "^6.30.3",
  "three": "^0.169.0",
  "web-vitals": "^5.2.0"
}
```

### devDependencies

```json
{
  "@eslint/js": "^9.39.3",
  "@modelcontextprotocol/sdk": "^1.27.1",
  "@vitejs/plugin-react": "^4.0.0",
  "concurrently": "^9.1.0",
  "easymidi": "^2.1.1",
  "eslint": "^9.39.3",
  "eslint-plugin-react": "^7.37.5",
  "eslint-plugin-react-hooks": "^7.0.1",
  "eslint-plugin-react-refresh": "^0.5.2",
  "globals": "^17.4.0",
  "playwright": "^1.58.2",
  "vite": "^7.0.0",
  "vite-plugin-pwa": "^1.2.0"
}
```

---

## 3. Puntos de entrada

### `index.html`

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#1a1a2e" />
    <title>Calculadora BMC</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### `src/main.jsx`

Entry point React. Carga `App.jsx` de forma dinámica (lazy import), envuelto en `ErrorBoundary`.

### `src/App.jsx` — Router raíz

```jsx
<BrowserRouter basename={getRouterBasename()}>
  <Routes>
    <Route path="/hub"          element={<BmcWolfboardHub />} />
    <Route path="/"             element={<Shell><PanelinCalculadora /></Shell>} />
    <Route path="/calculadora"  element={<Shell><PanelinCalculadora /></Shell>} />
    <Route path="/logistica"    element={<Shell><BmcLogisticaApp /></Shell>} />
    <Route path="/conductor"    element={<Shell><DriverTransportistaApp /></Shell>} />
    <Route path="*"             element={<Navigate to="/" replace />} />
  </Routes>
</BrowserRouter>
```

`PanelinCalculadora` resuelve a `src/components/PanelinCalculadoraV3.jsx` (lazy).

### `server/index.js` — Entry point Express API (puerto 3001)

Inicia el servidor Express con todos los routers montados. Ver §4 para endpoints completos.

### `app/api/chat/route.ts` — Stub Next.js (no activo en producción)

Route handler placeholder para un futuro deploy en Vercel/Next.js. Responde con frases keyword-based sin LLM.

---

## 4. Rutas y endpoints — Backend Express

### Montaje de routers

| Router | Prefijo |
|--------|---------|
| `calcRouter` | `/calc` |
| `agentChatRouter` | `/api` |
| `agentTrainingRouter` | `/api` |
| `followupsRouter` | `/api` |
| `transportistaRouter` | `/api` |
| `bmcDashboardRouter` | `/api` |
| `shopifyRouter` | `/` |
| `legacyQuoteRouter` | `/` |

### Endpoints directos en `server/index.js`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/capabilities` | Manifiesto de capacidades para agentes IA |
| GET | `/health` | Estado de la API, tokens ML, Sheets |
| GET | `/auth/ml/start` | Inicia OAuth MercadoLibre |
| GET | `/auth/ml/callback` | Callback OAuth ML |
| GET | `/auth/ml/status` | Estado del token ML almacenado |
| GET | `/ml/users/me` | Usuario autenticado en ML |
| GET | `/ml/users/:id` | Usuario ML por ID |
| GET | `/ml/listings` | Listados del vendedor |
| GET | `/ml/items/:id` | Detalle de ítem ML |
| PATCH | `/ml/items/:id` | Actualizar ítem ML |
| POST | `/ml/items/:id/description` | Crear/actualizar descripción ítem |
| GET | `/ml/questions` | Preguntas ML (con filtros) |
| GET | `/ml/questions/:id` | Pregunta ML por ID |
| POST | `/ml/questions/:id/answer` | Responder pregunta ML |
| GET | `/ml/orders` | Órdenes ML |
| GET | `/ml/orders/:id` | Orden ML por ID |
| POST | `/webhooks/ml` | Webhook MercadoLibre (topics/questions → CRM sync) |
| GET | `/webhooks/ml/events` | Log de eventos webhook ML |
| GET | `/webhooks/whatsapp` | Verificación Meta (hub.challenge) |
| POST | `/webhooks/whatsapp` | Mensajes entrantes WA (→ CRM auto-trigger 5min) |
| GET | `/finanzas` | Dashboard Finanzas (static HTML) |
| GET | `/calculadora/*` | SPA Vite (desde `/dist`) |

### `server/routes/calc.js` — `/calc`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/calc/openapi` | OpenAPI spec |
| GET | `/calc/gpt-entry-point` | Entry para GPT Actions |
| POST | `/calc/interaction-log` | Log de interacciones |
| POST | `/calc/cotizar/presupuesto-libre` | Cotización libre (sin escenario) |
| POST | `/calc/cotizar` | Cotización estándar |
| POST | `/calc/cotizar/pdf` | Generar PDF de cotización |
| GET | `/calc/pdf/:id` | Obtener PDF por ID |
| GET | `/calc/cotizaciones` | Listado de cotizaciones |
| GET | `/calc/catalogo` | Catálogo de paneles |
| GET | `/calc/escenarios` | Escenarios disponibles |
| GET | `/calc/informe` | Informe de cotizaciones |

### `server/routes/bmcDashboard.js` — `/api`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/cotizaciones` | Cotizaciones desde Sheets |
| GET | `/api/proximas-entregas` | Próximas entregas |
| GET | `/api/coordinacion-logistica` | Coordinación logística |
| GET | `/api/audit` | Audit log |
| GET | `/api/pagos-pendientes` | Pagos pendientes |
| GET | `/api/metas-ventas` | Metas de ventas |
| GET | `/api/calendario-vencimientos` | Calendario de vencimientos |
| GET | `/api/ventas` | Ventas (multi-tab) |
| GET | `/api/ventas/tabs` | Tabs disponibles en ventas |
| GET | `/api/stock-ecommerce` | Stock e-commerce |
| GET | `/api/stock-kpi` | KPIs de stock |
| GET | `/api/kpi-financiero` | KPIs financieros |
| GET | `/api/stock/history` | Historial de stock |
| GET | `/api/kpi-report` | Reporte KPI completo |
| POST | `/api/cotizaciones` | Crear cotización en Sheets |
| PATCH | `/api/cotizaciones/:id` | Actualizar cotización |
| POST | `/api/pagos` | Registrar pago |
| PATCH | `/api/pagos/:id` | Actualizar pago |
| POST | `/api/ventas` | Registrar venta |
| PATCH | `/api/stock/:codigo` | Actualizar stock |
| POST | `/api/marcar-entregado` | Marcar entrega |
| GET | `/api/actualizar-precios-calculadora` | Sync precios desde Matriz |
| POST | `/api/crm/suggest-response` | Sugerir respuesta IA (Claude/OpenAI/Gemini/Grok) |
| POST | `/api/crm/parse-email` | Parsear email entrante → CRM |
| POST | `/api/crm/ingest-email` | Ingestar email al CRM |
| POST | `/api/crm/parse-conversation` | Parsear conversación WA → CRM |
| POST | `/api/ventas/logistica-fecha-entrega` | Actualizar fecha entrega (auth) |
| POST | `/api/matriz/push-pricing-overrides` | Push overrides de precios a Matriz (auth) |
| GET | `/api/email/panelsim-summary` | Resumen email Panelsim (auth) |
| POST | `/api/email/draft-outbound` | Borrador email saliente (auth) |
| GET | `/api/crm/cockpit/row/:rowNum` | Fila CRM (auth) |
| POST | `/api/crm/cockpit/quote-link` | Link de cotización (auth) |
| POST | `/api/crm/cockpit/approval` | Aprobación (auth) |
| POST | `/api/crm/cockpit/mark-sent` | Marcar enviado (auth) |
| POST | `/api/crm/cockpit/send-approved` | Enviar aprobado (auth) |

### `server/routes/agentChat.js` — `/api`

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/agent/chat` | Chat SSE con Panelin (streaming) |

### `server/routes/agentTraining.js` — `/api` (requiere dev mode auth)

| Método | Ruta |
|--------|------|
| POST | `/api/agent/train` |
| PUT | `/api/agent/train/:id` |
| DELETE | `/api/agent/train/:id` |
| GET | `/api/agent/training-kb` |
| GET | `/api/agent/training-kb/match` |
| GET | `/api/agent/dev-config` |
| POST | `/api/agent/dev-config` |
| POST | `/api/agent/prompt-preview` |
| POST | `/api/agent/training/log-event` |

### `server/routes/followups.js` — `/api`

| Método | Ruta |
|--------|------|
| GET | `/api/followups` |
| POST | `/api/followups` |
| GET | `/api/followups/:id` |
| PATCH | `/api/followups/:id` |
| POST | `/api/followups/:id/done` |
| POST | `/api/followups/:id/snooze` |
| DELETE | `/api/followups/:id` |

### `server/routes/shopify.js`

| Método | Ruta |
|--------|------|
| GET | `/auth/shopify` |
| GET | `/auth/shopify/callback` |
| POST | `/webhooks/shopify` |
| GET | `/api/shopify/products` |
| GET | `/api/shopify/catalog/full` |
| GET | `/admin/questions` |
| POST | `/admin/answer` |
| POST | `/admin/auto-config` |
| GET | `/admin/auto-config` |

### `server/routes/legacyQuote.js` (GPT Actions / API Key)

| Método | Ruta |
|--------|------|
| GET | `/ready` |
| POST | `/find_products` |
| POST | `/resolve_product` |
| POST | `/product_price` |
| POST | `/check_availability` |
| POST | `/calculate_quote` |
| POST | `/calculate_quote_v2` |

### `server/routes/transportista.js` — `/api` (Modo Transportista)

Rutas para viajes, conductores, evidencias y outbox WhatsApp. Endpoints principales:

| Patrón | Descripción |
|--------|-------------|
| GET `/api/driver/session` | Sesión activa del conductor |
| POST `/api/driver/session` | Iniciar sesión |
| POST `/api/driver/session/close` | Cerrar sesión |
| POST `/api/driver/evidence/*` | Subir evidencias (upload-b64 y signed URL) |
| POST `/api/trips` | Crear viaje |
| GET `/api/trips` | Listar viajes |
| GET `/api/trips/:id` | Detalle viaje |
| POST `/api/trips/:id/events` | Agregar evento al viaje |
| POST `/api/trips/:id/pod` | Proof of delivery |
| GET `/api/transportista/outbox` | Cola WhatsApp pendiente |
| POST `/api/transportista/outbox/flush` | Enviar cola |

### Rutas del frontend — React Router

| Ruta | Componente |
|------|------------|
| `/` | `PanelinCalculadoraV3` |
| `/calculadora` | `PanelinCalculadoraV3` |
| `/logistica` | `BmcLogisticaApp` |
| `/conductor` | `DriverTransportistaApp` |
| `/hub` | `BmcWolfboardHub` |
| `*` | redirect → `/` |

---

## 5. Modelos de datos principales

### TypeScript — `app/api/chat/route.ts`

```typescript
type ChatRequestBody = {
  message?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

type ChatResponseBody = {
  reply: string;
  error?: string;
};
```

### Estructura BOM (JavaScript — `src/utils/helpers.js`)

```js
// Grupo de BOM
{
  group: string,       // "Paneles", "Fijaciones", "Selladores", etc.
  items: [
    {
      code: string,
      desc: string,
      qty: number,
      unit: string,
      price: number,   // sin IVA
      total: number,
    }
  ]
}
```

### CRM_Operativo — fila (Google Sheets, cols B–K + R–T + V–W + AF–AK)

```
B: fecha | C: cliente | D: teléfono | E: ubicación | F: canal
G: resumen_pedido | H: categoría | I: estado | J: estado_entrega | K: vendedor
R: probabilidad_cierre | S: urgencia | T: validar_stock
V: tipo_cliente | W: observaciones
AF: respuesta_ia | AG: provider_ia
AH–AK: campos_cola_default
```

### Conversación WhatsApp (in-memory)

```js
// waConversations: Map<chatId, Conversation>
{
  messages: [{ from: string, text: string, ts: string }],
  contactName: string,
  lastUpdate: number   // Date.now()
}
```

---

## 6. Variables de entorno

Referencia completa en `.env.example`:

### Google Sheets / Credenciales

| Variable | Descripción |
|----------|-------------|
| `BMC_SHEET_ID` | ID principal del spreadsheet (Administrador de Cotizaciones) |
| `BMC_PAGOS_SHEET_ID` | Pagos Pendientes 2026 |
| `BMC_CALENDARIO_SHEET_ID` | Calendario de vencimientos |
| `BMC_VENTAS_SHEET_ID` | 2.0 - Ventas |
| `BMC_STOCK_SHEET_ID` | Stock E-Commerce |
| `BMC_MATRIZ_SHEET_ID` | Matriz de Costos y Ventas 2026 |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path al JSON del service account |
| `BMC_SHEETS_TAB_NAMES_TTL_MS` | TTL caché nombres de pestañas (default 120000ms) |
| `BMC_SHEETS_VENTAS_MERGE_TTL_MS` | TTL caché merge ventas (default 90000ms) |

### MercadoLibre OAuth

| Variable | Descripción |
|----------|-------------|
| `ML_CLIENT_ID` | Client ID app ML (742811153438318) |
| `ML_CLIENT_SECRET` | Client secret |
| `ML_REDIRECT_URI_DEV` | Callback local (default: http://localhost:3001/auth/ml/callback) |
| `ML_USE_PROD_REDIRECT` | Si `true`, usa `PUBLIC_BASE_URL` |
| `ML_SITE_ID` | Sitio ML (default: MLU — Uruguay) |
| `TOKEN_ENCRYPTION_KEY` | 64 hex chars para encriptar `.ml-tokens.enc` |
| `ML_TOKEN_STORAGE` | `file` (local) o `gcs` (Cloud Run) |
| `ML_TOKEN_GCS_BUCKET` | Bucket GCS para tokens (prod) |

### WhatsApp Business Cloud API

| Variable | Descripción |
|----------|-------------|
| `WHATSAPP_VERIFY_TOKEN` | Token de verificación Meta webhook |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso WA |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono |
| `WHATSAPP_APP_SECRET` | Secret HMAC para verificar firma (opcional) |

### Shopify

| Variable | Descripción |
|----------|-------------|
| `SHOPIFY_CLIENT_ID` | Client ID app Shopify |
| `SHOPIFY_CLIENT_SECRET` | Client secret |
| `SHOPIFY_WEBHOOK_SECRET` | Secret para HMAC webhooks |
| `SHOPIFY_SCOPES` | Permisos OAuth |
| `SHOPIFY_QUESTIONS_SHEET_TAB` | Nombre de la pestaña (default: Shopify_Preguntas) |

### AI Providers

| Variable | Descripción |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude (Anthropic) |
| `OPENAI_API_KEY` | OpenAI |
| `GEMINI_API_KEY` | Google Gemini |
| `GROK_API_KEY` | Grok (xAI) |

### Transportista (Postgres)

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | `postgres://user:pass@host:5432/db` |
| `TRANSPORTISTA_GCS_BUCKET` | GCS bucket para evidencias firmadas |
| `TRANSPORTISTA_DRIVER_TOKEN_TTL_HOURS` | TTL tokens conductor (default 24h) |
| `TRANSPORTISTA_OUTBOX_INTERVAL_MS` | Intervalo outbox WA (default 15000ms) |

### Frontend Vite (build-time)

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL base de la API (Cloud Run en prod) |
| `VITE_BASE` | Base path (default `/`) |
| `VITE_SAME_ORIGIN_API` | `1` si SPA y API corren en el mismo origen |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |

### Otros

| Variable | Descripción |
|----------|-------------|
| `PUBLIC_BASE_URL` | URL pública del servicio Cloud Run |
| `API_AUTH_TOKEN` | Token para rutas CRM cockpit |
| `WEBHOOK_VERIFY_TOKEN` | Token para webhooks ML |
| `BMC_EMAIL_INBOX_REPO` | Path al repo hermano de email inbox |

---

## 7. Scripts disponibles (package.json)

| Script | Descripción |
|--------|-------------|
| `dev` | Vite dev server → puerto 5173 |
| `dev:api` | Express API con --watch → puerto 3001 |
| `dev:full` | API + Vite en paralelo (concurrently) |
| `dev:full:watch` | API (--watch) + Vite en paralelo |
| `start:api` | Solo API Express (producción) |
| `build` | Vite build → `dist/` |
| `preview` | Preview del build |
| `test` | validation.js + roofVisualQuoteConsistency.js |
| `test:chat` | chat-hardening.js |
| `test:contracts` | validate-api-contracts.js |
| `lint` | ESLint sobre `src/` |
| `gate:local` | lint + test |
| `gate:local:full` | lint + test + build |
| `pre-deploy` | ./scripts/pre-deploy-check.sh |
| `go-live` | ./scripts/go-live-automation.sh |
| `smoke:prod` | smoke-prod-api.mjs (contra Cloud Run) |
| `local:view` | bash scripts/local-view-autolaunch.sh |
| `bmc-dashboard` | Dashboard Finanzas standalone (puerto 3849) |
| `ml:verify` | Verificar estado OAuth ML |
| `verify-tabs` | Verificar tabs de Sheets |
| `setup-sheets-tabs` | Configurar tabs |
| `map-all-sheets` | Auditoría de todos los sheets |
| `panelin:train:import` | Importar entradas de entrenamiento |
| `knowledge:run` | Pipeline completo de knowledge antenna |
| `knowledge:scan` | Escanear fuentes de conocimiento |
| `knowledge:rank` | Rankear entradas |
| `knowledge:magazine` | Generar magazine de conocimiento |
| `channels:automated` | Pipeline de canales automatizado |
| `email:ingest-snapshot` | Ingestar snapshot de emails |
| `matriz:reconcile` | Reconciliar CSV de matriz |
| `matriz:pull-csv` | Pull CSV desde Sheets |
| `transportista:migrate` | Correr migraciones Postgres |
| `visor:shopify-sync` | Sincronizar mapa Shopify para visor |
| `panel:rendering:sync` | Descargar assets de rendering de paneles |
| `development:chain` | Runner de cadena de desarrollo |
| `session:archive:run` | Archivar artefactos de sesión |
| `mcp:panelin` | Servidor MCP Panelin HTTP |
| `capabilities:snapshot` | Snapshot de capacidades del agente |
| `project:compass` | Estado del proyecto (alias: schedule) |

---

## 8. CI/CD — `.github/workflows/`

### `ci.yml` — CI principal

**Triggers:** push a `main`/`develop`, PR a `main`.

| Job | Descripción |
|-----|-------------|
| `validate` | npm ci → node tests/validation.js → npm run build |
| `lint` | npm ci → npm run lint |
| `channels_pipeline` | npm ci → channels-automated-pipeline.mjs (prod smoke) |
| `knowledge_antenna` | Reutiliza `knowledge-antenna-reusable.yml` |

### `deploy-calc-api.yml` — Deploy API a Cloud Run

**Triggers:** push a `main` en paths `server/**`, `src/utils/**`, `src/data/**`.
- GCP Project: `chatbot-bmc-live` | Region: `us-central1`
- Service: `panelin-calc`
- Auth: Workload Identity Federation (OIDC)
- Image: Artifact Registry → Cloud Run (0–10 instancias, 256Mi, 30s timeout)

### `deploy-frontend.yml` — Deploy Frontend a Cloud Run

**Triggers:** push a `main` en paths `src/**`, `index.html`, `vite.config.js`, `Dockerfile`.
- Service: `panelin-calc-web`
- Image: Nginx alpine sirviendo `/dist`
- Cloud Run (0–4 instancias, 128Mi, puerto 8080)

### `knowledge-antenna-scheduled.yml`

Workflow programado para ejecutar la knowledge antenna de forma autónoma.

---

## 9. Archivos de configuración

### `vite.config.js`

```js
// Framework: Vite + React + VitePWA
// Puerto dev: 5173 (host: 0.0.0.0)
// Proxy: /calc y /api → http://localhost:3001
// Build chunks: vendor-three, vendor-pdf, vendor-react
// PWA: autoUpdate, SW caching para /api (NetworkFirst) y CDN Shopify (CacheFirst)
// Base: process.env.VITE_BASE ?? "/"
```

### `vercel.json`

```json
{
  "installCommand": "npm install --ignore-scripts",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/logistica", "destination": "/index.html" },
    { "source": "/(.*)",      "destination": "/index.html" }
  ]
}
```

### `Dockerfile` (frontend — nginx)

```dockerfile
# Multi-stage: deps (node:20-alpine) → build (Vite) → runtime (nginx:1.27-alpine)
# Build args: VITE_GOOGLE_CLIENT_ID, VITE_API_URL
# Serve: /usr/share/nginx/html, puerto 8080
```

### `server/Dockerfile` (API — Cloud Run)

```dockerfile
# node:20-alpine
# WORKDIR /app, npm ci, node server/index.js
```

### `.vercel/project.json`

Proyecto vinculado a Vercel (calculadora-bmc.vercel.app).

---

## 10. README.md

# Calculadora BMC — Panelin v3.0

Cotizador profesional de paneles de aislamiento térmico y acústico para **BMC Uruguay (METALOG SAS)**.

## ¿Qué hace?

- Lista de materiales (BOM) desglosada por grupo
- Subtotal + IVA 22% = total final
- PDF A4 listo para imprimir
- Texto preformateado para WhatsApp

## Inicio rápido

```bash
git clone https://github.com/matiasportugau-ui/Calculadora-BMC.git
cd Calculadora-BMC
npm install
npm run dev        # http://localhost:5173
```

## Escenarios soportados

| Escenario | Techo | Fachada | Esquineros |
|-----------|:-----:|:-------:|:----------:|
| Solo Techo | ✅ | — | — |
| Solo Fachada | — | ✅ | ✅ |
| Techo + Fachada | ✅ | ✅ | ✅ |
| Cámara Frigorífica | — | ✅ | ✅ |

## Catálogo de paneles

### Techo

| Familia | Ancho útil | Espesores (mm) |
|---------|-----------|----------------|
| ISODEC EPS | 1.12 m | 100, 150, 200, 250 |
| ISODEC PIR | 1.12 m | 50, 80, 120 |
| ISOROOF 3G | 1.00 m | 30, 40, 50, 80, 100 |
| ISOROOF FOIL | 1.00 m | 30, 50 |
| ISOROOF PLUS | 1.00 m | 50, 80 |

### Fachada / Pared

| Familia | Ancho útil | Espesores (mm) |
|---------|-----------|----------------|
| ISOPANEL EPS | 1.14 m | 50, 100, 150, 200, 250 |
| ISOWALL PIR | 1.10 m | 50, 80, 100 |

## Arquitectura

```
src/
├── main.jsx                    # Entry React
├── App.jsx                     # Router raíz
├── data/constants.js           # Tokens, precios, paneles, escenarios (fuente de verdad)
├── utils/
│   ├── calculations.js         # Motores de cálculo puros
│   └── helpers.js              # BOM, PDF, WhatsApp
└── components/
    └── PanelinCalculadoraV3.jsx
```

## Stack del dashboard

| Componente | Puerto | Descripción |
|------------|--------|-------------|
| API principal | 3001 | Express: `/calc`, `/api/*`, `/auth/ml`, `/finanzas` |
| Vite (front) | 5173 | React SPA |
| Dashboard standalone | 3849 | `npm run bmc-dashboard` |

## Deploy

- **Vercel (frontend):** `npx vercel --prod` → calculadora-bmc.vercel.app
- **Cloud Run (API):** via GitHub Actions `deploy-calc-api.yml`
- **Docker frontend:** `docker build -t calculadora-bmc . && docker run -p 8080:80`

## Reglas de desarrollo

| Regla | Detalle |
|-------|---------|
| Cantidades | `Math.ceil()` siempre |
| Precios | `p(item)` — nunca hardcodeados |
| IVA | Una sola vez al final con `calcTotalesSinIVA()` |
| Estilos | Inline styles + tokens `C` y `FONT` de `constants.js` |

## Empresa

| Campo | Valor |
|-------|-------|
| Razón social | METALOG SAS |
| Marca | BMC Uruguay |
| RUT | 120403430012 |
| Ubicación | Maldonado, Uruguay |
| Licencia | Propietaria — todos los derechos reservados |
