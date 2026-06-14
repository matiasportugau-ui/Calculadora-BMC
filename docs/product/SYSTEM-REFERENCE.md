# Calculadora BMC / Wolfboard — Referencia técnica del sistema

> **Documento auto-generado** por `scripts/generate-system-reference.mjs` a partir
> del código real del repo. **No editar a mano** — se regenera (ver workflow
> `product-docs`). Es la representación *fiel y cableada* de cómo está construido el
> sistema; el recorrido visual de la UI está en `PRODUCT-OVERVIEW.md`.

| | |
|---|---|
| **Generado** | 2026-06-14T04:10:01.891Z |
| **Versión** | `calculadora-bmc` v3.1.5 |
| **Commit** | `7053c13` (`claude/product-tour-doc-setup-jptsox`) |

## Arquitectura (resumen)

- **Frontend:** React 18 + Vite (SPA, `:5173` en dev). Entry `src/App.jsx` (router con
  27 rutas).
- **API:** Express 5 sobre Node (ES modules, `:3001`). Entry `server/index.js`; expone
  333 rutas en 41 módulos de `server/routes/`.
- **Datos:** PostgreSQL (`pg`) + pgvector; Google Sheets (service account); integraciones
  MercadoLibre, WhatsApp Cloud, GCS, OpenAI/Anthropic. Ver §Integraciones.
- **Deploy:** Frontend en Vercel; API en Google Cloud Run (`panelin-calc`).

## 1. Superficie de API (333 rutas en 41 módulos)

**`activity.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| GET | `/api/activity/status` |
| GET | `/api/activity/today` |
| GET | `/api/activity/buckets` |

**`agentChat.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| GET | `/api/agent/ai-options` |
| GET | `/api/agent/tool-stats` |
| GET | `/api/agent/tools-manifest` |
| POST | `/api/agent/exec-tool` |
| POST | `/api/agent/chat` |

**`agentConversations.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| GET | `/api/agent/stats` |
| GET | `/api/agent/conversations` |
| GET | `/api/agent/conversations/weekly-digest` |
| POST | `/api/agent/conversations/analyze-batch` |
| GET | `/api/agent/conversations/:id` |
| GET | `/api/agent/conversations/:id/analysis` |

**`agentFeedback.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| POST | `/api/agent/feedback` |
| GET | `/api/agent/feedback` |
| GET | `/api/agent/feedback/stats` |

**`agentTraining.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| POST | `/api/agent/train` |
| PUT | `/api/agent/train/:id` |
| DELETE | `/api/agent/train/bulk` |
| PATCH | `/api/agent/train/bulk` |
| DELETE | `/api/agent/train/:id` |
| GET | `/api/agent/training-kb` |
| GET | `/api/agent/training-kb/match` |
| GET | `/api/agent/dev-config` |
| POST | `/api/agent/dev-config` |
| POST | `/api/agent/prompt-preview` |
| POST | `/api/agent/training/log-event` |
| GET | `/api/agent/dev-config/:section/history` |
| POST | `/api/agent/dev-config/:section/revert` |
| POST | `/api/agent/knowledge/clear-cache` |
| GET | `/api/agent/training-kb/score-config` |
| POST | `/api/agent/training-kb/score-config` |
| POST | `/api/agent/autolearn` |
| GET | `/api/agent/autolearn/pending` |
| POST | `/api/agent/autolearn/:id/approve` |
| POST | `/api/agent/autolearn/:id/reject` |
| GET | `/api/agent/training-kb/health` |
| POST | `/api/agent/training-kb/:id/mark-reviewed` |
| POST | `/api/agent/training-kb/import` |
| GET | `/api/agent/training-kb/conflicts` |
| POST | `/api/agent/training-kb/:id/resolve-conflict` |
| POST | `/api/agent/training-kb/generate-ml-overrides` |
| GET | `/api/agent/training-kb/analytics` |

**`agentTranscribe.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| POST | `/api/agent/transcribe` |

**`agentVoice.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| POST | `/api/agent/voice/session` |
| POST | `/api/agent/voice/action` |
| GET | `/api/agent/voice/errors` |
| POST | `/api/agent/voice/errors/clear` |
| GET | `/api/agent/voice/health` |

**`aiAnalytics.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| GET | `/api/ai-analytics/trends` |

**`authGoogle.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| POST | `/api/auth/google` |
| POST | `/api/auth/refresh` |
| POST | `/api/auth/logout` |
| GET | `/api/auth/me` |
| GET | `/api/auth/me/grants` |

**`authMfa.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| POST | `/auth/mfa/enroll` |
| POST | `/auth/mfa/verify` |
| POST | `/auth/mfa/disable` |
| POST | `/auth/mfa/challenge` |

**`bmcDashboard.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| GET | `/api/cotizaciones` |
| GET | `/api/proximas-entregas` |
| GET | `/api/coordinacion-logistica` |
| GET | `/api/audit` |
| GET | `/api/pagos-pendientes` |
| GET | `/api/metas-ventas` |
| GET | `/api/calendario-vencimientos` |
| GET | `/api/ventas` |
| GET | `/api/ventas/tabs` |
| GET | `/api/stock-ecommerce` |
| GET | `/api/stock-kpi` |
| GET | `/api/productos-maestro` |
| GET | `/api/productos-maestro/reconcile` |
| GET | `/api/productos-maestro/links` |
| PUT | `/api/productos-maestro/links` |
| POST | `/api/productos-maestro/push` |
| GET | `/api/kpi-financiero` |
| GET | `/api/stock/history` |
| GET | `/api/kpi-report` |
| GET | `/api/fiscal/bps-irae` |
| POST | `/api/cotizaciones` |
| PATCH | `/api/cotizaciones/:id` |
| POST | `/api/pagos` |
| PATCH | `/api/pagos/:id` |
| POST | `/api/ventas` |
| PATCH | `/api/stock/:codigo` |
| POST | `/api/marcar-entregado` |
| GET | `/api/actualizar-precios-calculadora` |
| POST | `/api/crm/suggest-response` |
| POST | `/api/crm/parse-email` |
| POST | `/api/crm/ingest-email` |
| POST | `/api/crm/parse-conversation` |
| POST | `/api/ventas/logistica-fecha-entrega` |
| POST | `/api/matriz/push-pricing-overrides` |
| GET | `/api/email/panelsim-summary` |
| POST | `/api/email/draft-outbound` |
| GET | `/api/crm/cockpit/row/:rowNum` |
| POST | `/api/crm/cockpit/quote-link` |
| POST | `/api/crm/cockpit/approval` |
| POST | `/api/crm/cockpit/mark-sent` |
| POST | `/api/crm/cockpit/taxonomy-row` |
| POST | `/api/crm/cockpit/save-response` |
| POST | `/api/crm/cockpit/send-approved` |
| GET | `/api/crm/cockpit/ml-queue` |
| GET | `/api/crm/cockpit/wa-queue` |
| POST | `/api/crm/cockpit/sync-ml` |
| GET | `/api/crm/cockpit/unified-queue` |
| GET | `/api/consultations` |
| POST | `/api/consultations/:consultationId/reply` |
| POST | `/api/crm/cockpit/sync-all` |

**`bugs.js`** — montado en `/api/bugs`

| Método | Ruta |
|---|---|
| POST | `/api/bugs/report` |
| GET | `/api/bugs/` |

**`calc.js`** — montado en `/calc`

| Método | Ruta |
|---|---|
| GET | `/calc/openapi` |
| GET | `/calc/gpt-entry-point` |
| POST | `/calc/interaction-log` |
| GET | `/calc/interaction-log/list` |
| GET | `/calc/interaction-log/file/:name` |
| POST | `/calc/cotizar/presupuesto-libre` |
| POST | `/calc/cotizar` |
| POST | `/calc/cotizar/pdf` |
| GET | `/calc/pdf/:id` |
| GET | `/calc/cotizaciones` |
| GET | `/calc/cotizaciones/:id` |
| POST | `/calc/cotizaciones/:id/cancelar` |
| GET | `/calc/catalogo` |
| GET | `/calc/escenarios` |
| GET | `/calc/informe` |

**`clientes/customers.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| GET | `/api/clientes/customers` |
| GET | `/api/clientes/customers/summary` |

**`clientes/followups.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| POST | `/api/clientes/followups` |
| GET | `/api/clientes/followups` |

**`deepResearch.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| POST | `/api/research/deep` |
| GET | `/api/research/deep/:id` |
| POST | `/api/research/deep/:id/cancel` |

**`followups.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| GET | `/api/followups` |
| POST | `/api/followups` |
| GET | `/api/followups/:id` |
| PATCH | `/api/followups/:id` |
| POST | `/api/followups/:id/done` |
| POST | `/api/followups/:id/snooze` |
| DELETE | `/api/followups/:id` |

**`identityAdmin.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| GET | `/api/admin/users` |
| GET | `/api/admin/users/:id` |
| POST | `/api/admin/users/:id/role-grants` |
| DELETE | `/api/admin/users/:id/role-grants/:role` |
| PATCH | `/api/admin/users/:id/module-grants/:module` |
| POST | `/api/admin/users/:id/suspend` |
| POST | `/api/admin/users/:id/reactivate` |
| POST | `/api/admin/users/:id/revoke-sessions` |

**`identityAnalytics.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| GET | `/api/admin/analytics/active-users` |
| GET | `/api/admin/analytics/module-usage` |
| GET | `/api/admin/analytics/error-rate` |
| GET | `/api/admin/analytics/timeline` |
| GET | `/api/admin/analytics/top-actions` |

**`identityMe.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| GET | `/api/me/notifications` |
| PATCH | `/api/me/notifications/:id` |
| POST | `/api/access-requests` |
| GET | `/api/me/access-requests` |
| GET | `/api/admin/access-requests` |
| PATCH | `/api/admin/access-requests/:id` |
| POST | `/api/me/special-quote-requests` |
| GET | `/api/me/special-quote-requests` |
| GET | `/api/me/quotes` |
| GET | `/api/me/quotes/:id` |
| POST | `/api/me/quotes` |
| DELETE | `/api/me/quotes/:id` |
| POST | `/api/me/quotes/claim` |
| GET | `/api/admin/sheets/clientes/status` |
| POST | `/api/admin/sheets/clientes/reconcile` |
| POST | `/api/admin/sheets/clientes/sync/:quote_id` |
| POST | `/api/me/activity` |
| GET | `/api/me/activity` |
| GET | `/api/me/users/search` |
| GET | `/api/me/threads` |
| GET | `/api/me/threads/:id/messages` |
| POST | `/api/me/threads` |
| POST | `/api/me/threads/:id/messages` |
| PATCH | `/api/me/threads/:id/read` |

**`internal/presupOrchestrator.js`** — montado en `/api/internal/presup`

| Método | Ruta |
|---|---|
| POST | `/api/internal/presup/run` |
| GET | `/api/internal/presup/status` |
| GET | `/api/internal/presup/run/example` |

**`legacyQuote.js`** — montado en `/`

| Método | Ruta |
|---|---|
| GET | `/ready` |
| POST | `/find_products` |
| POST | `/resolve_product` |
| POST | `/product_price` |
| POST | `/check_availability` |
| POST | `/calculate_quote` |
| POST | `/calculate_quote_v2` |

**`marketing.js`** — montado en `/api/marketing`

| Método | Ruta |
|---|---|
| GET | `/api/marketing/dashboard/summary` |
| GET | `/api/marketing/dashboard/competitors` |
| GET | `/api/marketing/dashboard/alerts` |
| GET | `/api/marketing/mystery-shopping` |
| PATCH | `/api/marketing/mystery-shopping/:id/status` |
| POST | `/api/marketing/etl/run` |

**`mlEtlRun.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| POST | `/api/ml/etl-run` |
| GET | `/api/ml/etl-run/latest` |
| GET | `/api/ml/etl-run/:id` |

**`mlSearch.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| GET | `/api/ml/search` |

**`panelinInternal.js`** — montado en `/api/internal/panelin`

| Método | Ruta |
|---|---|
| GET | `/api/internal/panelin/whoami` |
| GET | `/api/internal/panelin/tools` |
| GET | `/api/internal/panelin/policies` |
| POST | `/api/internal/panelin/invoke` |

**`pdf.js`** — montado en `/api/pdf`

| Método | Ruta |
|---|---|
| POST | `/api/pdf/generate` |
| GET | `/api/pdf/metrics` |

**`planInterpret.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| POST | `/api/plan/interpret` |

**`quoteExport.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| POST | `/api/admin/export` |
| GET | `/api/me/quotes/:id/export.json` |
| GET | `/api/me/quotes/:id/export.csv` |
| GET | `/api/me/quotes/:id/export.pdf` |
| GET | `/api/me/quotes/:id/export.html` |

**`quotes.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| GET | `/api/quotes/counter` |
| POST | `/api/quotes/counter/next` |

**`shopify.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| GET | `/auth/shopify` |
| GET | `/auth/shopify/callback` |
| POST | `/webhooks/shopify` |
| GET | `/api/shopify/products` |
| GET | `/api/shopify/catalog/full` |
| GET | `/admin/questions` |
| POST | `/admin/answer` |
| POST | `/admin/auto-config` |
| GET | `/admin/auto-config` |

**`superAgent.js`** — montado en `/api/agent`

| Método | Ruta |
|---|---|
| POST | `/api/agent/quote-lead` |

**`tasks.js`** — montado en `/api/tasks`

| Método | Ruta |
|---|---|
| GET | `/api/tasks/lists` |
| GET | `/api/tasks/lists/:id` |
| GET | `/api/tasks/lists/:id/tasks` |
| GET | `/api/tasks/lists/:id/tasks/:taskId` |
| POST | `/api/tasks/lists` |
| DELETE | `/api/tasks/lists/:id` |
| POST | `/api/tasks/lists/:id/tasks` |
| PATCH | `/api/tasks/lists/:id/tasks/:taskId` |
| DELETE | `/api/tasks/lists/:id/tasks/:taskId` |

**`tasksOAuth.js`** — montado en `/auth/tasks`

| Método | Ruta |
|---|---|
| GET | `/auth/tasks/init` |
| GET | `/auth/tasks/callback` |
| GET | `/auth/tasks/scope-probe` |
| POST | `/auth/tasks/revoke` |

**`tasksSync.js`** — montado en `/sync`

| Método | Ruta |
|---|---|
| POST | `/sync/google-tasks/pull` |

**`teamAssist.js`** — montado en `/api/team-assist`

| Método | Ruta |
|---|---|
| GET | `/api/team-assist/health` |
| GET | `/api/team-assist/agents` |
| POST | `/api/team-assist/chat` |

**`traktime.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| GET | `/api/traktime/health` |
| GET | `/api/traktime/me` |
| GET | `/api/traktime/clients` |
| POST | `/api/traktime/clients` |
| PATCH | `/api/traktime/clients/:id` |
| GET | `/api/traktime/projects` |
| POST | `/api/traktime/projects` |
| PATCH | `/api/traktime/projects/:id` |
| GET | `/api/traktime/projects/:id/members` |
| POST | `/api/traktime/projects/:id/members` |
| DELETE | `/api/traktime/projects/:id/members/:userId` |
| GET | `/api/traktime/tasks` |
| POST | `/api/traktime/tasks` |
| GET | `/api/traktime/tags` |
| POST | `/api/traktime/tags` |
| GET | `/api/traktime/reports/billable` |
| GET | `/api/traktime/invoices` |
| POST | `/api/traktime/invoices/draft` |
| POST | `/api/traktime/invoices/:id/issue` |
| POST | `/api/traktime/invoices/:id/mark-paid` |
| POST | `/api/traktime/invoices/:id/void` |
| GET | `/api/traktime/invoices/:id/pdf` |
| POST | `/api/traktime/admin/mirror-now` |
| GET | `/api/traktime/timer/current` |
| POST | `/api/traktime/timer/start` |
| POST | `/api/traktime/timer/stop` |
| GET | `/api/traktime/entries` |
| POST | `/api/traktime/entries` |
| PATCH | `/api/traktime/entries/:id` |
| DELETE | `/api/traktime/entries/:id` |
| GET | `/api/traktime/reports/summary` |
| GET | `/api/traktime/day-report` |
| GET | `/api/traktime/month-report` |

**`transportista.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| GET | `/api/transportista/health` |
| POST | `/api/trips` |
| POST | `/api/trips/:trip_id/confirm` |
| POST | `/api/trips/:trip_id/assign` |
| POST | `/api/trips/:trip_id/driver-link/regenerate` |
| GET | `/api/trips/:trip_id/timeline` |
| GET | `/api/trips/:trip_id/state` |
| POST | `/api/trips/:trip_id/close` |
| GET | `/api/driver/trips` |
| GET | `/api/driver/trips/:trip_id` |
| POST | `/api/driver/events` |
| POST | `/api/driver/evidence/upload-url` |
| POST | `/api/driver/evidence/commit` |
| POST | `/api/driver/evidence/upload-b64` |

**`wa.js`** — montado en `/api`

| Método | Ruta |
|---|---|
| GET | `/api/wa/config` |
| PATCH | `/api/wa/settings` |
| PATCH | `/api/wa/flags/:key` |
| POST | `/api/wa/settings/test-ai` |
| GET | `/api/wa/operators` |
| POST | `/api/wa/operators/invite` |
| DELETE | `/api/wa/operators/:id/sessions` |
| GET | `/api/wa/rules` |
| POST | `/api/wa/rules/preview` |
| GET | `/api/wa/webhooks` |
| POST | `/api/wa/webhooks/:id/test` |
| GET | `/api/wa/audit-log` |
| POST | `/api/wa/auth/request-magic-link` |
| GET | `/api/wa/auth/verify` |
| POST | `/api/wa/auth/verify` |
| POST | `/api/wa/auth/refresh` |
| POST | `/api/wa/auth/logout` |
| GET | `/api/wa/config/extension` |
| GET | `/api/wa/health` |
| POST | `/api/wa/ingest` |
| GET | `/api/wa/conversations` |
| GET | `/api/wa/messages` |
| GET | `/api/wa/suggestions` |
| POST | `/api/wa/suggestions/:id/chosen` |
| GET | `/api/wa/quotes` |
| POST | `/api/wa/quotes/run` |
| POST | `/api/wa/conversations/:chat_id/upsert-lead` |
| GET | `/api/wa/followups` |
| POST | `/api/wa/followups` |
| PATCH | `/api/wa/followups/:id` |
| POST | `/api/wa/conversations/:chat_id/consent` |
| POST | `/api/wa/outbound` |
| POST | `/api/wa/outbound/:msg_id/confirm` |
| POST | `/api/wa/suggestions/run` |
| POST | `/api/wa/heartbeat` |
| GET | `/api/wa/operators` |
| GET | `/api/wa/metrics` |

**`webhooks.js`** — montado en `(raíz)`

| Método | Ruta |
|---|---|
| POST | `/ml` |
| GET | `/whatsapp` |
| POST | `/whatsapp` |

**`wolfboard.js`** — montado en `/api/wolfboard`

| Método | Ruta |
|---|---|
| GET | `/api/wolfboard/pendientes` |
| POST | `/api/wolfboard/sync` |
| POST | `/api/wolfboard/row` |
| POST | `/api/wolfboard/row-create` |
| POST | `/api/wolfboard/enviados` |
| GET | `/api/wolfboard/export` |
| POST | `/api/wolfboard/quote-batch` |

## 2. Rutas del frontend / SPA (27)
| Ruta | Componente / página |
|---|---|
| `*` | → redirect |
| `/` | `PanelinCalculadora` |
| `/calculadora` | `PanelinCalculadora` |
| `/conductor` | `DriverTransportistaApp` |
| `/especificaciones` | `SpecManagementSandbox` |
| `/fichas` | `FichasPreview` |
| `/hub` | `BmcWolfboardHub` |
| `/hub/admin` | `AdminRoute` |
| `/hub/admin/analytics` | `AnalyticsModule` |
| `/hub/admin/users` | `UserAdminModule` |
| `/hub/agent-admin` | `AgentAdminModule` |
| `/hub/bugs` | `BugReportsList` |
| `/hub/canales` | `BmcCanalesUnificadosModule` |
| `/hub/clientes` | `ClientesMVP` |
| `/hub/cotizaciones` | `CotizacionesRoute` |
| `/hub/marketing` | `MarketingHubModule` |
| `/hub/ml` | `BmcMlOperativoModule` |
| `/hub/plan-import` | `BmcPlanImportModule` |
| `/hub/tareas` | `TasksModule` |
| `/hub/traktime/*` | `TraKtiMeModule` |
| `/hub/wa` | `BmcWaModuleWithTabs` |
| `/inspector` | `CalcLogicInspector` |
| `/logistica` | `BmcLogisticaApp` |
| `/mi-espacio` | `MySpacePage` |
| `/presentacion-licitacion` | `BidPresentation` |
| `/preview/pdf` | `PdfPreview` |
| `/wa` | → redirect |

## 3. Integraciones y variables de entorno (67)

_Extraído de `.env.example` (sólo nombres; nunca valores)._
| Prefijo | Variables |
|---|---|
| `BMC_*` | `BMC_CALENDARIO_SHEET_ID` · `BMC_DASHBOARD_2_REPO` · `BMC_DEVELOPMENT_TEAM_REPO` · `BMC_EMAIL_INBOX_REPO` · `BMC_PAGOS_SHEET_ID` · `BMC_SHEET_ID` · `BMC_STOCK_SHEET_ID` · `BMC_VENTAS_SHEET_ID` |
| `ALERT_*` | `ALERT_CRITICAL_OFFLINE_RUNS` · `ALERT_CRITICAL_PCT` · `ALERT_EMAIL_FROM` · `ALERT_EMAIL_TO` · `ALERT_WARN_PCT` |
| `BUDGET_*` | `BUDGET_ENABLED` · `BUDGET_TOKENS_PER_24H` · `BUDGET_TURNS_PER_24H` · `BUDGET_TURNS_PER_5MIN` · `BUDGET_TURNS_PER_MIN` |
| `SHOPIFY_*` | `SHOPIFY_CLIENT_ID` · `SHOPIFY_CLIENT_SECRET` · `SHOPIFY_QUESTIONS_SHEET_TAB` · `SHOPIFY_SCOPES` · `SHOPIFY_WEBHOOK_SECRET` |
| `SMTP_*` | `SMTP_HOST` · `SMTP_PASS` · `SMTP_PORT` · `SMTP_SECURE` · `SMTP_USER` |
| `WOLFB_*` | `WOLFB_ADMIN_SHEET_ID` · `WOLFB_ADMIN_TAB` · `WOLFB_CRM_ENVIADOS_TAB` · `WOLFB_CRM_MAIN_TAB` · `WOLFB_DRY_RUN` |
| `GOOGLE_*` | `GOOGLE_APPLICATION_CREDENTIALS` · `GOOGLE_OAUTH_CLIENT_ID` · `GOOGLE_TASKS_CLIENT_ID` · `GOOGLE_TASKS_CLIENT_SECRET` |
| `WHATSAPP_*` | `WHATSAPP_ACCESS_TOKEN` · `WHATSAPP_APP_SECRET` · `WHATSAPP_PHONE_NUMBER_ID` · `WHATSAPP_VERIFY_TOKEN` |
| `IDENTITY_*` | `IDENTITY_COOKIE_DOMAIN` · `IDENTITY_COOKIE_NAME` · `IDENTITY_JWT_SECRET` |
| `KB_*` | `KB_ANALYTICS_LOG_MISS_QUESTION` · `KB_ANALYTICS_WINDOW_MAX_DAYS` |
| `ML_*` | `ML_CLIENT_ID` · `ML_CLIENT_SECRET` |
| `OPENAI_*` | `OPENAI_API_KEY` · `OPENAI_CHAT_MODEL` |
| `SHEETS_*` | `SHEETS_CLIENT_QUOTES_ENABLED` · `SHEETS_CLIENT_QUOTES_TAB` |
| `WA_*` | `WA_AUTH_EMAIL_FROM` · `WA_JWT_SECRET` |
| `AI_*` | `AI_GATEWAY_API_KEY` |
| `ANTHROPIC_*` | `ANTHROPIC_API_KEY` |
| `EMAIL_*` | `EMAIL_INGEST_TOKEN` |
| `FRONTEND_*` | `FRONTEND_BASE_URL` |
| `GEMINI_*` | `GEMINI_API_KEY` |
| `GROK_*` | `GROK_API_KEY` |
| `INTERNAL_*` | `INTERNAL_SUPERADMIN_EMAILS` |
| `MFA_*` | `MFA_KEK_HEX` |
| `PUBLIC_*` | `PUBLIC_BASE_URL` |
| `SUGGEST_*` | `SUGGEST_RESPONSE_USE_AGENT_CORE` |
| `SUPABASE_*` | `SUPABASE_PGP_ENCRYPT_KEY` |
| `SYNC_*` | `SYNC_HMAC_SECRET` |
| `VITE_*` | `VITE_GOOGLE_CLIENT_ID` |

## 4. Persistencia / migraciones (85 tablas)

**`migrations/`** — 1 migración(es), tablas: `bmc_schema_migrations`, `quote_embeddings`

**`server/migrations/market-intel/`** — 8 migración(es), tablas: `bmc_market_intel.competitors`, `bmc_market_intel.skus`, `bmc_market_intel.price_history`, `bmc_market_intel.etl_runs`, `bmc_market_intel.alerts`, `bmc_market_intel.mystery_shopping_queue`

**`shop-chat-agent/prisma/migrations/20240530213853_create_session_table/`** — 1 migración(es)

**`shop-chat-agent/prisma/migrations/20250501044923_add_customer_tokens_table/`** — 1 migración(es)

**`shop-chat-agent/prisma/migrations/20250502141909_add_code_verifier_table/`** — 1 migración(es)

**`shop-chat-agent/prisma/migrations/20250508000001_add_conversation_tables/`** — 1 migración(es)

**`shop-chat-agent/prisma/migrations/20251010121648_add_customer_account_urls_table/`** — 1 migración(es)

**`supabase/migrations/`** — 14 migración(es), tablas: `bmc_price_monitor.shopify_products`, `bmc_price_monitor.shopify_variants`, `bmc_price_monitor.ml_listings`, `bmc_price_monitor.search_keywords`, `bmc_price_monitor.ml_competitors`, `bmc_price_monitor.fx_settings`, `bmc_price_monitor.price_alerts`, `bmc_price_monitor.etl_runs`, `clientes.customers`, `clientes.customer_identities`, `clientes.customer_field_provenance`, `clientes.customer_events`, `clientes.customer_events_2026_04`, `clientes.customer_events_2026_05`, `clientes.customer_events_2026_06`, `clientes.customer_quotes`, `clientes.customer_purchases`, `clientes.customer_scores`, `clientes.customer_followups`, `clientes.automation_rules`, `clientes.customer_aliases`, `clientes.agent_jobs`, `clientes.agent_runs`, `archive.clientes_followups_2026_06`, `identity.message_threads`, `identity.message_thread_members`, `identity.messages`, `identity.user_activity_log`, `identity.users`, `identity.sessions`, `identity.modules`, `identity.role_grants`, `identity.module_grants`, `identity.access_requests`, `identity.quotes`, `identity.quote_events`, `identity.special_quote_requests`, `identity.notifications`, `identity.crm_personal_contacts`, `identity.crm_personal_leads`, `identity.audit_log`, `identity.mfa_secrets`, `tasks.task_lists`, `tasks.tasks`, `tasks.oauth_tokens`, `tasks.oauth_state`, `tasks.sync_log`, `tasks.sync_conflicts`, `public.oauth_states`

**`traktime-package/migrations/`** — 11 migración(es), tablas: `tk_clients`, `tk_projects`, `tk_project_members`, `tk_tasks`, `tk_tags`, `tk_entries`, `tk_invoices`, `tk_invoice_lines`, `tk_invoice_seq`, `tk_audit_log`

**`transportista-cursor-package/migrations/`** — 5 migración(es), tablas: `trips`, `trip_events`, `driver_sessions`, `outbox_notifications`

**`wa-package/migrations/`** — 18 migración(es), tablas: `wa_conversations`, `wa_messages`, `wa_suggestions`, `wa_quotes`, `wa_followups`, `wa_heartbeats`, `wa_settings`, `wa_flags`, `wa_operators`, `wa_audit_log`, `wa_webhooks`, `wa_rules`, `wa_sla_breaches`, `bmc_quote_counter`

## 5. Auth & seguridad

- **Google OAuth** — `POST /api/auth/google` emite sesión (`server/routes/authGoogle.js`).
- **TOTP 2FA** — `POST /api/auth/mfa/challenge` (`server/routes/authMfa.js` + `server/lib/mfaTotp.js`).
- **Tokens JWT + refresh** — rotación obligatoria + reuse-detection (`server/lib/identityAuth.js`). Cookie `bmc_sess` (httpOnly, SameSite=Strict) sólo para `/api/auth/refresh`.
- **requireAuth** — valida el access-JWT (`server/middleware/requireAuth.js`).
- **RBAC por módulo** — grants `read`/`write`/`admin` (`server/middleware/requireGrant.js`).
- **Middleware:** `requireAuth.js`, `requireCrmCockpitAuth.js`, `requireGrant.js`, `requireServiceOrUser.js`, `requireWolfboardAuth.js`.

## 6. Scripts npm (209)
| Script | Comando |
|---|---|
| `version:data` | `node scripts/update-calculator-data-version.js` |
| `quotation-preview:render` | `node scripts/render-quotation-preview-html.mjs` |
| `smoke:bmc-pdf` | `node scripts/bmc-pdf-export-smoke.mjs` |
| `preview:watch` | `node scripts/preview-dev.mjs` |
| `readme:generate` | `node scripts/generate-readme-presentation.mjs` |
| `readme:sync` | `npm run version:data && node scripts/generate-readme-presentation.mjs` |
| `readme:check` | `node scripts/generate-readme-presentation.mjs --check` |
| `disk:precheck` | `test "$BMC_DISK_PRECHECK_SKIP" = "1" \|\| bash scripts/disk-space-precheck.sh .` |
| `predev` | `npm run disk:precheck` |
| `dev` | `npm run version:data && vite` |
| `dev:api` | `node --watch server/index.js` |
| `start:api` | `node server/index.js` |
| `dev:full` | `concurrently -n api,vite -c blue,green "npm run start:api" "npm run dev"` |
| `dev:full-stack` | `./run_full_stack.sh` |
| `local:view` | `bash scripts/local-view-autolaunch.sh` |
| `local:view:open` | `bash scripts/local-view-autolaunch.sh --open` |
| `local:stack:launchd:install` | `bash scripts/install-local-stack-launchagent.sh` |
| `local:stack:launchd:uninstall` | `bash scripts/uninstall-local-stack-launchagent.sh` |
| `dev:full:watch` | `concurrently -n api,vite -c blue,green "npm run dev:api" "npm run dev"` |
| `bmc-dashboard` | `node docs/bmc-dashboard-modernization/sheets-api-server.js` |
| `finanzas:inspect` | `node scripts/inspect-docker-context.cjs` |
| `finanzas:repro` | `bash scripts/repro-finanzas-404.sh` |
| `ml:cloud-run` | `./run_ml_cloud_run_setup.sh` |
| `ml:verify` | `bash scripts/verify-ml-oauth.sh` |
| `ml:corpus-export` | `node scripts/ml-export-full-corpus.mjs` |
| `wolfboard:run` | `bash scripts/wolfboard-run.sh` |
| `wolfboard:cotizar` | `node scripts/wolfboard-cotizar-batch.mjs` |
| `wolfboard:cotizar:force` | `node scripts/wolfboard-cotizar-batch.mjs --force` |
| `wolfboard:batch-ia` | `curl -s -X POST http://localhost:3001/api/wolfboard/quote-batch -H 'Content-Type: applicat` |
| `wolfboard:replay-fetch` | `node scripts/fetch-wolfboard-replay.mjs` |
| `ml:sim-batch` | `node scripts/ml-simulation-batch-export.mjs` |
| `ml:ai-audit` | `node scripts/ml-ai-audit-report.mjs` |
| `ml:pending-workup` | `node scripts/ml-pending-workup.mjs` |
| `etl:price-monitor` | `node scripts/price-monitor-etl.mjs` |
| `etl:price-monitor:dry` | `node scripts/price-monitor-etl.mjs --dry` |
| `proxy:openai` | `./run_proxy_openai.sh` |
| `prebuild` | `npm run disk:precheck && npm run version:data` |
| `build` | `vite build` |
| `preview` | `vite preview` |
| `tauri` | `npx --yes @tauri-apps/cli@^2` |
| `tauri:dev` | `npx --yes @tauri-apps/cli@^2 dev` |
| `tauri:build` | `npx --yes @tauri-apps/cli@^2 build` |
| `tauri:icon` | `npx --yes @tauri-apps/cli@^2 icon` |
| `demo:combinada-fijacion` | `node scripts/demo-combinada-fijacion-planta.mjs` |
| `docs:reference` | `node scripts/generate-system-reference.mjs` |
| `docs:tour` | `playwright test scripts/product-tour.spec.ts` |
| `docs:pdf` | `node scripts/build-product-pdf.mjs` |
| `docs:product` | `npm run docs:reference && npm run docs:tour && npm run docs:pdf` |
| `test` | `npm run test:core && npm run test:wa && npm run test:agent && npm run test:kb` |
| `test:core` | `node tests/validation.js && node tests/roofVisualQuoteConsistency.js && node tests/emailIn` |
| `test:wa` | `node tests/wa-ingest-contract.js && node tests/wa-enricher.test.js && node tests/wa-quote-` |
| `test:agent` | `node tests/agentTools.test.js && node tests/traktime-agent-tools.test.js && node tests/tra` |
| `test:kb` | `node tests/kbSurfaceResolve.test.js && node tests/kbAnalytics.test.js && node tests/sugges` |
| `test:playwright:roof-bordes-local` | `node scripts/playwright-roof-bordes-local.mjs` |
| `test:playwright:hub-canales` | `node scripts/playwright-hub-canales-smoke.mjs` |
| `test:playwright:wizard` | `node scripts/playwright-wizard-happy-path.mjs` |
| `test:ml-auto` | `bash scripts/test-ml-auto-mode.sh` |
| `test:ml-auto:prod` | `bash scripts/test-ml-auto-mode.sh https://panelin-calc-q74zutv7dq-uc.a.run.app` |
| `test:e2e:wizard` | `node scripts/playwright-calculator-wizard.mjs` |
| `walkthrough:admin-cot` | `node scripts/playwright-admin-cot-walkthrough.mjs` |
| `walkthrough:admin-cot:headed` | `HEADED=1 node scripts/playwright-admin-cot-walkthrough.mjs` |
| `test:browser:full` | `node scripts/browser-test-suite.mjs` |
| `test:browser:full:local` | `node scripts/browser-test-suite.mjs --local` |
| `smoke:browser` | `node scripts/playwright-route-audit-smoke.mjs` |
| `smoke:browser:prod` | `node scripts/playwright-route-audit-smoke.mjs --base=https://calculadora-bmc.vercel.app` |
| `test:api` | `node tests/apiClient.test.js && node tests/operatorApiClient.test.js && node tests/teamAss` |
| `test:wa-integration` | `node tests/wa-enricher-integration.test.js` |
| `test:wa-pro` | `node tests/wa-config.test.js && node tests/wa-operator-auth.test.js && node tests/wa-rules` |
| `test:chat` | `node tests/chat-hardening.js` |
| `test:contracts` | `node scripts/validate-api-contracts.js` |
| `test:agent-golden` | `node tests/agentGolden/runner.mjs` |
| `mcp:panelin` | `node scripts/mcp-panelin-http.mjs` |
| `verify-tabs` | `node scripts/verify-sheets-tabs.js` |
| `setup-sheets-tabs` | `node scripts/setup-sheets-tabs.js` |
| `integrate-admin-cotizaciones` | `node scripts/integrate-admin-cotizaciones.js` |
| `watch-full-team` | `./scripts/watch-full-team-run.sh` |
| `map-all-sheets` | `node scripts/map-all-sheets-audit.js` |
| `launchpad` | `node scripts/launchpad-bmc-dev.js` |
| `launchpad:learn` | `node scripts/launchpad-bmc-dev.js --learn` |
| `go-live` | `./scripts/go-live-automation.sh` |
| `pre-deploy` | `./scripts/pre-deploy-check.sh` |
| `verify:dev` | `bash scripts/bmc-dev-verify.sh` |
| `verify:dev:all` | `bash scripts/bmc-dev-verify.sh --all` |
| `verify:rdx` | `bash scripts/bmc-dev-verify.sh --all` |
| `gate:local` | `npm run lint && npm test && npm run test:api` |
| `dev:check:all` | `bash scripts/bmc-dev-check-all.sh` |
| `gate:local:full` | `npm run lint && npm test && npm run test:api && npm run build` |
| `check:env-drift` | `node scripts/check-env-drift.mjs` |
| `gate:secrets` | `node scripts/gate-secrets-drift.mjs` |
| `check` | `npm run gate:local` |
| `lint` | `eslint src/` |
| `team:hub` | `npx --yes serve docs -l 4710` |
| `open:email-env` | `bash scripts/open-email-inbox-env.sh` |
| `workspace:start` | `npm install && npm run env:ensure && node -e "console.log('\n=== Calculadora BMC workspace` |
| `workspace:autostart` | `bash scripts/workspace-folder-open.sh` |
| `env:ensure` | `bash scripts/ensure-env.sh` |
| `keys:audit` | `bash scripts/openai-key-audit.sh` |
| `keys:rotate` | `bash scripts/openai-key-rotate.sh` |
| `verify:google-drive-oauth` | `node scripts/verify-google-drive-oauth-env.mjs` |
| `verify:google-drive-dist` | `node scripts/verify-vite-google-client-in-dist.mjs` |
| `drive:bootstrap` | `bash scripts/drive-oauth-bootstrap.sh` |
| `drive:configure` | `node scripts/set-vite-google-client.mjs` |
| `drive:vercel-env` | `bash scripts/vercel-drive-env-push.sh` |
| `drive:one-shot` | `bash scripts/drive-oauth-one-shot.sh` |
| `panelsim:env` | `bash scripts/ensure-panelsim-sheets-env.sh` |
| `panelsim:email-ready` | `bash scripts/panelsim-email-ready.sh` |
| `panelsim:session` | `bash scripts/panelsim-full-session.sh` |
| `panelin:train:import` | `node scripts/panelin-training-import.mjs` |
| `capabilities:snapshot` | `node scripts/capabilities-snapshot.mjs` |
| `smoke:prod` | `node scripts/smoke-prod-api.mjs` |
| `smoke:routes` | `node scripts/demo-route-smoke.mjs` |
| `smoke:prod:no-ia` | `node scripts/smoke-prod-api.mjs --skip-suggest` |
| `bug-reports:setup-sheet` | `node scripts/setup-bug-reports-tab.mjs` |
| `bug-reports:ship` | `node scripts/bug-reports-ship-goal.mjs` |
| `bug-reports:ship:bg` | `node scripts/bug-reports-ship-goal.mjs >> .runtime/goals/bug-reports-ship.log 2>&1 &` |
| `wa:cloud-check` | `node scripts/whatsapp-cloud-check.mjs` |
| `matriz:rename-headers` | `node scripts/matriz-rename-bromyros-headers.mjs` |
| `followup` | `node scripts/followup.mjs` |
| `program:status` | `node scripts/program-status.mjs` |
| `project:compass` | `node scripts/project-compass.mjs` |
| `schedule` | `npm run project:compass` |
| `channels:onboarding` | `node scripts/channels-onboarding.mjs` |
| `channels:automated` | `node scripts/channels-automated-pipeline.mjs` |
| `email:ingest-snapshot` | `node scripts/email-snapshot-ingest.mjs` |
| `matriz:reconcile` | `node scripts/reconcile-matriz-csv.mjs` |
| `matriz:reconcile-calc` | `node scripts/reconcile-calc-vs-matriz.mjs` |
| `matriz:bake` | `node scripts/bake-matriz-to-constants.mjs` |
| `matriz:pull-csv` | `node scripts/pull-matriz-csv.mjs` |
| `matriz:sync-fijaciones-isodec` | `node scripts/sync-fijaciones-isodec-bromyros.mjs` |
| `matriz:sync-silicona-300` | `node scripts/sync-silicona-300-neutra-bromyros.mjs` |
| `catalog:diff` | `node scripts/catalog-diff.mjs` |
| `catalog:diff:json` | `node scripts/catalog-diff.mjs --json` |
| `productos-maestro:reconcile` | `node scripts/reconcile-productos-maestro.mjs` |
| `productos-maestro:reconcile:json` | `node scripts/reconcile-productos-maestro.mjs --json` |
| `team:agent-matrix-skills` | `node scripts/merge-agent-matrix-skills.mjs` |
| `session:video-deps` | `bash scripts/user-session-video-deps.sh check` |
| `session:video-deps:ensure` | `bash scripts/user-session-video-deps.sh ensure` |
| `session:video-extract` | `bash scripts/user-session-video-extract.sh` |
| `session:video-ingest` | `bash scripts/user-session-video-ingest-from-iphone.sh` |
| `mac:storage-audit` | `bash scripts/mac-storage-audit-readonly.sh` |
| `mcp:cache:audit` | `bash scripts/mcp-cache-manager.sh audit` |
| `mcp:cache:prune` | `bash scripts/mcp-cache-manager.sh prune` |
| `mcp:cache:prune:apply` | `bash scripts/mcp-cache-manager.sh prune --apply` |
| `session:archive:audit` | `bash scripts/session-artifact-lifecycle.sh audit` |
| `session:archive:run` | `bash scripts/session-artifact-lifecycle.sh run` |
| `session:archive:run:prune` | `bash scripts/session-artifact-lifecycle.sh run --apply-prune` |
| `session:archive:schedule:install` | `bash scripts/install-session-artifact-schedule.sh` |
| `session:archive:schedule:uninstall` | `bash scripts/uninstall-session-artifact-schedule.sh` |
| `session:archive:schedule:tick` | `bash scripts/session-artifact-scheduler.sh` |
| `transportista:migrate` | `node scripts/run-transportista-migrations.mjs` |
| `traktime:migrate` | `node scripts/run-traktime-migrations.mjs` |
| `wa:migrate` | `node scripts/run-wa-migrations.mjs` |
| `wa:admin` | `node scripts/wa-admin.mjs` |
| `wa:reconcile` | `node scripts/wa-reconcile-sheet.mjs` |
| `wa:purge-old` | `node scripts/wa-purge-old.mjs` |
| `wa:gen-docs` | `node scripts/wa-gen-config-docs.mjs` |
| `wa:ext:load` | `bash scripts/wa-extension-load.sh` |
| `wa:ext:rebuild` | `bash scripts/wa-extension-load.sh --rebuild` |
| `wa:ext:watch` | `bash scripts/wa-extension-load.sh --watch` |
| `visor:shopify-map` | `node scripts/build-quote-visor-shopify-map.mjs` |
| `visor:shopify-families` | `node scripts/build-quote-visor-shopify-families.mjs` |
| `visor:shopify-sync` | `npm run visor:shopify-map && npm run visor:shopify-families` |
| `panel:rendering:sync` | `node scripts/download-panel-rendering-assets.mjs` |
| `knowledge:scan` | `node scripts/knowledge-antenna-run.mjs --max-per-source=8 --min-score=0.45` |
| `knowledge:rank` | `node scripts/knowledge-antenna-rank.mjs` |
| `knowledge:impact` | `node scripts/knowledge-antenna-impact.mjs --days=14` |
| `knowledge:db` | `node scripts/knowledge-antenna-db.mjs --days=14` |
| `knowledge:direction` | `node scripts/knowledge-direction-tracker.mjs --max=12` |
| `training:report` | `node scripts/training-report.mjs` |
| `knowledge:report` | `node scripts/knowledge-antenna-run.mjs --max-per-source=8 --min-score=0.45` |
| `knowledge:env:ensure` | `bash scripts/knowledge-antenna-env-ensure.sh ensure` |
| `knowledge:env:check` | `bash scripts/knowledge-antenna-env-ensure.sh check` |
| `knowledge:env:cwd:guard` | `bash scripts/knowledge-antenna-env-cwd-regression.sh` |
| `knowledge:preflight` | `node scripts/knowledge-antenna-preflight.mjs --strict --sample=3` |
| `knowledge:magazine` | `node scripts/knowledge-antenna-magazine.mjs` |
| `knowledge:run` | `npm run knowledge:env:ensure && npm run knowledge:preflight && npm run knowledge:scan && n` |
| `kb:build` | `node scripts/build-accessible-base.mjs` |
| `kb:build:quiet` | `node scripts/build-accessible-base.mjs --quiet` |
| `sheets:sync` | `node scripts/accessible-base-sync.js` |
| `sheets:sync:dry` | `node scripts/accessible-base-sync.js --dry-run` |
| `sheets:sync:watch` | `node scripts/accessible-base-sync.js --watch 3` |
| `sheets:sync:sheet` | `node scripts/accessible-base-sync.js --sheet` |
| `development:chain` | `node scripts/development-chain-runner.mjs` |
| `development:chain:full` | `node scripts/development-chain-runner.mjs --full` |
| `expert:workflow` | `node scripts/expert-dev-traceability.mjs workflow` |
| `expert:checkpoint` | `node scripts/expert-dev-traceability.mjs snapshot` |
| `expert:checkpoints` | `node scripts/expert-dev-traceability.mjs list` |
| `expert:restore-hint` | `node scripts/expert-dev-traceability.mjs restore-hint` |
| `knowledge:schedule:install` | `bash scripts/install-knowledge-antenna-schedule.sh` |
| `knowledge:schedule:uninstall` | `bash scripts/uninstall-knowledge-antenna-schedule.sh` |
| `knowledge:schedule:tick` | `bash scripts/knowledge-antenna-scheduler.sh` |
| `magazine:daily` | `node scripts/magazine-daily-digest.mjs` |
| `magazine:daily:send` | `node scripts/magazine-daily-digest.mjs --send` |
| `magazine:daily:dry` | `node scripts/magazine-daily-digest.mjs --dry-run` |
| `magazine:schedule:install` | `bash scripts/install-magazine-daily-schedule.sh` |
| `magazine:schedule:uninstall` | `bash scripts/uninstall-magazine-daily-schedule.sh` |
| `magazine:schedule:tick` | `bash scripts/magazine-daily-scheduler.sh` |
| `credentials:registry` | `node scripts/credentials-master-registry.mjs` |
| `credentials:registry:probe` | `node scripts/credentials-master-registry.mjs --probe-local` |
| `credentials:registry:encrypt` | `node scripts/credentials-master-registry.mjs --encrypt` |
| `credentials:registry:encrypt:only` | `node scripts/credentials-master-registry.mjs --encrypt-only` |
| `credentials:registry:decrypt` | `node scripts/credentials-master-registry.mjs --decrypt` |
| `test:playwright:admin-cot-suggest-ia` | `node scripts/playwright-admin-cot-suggest-ia.mjs` |
| `test:playwright:admin-cot-suggested-badge` | `node scripts/playwright-admin-cot-suggested-badge.mjs` |
| `test:playwright:admin-cot-wa-timeline` | `node scripts/playwright-admin-cot-wa-timeline.mjs` |
| `test:playwright:admin-cot-f1-completion` | `node scripts/playwright-admin-cot-f1-completion.mjs` |
| `test:market-intel` | `node --test tests/market-intel/*.test.js` |
| `migrate:market-intel` | `node server/migrations/market-intel/run-migrations.js` |
| `etl:run` | `node -e "require("./server/lib/marketIntel/scheduler")"` |

## 7. CI / workflows (11)
| Workflow | Nombre | Disparadores |
|---|---|---|
| `catalog-diff.yml` | Catalog ↔ MATRIZ diff | schedule, pull_request, workflow_dispatch |
| `ci.yml` | CI — Panelin Calculadora BMC | push, pull_request, workflow_dispatch, schedule |
| `deploy-calc-api.yml` | Deploy Calculator API to Cloud Run | workflow_dispatch |
| `deploy-vercel.yml` | Deploy Frontend to Vercel | pull_request, workflow_dispatch |
| `drive-oauth-dist-verify.yml` | Drive OAuth — verify Client ID in dist | workflow_dispatch |
| `drive-oauth-verify.yml` | Drive OAuth — verify Client ID | workflow_dispatch |
| `email-ingest-scheduled.yml` | Email ingest — scheduled | workflow_dispatch, schedule |
| `knowledge-antenna-reusable.yml` | Knowledge Antenna reusable | workflow_call |
| `knowledge-antenna-scheduled.yml` | Knowledge Antenna — scheduled | workflow_dispatch, schedule |
| `product-docs.yml` | Product Docs (auto-update) | schedule, workflow_dispatch |
| `smoke-prod-scheduled.yml` | Smoke — prod API (scheduled) | schedule, workflow_dispatch |

## 8. Agentes Claude (12)
- **`bmc-api-contract`** — "Validates API responses against canonical contracts for the BMC project. Detects drift between server routes and expected shapes before the UI breaks. Use when
- **`bmc-calc-specialist`** — "Specialist for the Panelin Calculator (calculadora-bmc.vercel.app, port 5173). Knows BOM, pricing logic, panel constants, techo/pared calculations, Drive integ
- **`bmc-deployment`** — "Deployment specialist for calculadora-bmc.vercel.app (Vercel frontend) and panelin-calc Cloud Run (Node.js API). Handles deploy, rollback, diagnostics, env var
- **`bmc-docs-sync`** — "Keeps PROJECT-STATE.md, docs/, and propagation protocol up to date for the BMC project. Detects stale docs, broken links, missing README entries, and agents th
- **`bmc-fiscal`** — "Fiscal oversight and operational efficiency agent for BMC Uruguay (SAS). Detects IVA/IRAE/BPS inconsistencies, monitors PROJECT-STATE protocol compliance by ot
- **`bmc-judge`** — "Evaluates team work quality and agent performance for BMC/Panelin project. Generates run reports, historical rankings, and next-step recommendations. Use when 
- **`bmc-orchestrator`** — "Orchestrates full BMC team runs for the calculadora-bmc.vercel.app project. Coordinates all roles in order, applies Run Scope Gate, manages handoffs, and itera
- **`bmc-panelin-chat`** — "Specialist for the Panelin AI chat system and Developer Training Mode. Knows PanelinChatPanel, PanelinDevPanel, useChat hook, agentChat SSE endpoint, training 
- **`bmc-panelin-mcp`** — External agent surface for the Panelin BMC calculator. Exposes 22 tools (calc + catalog + state + PDF + CRM + WhatsApp + telemetry) over MCP for use by Claude C
- **`bmc-security`** — "Security reviewer for BMC/Panelin project. Audits OAuth tokens, env vars, CORS, HMAC webhooks, credentials, and pre-deploy security checklist. Use when asked f
- **`bmc-sheets-mapping`** — "Google Sheets and planilla mapping specialist for BMC. Knows CRM_Operativo, Master_Cotizaciones, Pagos_Pendientes, Metas_Ventas, AUDIT_LOG schemas, column mapp
- **`calculo-especialist`** — "Specialist for the 2D roof plan SVG dimensioning system (planta de cotas). Knows buildPanelLayout, PanelChainDimensions, PanelLabels, VerificationBadge, roofPl

---

_Regenerar:_ `node scripts/generate-system-reference.mjs`.
