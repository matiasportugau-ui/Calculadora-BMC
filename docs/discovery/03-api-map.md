# Phase 3 — API Inventory

**Audit:** EXPORT_SEAL::OMNI_HUB_DISCOVERY_MASTER_V1  
**Date:** 2026-06-22  
**Repo SHA:** `d04a7f4`  
**Total router endpoints:** 340 (route modules) + ~35 (inline `server/index.js`)  
**Cross-links:** [01-current-system-map](01-current-system-map.md) · [07-security-map](07-security-map.md)

---

## Auth pattern legend

| Pattern | Meaning |
|---------|---------|
| **NONE** | No auth middleware on route |
| **requireAuth** | `API_AUTH_TOKEN` Bearer |
| **requireUser()** | Identity JWT |
| **requireGrant** | Module grant via JWT |
| **requireCrmCockpitRead/Write** | JWT `canales:read/write` or `API_AUTH_TOKEN` |
| **requireWaAccess** | JWT `wa` module or `API_AUTH_TOKEN` |
| **requireDriver** | Driver session token (Postgres) |
| **requireEmailIngestAuth** | `EMAIL_INGEST_TOKEN` or `API_AUTH_TOKEN` |
| **HMAC** | Webhook signature verification |
| **requireServiceOrUser** | API token or user JWT (Panelin) |

---

## Mount map (`server/index.js`)

**Evidence:**

- File: `server/index.js`  
  Path: `/Users/matias/calculadora-bmc/server/index.js`  
  Lines: 964–1061  
  Description: Route module mounting order.

| Mount | Module |
|-------|--------|
| `/calc` | calc.js |
| `/api/team-assist` | teamAssist.js |
| `/api` | auth, agent*, followups, transportista, wa, dashboard, … |
| `/api/agent` | superAgent.js |
| `/api/internal/panelin` | panelinInternal.js |
| `/api/internal/presup` | presupOrchestrator.js |
| `/api/panelin` | panelin.js (+ requireServiceOrUser) |
| `/api/wolfboard` | wolfboard.js |
| `/api/marketing` | marketing.js |
| `/api/bugs` | bugs.js |
| `/api/pdf` | pdf.js |
| `/api/tasks` | tasks.js |
| `/auth/tasks` | tasksOAuth.js |
| `/sync` | tasksSync.js |
| `/` | legacyQuote.js |

**NOT_MOUNTED:** `server/routes/webhooks.js` — live webhooks in index.js L533–962.

---

## Inline routes (`server/index.js`)

| Method | Path | Auth | Handler | Dependencies | Status |
|--------|------|------|---------|--------------|--------|
| GET | `/capabilities` | NONE | inline | agentCapabilitiesManifest | IMPLEMENTED |
| GET | `/version` | NONE | inline | versionInfo | IMPLEMENTED |
| GET | `/health` | NONE | inline | ml, Sheets, config | IMPLEMENTED |
| POST | `/api/vitals` | NONE | inline 204 | — | IMPLEMENTED |
| GET | `/auth/ml/start` | NONE | inline | ml, oauthStateStore | IMPLEMENTED |
| GET | `/auth/ml/callback` | NONE | inline | ml OAuth | IMPLEMENTED |
| GET | `/auth/ml/status` | NONE | inline | ml tokenStore | IMPLEMENTED |
| GET | `/ml/users/me` | NONE* | inline | ml client | IMPLEMENTED |
| GET | `/ml/users/:id` | NONE* | inline | ml client | IMPLEMENTED |
| GET | `/ml/listings` | NONE* | inline | ml client | IMPLEMENTED |
| GET | `/ml/items/:id` | NONE* | inline | ml client | IMPLEMENTED |
| PATCH | `/ml/items/:id` | NONE* | inline | ml client | IMPLEMENTED |
| POST | `/ml/items/:id/description` | NONE* | inline | ml client | IMPLEMENTED |
| GET | `/ml/questions` | NONE* | inline | ml client | IMPLEMENTED |
| GET | `/ml/questions/:id` | NONE* | inline | ml client | IMPLEMENTED |
| POST | `/ml/questions/:id/answer` | NONE* | inline | ml client | IMPLEMENTED |
| GET | `/ml/orders` | NONE* | inline | ml client | IMPLEMENTED |
| GET | `/ml/orders/:id` | NONE* | inline | ml client | IMPLEMENTED |
| POST | `/webhooks/ml` | HMAC | inline | ml-crm-sync, mlAutoAnswer | IMPLEMENTED |
| GET | `/webhooks/ml/events` | NONE | inline | in-memory events | IMPLEMENTED |
| GET | `/api/ml/auto-mode` | NONE | inline | .ml-automode.json | IMPLEMENTED |
| POST | `/api/ml/auto-mode` | API_AUTH_TOKEN | inline | config | IMPLEMENTED |
| GET | `/webhooks/whatsapp` | Meta verify | inline | WHATSAPP_VERIFY_TOKEN | IMPLEMENTED |
| POST | `/webhooks/whatsapp` | HMAC | inline | waDb, agentCore, Sheets | IMPLEMENTED |
| GET | `/api/diagnostic` | NONE (dev) | inline | config, fs | IMPLEMENTED |
| GET | `/api/dev/dashboard-mtime` | NONE (dev) | inline | fs | IMPLEMENTED |
| GET | `/favicon.ico` | NONE | inline 204 | — | IMPLEMENTED |
| GET | `/` | NONE | redirect /finanzas | — | IMPLEMENTED |

\*ML proxy uses stored OAuth tokens; no HTTP auth on route.

**Evidence:** `server/index.js` L216–1126

---

## Auth summary by module

| Module | Default auth | Notable open routes |
|--------|--------------|---------------------|
| bmcDashboard.js | NONE (most GETs) | All read routes; suggest-response POST |
| calc.js | NONE (most) | cotizar, catalogo |
| wa.js | requireWaAccess | `/wa/auth/*`, `/wa/health`, `/wa/config/extension` public |
| agentChat.js | NONE (+ rate limit) | `/agent/chat`, `/agent/ai-options` |
| identity* | requireUser / admin | — |
| traktime.js | requireUser() | `/api/traktime/health` NONE |
| transportista.js | requireCrmAuth / requireDriver | health NONE |
| presupOrchestrator.js | NONE | `/api/internal/presup/run` |
| panelin.js | requireServiceOrUser (router) | inherited all routes |

---

## Security hotspots (factual)

1. `POST /api/crm/suggest-response` — no auth (`bmcDashboard.js` L2311)
2. Many `GET /api/*` Sheets routes — no auth
3. `POST /api/agent/voice/action` — no requireAuth (`agentVoice.js` L228)
4. Duplicate `GET /api/wa/operators` — L284 and L1268 in `wa.js`

---

## Route module inventory

## `server/routes/activity.js`

Mount: `/api` | Count: 3

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/activity/status` | L37 |
| GET | `/api/activity/today` | L45 |
| GET | `/api/activity/buckets` | L62 |

## `server/routes/agentChat.js`

Mount: `/api` | Count: 5

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/agent/ai-options` | L99 |
| GET | `/api/agent/tool-stats` | L110 |
| GET | `/api/agent/tools-manifest` | L121 |
| POST | `/api/agent/exec-tool` | L223 |
| POST | `/api/agent/chat` | L451 |

## `server/routes/agentConversations.js`

Mount: `/api` | Count: 6

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/agent/stats` | L19 |
| GET | `/api/agent/conversations` | L59 |
| GET | `/api/agent/conversations/weekly-digest` | L70 |
| POST | `/api/agent/conversations/analyze-batch` | L115 |
| GET | `/api/agent/conversations/:id` | L160 |
| GET | `/api/agent/conversations/:id/analysis` | L167 |

## `server/routes/agentFeedback.js`

Mount: `/api` | Count: 3

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/agent/feedback` | L8 |
| GET | `/api/agent/feedback` | L28 |
| GET | `/api/agent/feedback/stats` | L40 |

## `server/routes/agentTraining.js`

Mount: `/api` | Count: 27

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/agent/train` | L51 |
| PUT | `/api/agent/train/:id` | L61 |
| DELETE | `/api/agent/train/bulk` | L72 |
| PATCH | `/api/agent/train/bulk` | L84 |
| DELETE | `/api/agent/train/:id` | L96 |
| GET | `/api/agent/training-kb` | L106 |
| GET | `/api/agent/training-kb/match` | L113 |
| GET | `/api/agent/dev-config` | L120 |
| POST | `/api/agent/dev-config` | L125 |
| POST | `/api/agent/prompt-preview` | L136 |
| POST | `/api/agent/training/log-event` | L143 |
| GET | `/api/agent/dev-config/:section/history` | L148 |
| POST | `/api/agent/dev-config/:section/revert` | L155 |
| POST | `/api/agent/knowledge/clear-cache` | L168 |
| GET | `/api/agent/training-kb/score-config` | L173 |
| POST | `/api/agent/training-kb/score-config` | L186 |
| POST | `/api/agent/autolearn` | L204 |
| GET | `/api/agent/autolearn/pending` | L238 |
| POST | `/api/agent/autolearn/:id/approve` | L246 |
| POST | `/api/agent/autolearn/:id/reject` | L256 |
| GET | `/api/agent/training-kb/health` | L267 |
| POST | `/api/agent/training-kb/:id/mark-reviewed` | L277 |
| POST | `/api/agent/training-kb/import` | L294 |
| GET | `/api/agent/training-kb/conflicts` | L338 |
| POST | `/api/agent/training-kb/:id/resolve-conflict` | L347 |
| POST | `/api/agent/training-kb/generate-ml-overrides` | L362 |
| GET | `/api/agent/training-kb/analytics` | L429 |

## `server/routes/agentTranscribe.js`

Mount: `/api` | Count: 1

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/agent/transcribe` | L45 |

## `server/routes/agentVoice.js`

Mount: `/api` | Count: 5

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/agent/voice/session` | L61 |
| POST | `/api/agent/voice/action` | L228 |
| GET | `/api/agent/voice/errors` | L272 |
| POST | `/api/agent/voice/errors/clear` | L288 |
| GET | `/api/agent/voice/health` | L298 |

## `server/routes/aiAnalytics.js`

Mount: `/api` | Count: 1

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/ai-analytics/trends` | L28 |

## `server/routes/authGoogle.js`

Mount: `/api` | Count: 6

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/auth/google` | L88 |
| POST | `/auth/refresh` | L143 |
| POST | `/auth/logout` | L173 |
| GET | `/auth/me` | L204 |
| GET | `/auth/me/grants` | L219 |
| POST | `/auth/dev-login` | L237 |

## `server/routes/authMfa.js`

Mount: `/api` | Count: 4

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/auth/mfa/enroll` | L85 |
| POST | `/auth/mfa/verify` | L129 |
| POST | `/auth/mfa/disable` | L205 |
| POST | `/auth/mfa/challenge` | L271 |

## `server/routes/bmcDashboard.js`

Mount: `/api` | Count: 50

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/cotizaciones` | L1522 |
| GET | `/api/proximas-entregas` | L1532 |
| GET | `/api/coordinacion-logistica` | L1542 |
| GET | `/api/audit` | L1561 |
| GET | `/api/pagos-pendientes` | L1572 |
| GET | `/api/metas-ventas` | L1593 |
| GET | `/api/calendario-vencimientos` | L1603 |
| GET | `/api/ventas` | L1634 |
| GET | `/api/ventas/tabs` | L1689 |
| GET | `/api/stock-ecommerce` | L1699 |
| GET | `/api/stock-kpi` | L1715 |
| GET | `/api/productos-maestro` | L1746 |
| GET | `/api/productos-maestro/reconcile` | L1755 |
| GET | `/api/productos-maestro/links` | L1764 |
| PUT | `/api/productos-maestro/links` | L1773 |
| POST | `/api/productos-maestro/push` | L1793 |
| GET | `/api/kpi-financiero` | L1879 |
| GET | `/api/stock/history` | L1928 |
| GET | `/api/kpi-report` | L1942 |
| GET | `/api/fiscal/bps-irae` | L2123 |
| POST | `/api/cotizaciones` | L2203 |
| PATCH | `/api/cotizaciones/:id` | L2216 |
| POST | `/api/pagos` | L2229 |
| PATCH | `/api/pagos/:id` | L2240 |
| POST | `/api/ventas` | L2251 |
| PATCH | `/api/stock/:codigo` | L2261 |
| POST | `/api/marcar-entregado` | L2271 |
| GET | `/api/actualizar-precios-calculadora` | L2287 |
| POST | `/api/crm/suggest-response` | L2311 |
| POST | `/api/crm/parse-email` | L2529 |
| POST | `/api/crm/ingest-email` | L2627 |
| POST | `/api/crm/parse-conversation` | L2788 |
| POST | `/api/ventas/logistica-fecha-entrega` | L2869 |
| POST | `/api/matriz/push-pricing-overrides` | L2880 |
| GET | `/api/email/panelsim-summary` | L2906 |
| POST | `/api/email/draft-outbound` | L2926 |
| GET | `/api/crm/cockpit/row/:rowNum` | L3021 |
| POST | `/api/crm/cockpit/quote-link` | L3040 |
| POST | `/api/crm/cockpit/approval` | L3060 |
| POST | `/api/crm/cockpit/mark-sent` | L3081 |
| POST | `/api/crm/cockpit/taxonomy-row` | L3104 |
| POST | `/api/crm/cockpit/save-response` | L3127 |
| POST | `/api/crm/cockpit/send-approved` | L3264 |
| GET | `/api/crm/cockpit/ml-queue` | L3266 |
| GET | `/api/crm/cockpit/wa-queue` | L3295 |
| POST | `/api/crm/cockpit/sync-ml` | L3321 |
| GET | `/api/crm/cockpit/unified-queue` | L3390 |
| GET | `/api/consultations` | L3427 |
| POST | `/api/consultations/:consultationId/reply` | L3502 |
| POST | `/api/crm/cockpit/sync-all` | L3519 |

## `server/routes/bugs.js`

Mount: `/api/bugs` | Count: 2

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/bugs/report` | L77 |
| GET | `/api/bugs/` | L211 |

## `server/routes/calc.js`

Mount: `/calc` | Count: 15

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/calc/openapi` | L56 |
| GET | `/calc/gpt-entry-point` | L65 |
| POST | `/calc/interaction-log` | L93 |
| GET | `/calc/interaction-log/list` | L110 |
| GET | `/calc/interaction-log/file/:name` | L129 |
| POST | `/calc/cotizar/presupuesto-libre` | L437 |
| POST | `/calc/cotizar` | L451 |
| POST | `/calc/cotizar/pdf` | L489 |
| GET | `/calc/pdf/:id` | L668 |
| GET | `/calc/cotizaciones` | L683 |
| GET | `/calc/cotizaciones/:id` | L702 |
| POST | `/calc/cotizaciones/:id/cancelar` | L715 |
| GET | `/calc/catalogo` | L753 |
| GET | `/calc/escenarios` | L786 |
| GET | `/calc/informe` | L850 |

## `server/routes/clientes/customers.js`

Mount: `` | Count: 2

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/clientes/customers` | L37 |
| GET | `/api/clientes/customers/summary` | L101 |

## `server/routes/clientes/followups.js`

Mount: `/api` | Count: 2

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/clientes/followups` | L44 |
| GET | `/api/clientes/followups` | L80 |

## `server/routes/deepResearch.js`

Mount: `/api` | Count: 3

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/research/deep` | L75 |
| GET | `/api/research/deep/:id` | L115 |
| POST | `/api/research/deep/:id/cancel` | L138 |

## `server/routes/followups.js`

Mount: `/api` | Count: 7

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/followups` | L26 |
| POST | `/api/followups` | L39 |
| GET | `/api/followups/:id` | L55 |
| PATCH | `/api/followups/:id` | L62 |
| POST | `/api/followups/:id/done` | L87 |
| POST | `/api/followups/:id/snooze` | L95 |
| DELETE | `/api/followups/:id` | L107 |

## `server/routes/identityAdmin.js`

Mount: `` | Count: 8

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/admin/users` | L88 |
| GET | `/api/admin/users/:id` | L153 |
| POST | `/api/admin/users/:id/role-grants` | L202 |
| DELETE | `/api/admin/users/:id/role-grants/:role` | L238 |
| PATCH | `/api/admin/users/:id/module-grants/:module` | L279 |
| POST | `/api/admin/users/:id/suspend` | L323 |
| POST | `/api/admin/users/:id/reactivate` | L363 |
| POST | `/api/admin/users/:id/revoke-sessions` | L386 |

## `server/routes/identityAnalytics.js`

Mount: `` | Count: 5

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/admin/analytics/active-users` | L56 |
| GET | `/api/admin/analytics/module-usage` | L73 |
| GET | `/api/admin/analytics/error-rate` | L93 |
| GET | `/api/admin/analytics/timeline` | L114 |
| GET | `/api/admin/analytics/top-actions` | L136 |

## `server/routes/identityMe.js`

Mount: `` | Count: 24

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/me/notifications` | L69 |
| PATCH | `/api/me/notifications/:id` | L89 |
| POST | `/api/access-requests` | L182 |
| GET | `/api/me/access-requests` | L210 |
| GET | `/api/admin/access-requests` | L226 |
| PATCH | `/api/admin/access-requests/:id` | L248 |
| POST | `/api/me/special-quote-requests` | L300 |
| GET | `/api/me/special-quote-requests` | L338 |
| GET | `/api/me/quotes` | L357 |
| GET | `/api/me/quotes/:id` | L367 |
| POST | `/api/me/quotes` | L377 |
| DELETE | `/api/me/quotes/:id` | L404 |
| POST | `/api/me/quotes/claim` | L419 |
| GET | `/api/admin/sheets/clientes/status` | L434 |
| POST | `/api/admin/sheets/clientes/reconcile` | L443 |
| POST | `/api/admin/sheets/clientes/sync/:quote_id` | L452 |
| POST | `/api/me/activity` | L482 |
| GET | `/api/me/activity` | L516 |
| GET | `/api/me/users/search` | L579 |
| GET | `/api/me/threads` | L610 |
| GET | `/api/me/threads/:id/messages` | L641 |
| POST | `/api/me/threads` | L684 |
| POST | `/api/me/threads/:id/messages` | L764 |
| PATCH | `/api/me/threads/:id/read` | L795 |

## `server/routes/internal/presupOrchestrator.js`

Mount: `/api/internal/presup` | Count: 3

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/internal/presup/run` | L31 |
| GET | `/api/internal/presup/status` | L77 |
| GET | `/api/internal/presup/run/example` | L90 |

## `server/routes/legacyQuote.js`

Mount: `` | Count: 7

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/ready` | L135 |
| POST | `/find_products` | L141 |
| POST | `/resolve_product` | L150 |
| POST | `/product_price` | L182 |
| POST | `/check_availability` | L201 |
| POST | `/calculate_quote` | L223 |
| POST | `/calculate_quote_v2` | L264 |

## `server/routes/marketing.js`

Mount: `/api/marketing` | Count: 6

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/marketing/dashboard/summary` | L26 |
| GET | `/api/marketing/dashboard/competitors` | L54 |
| GET | `/api/marketing/dashboard/alerts` | L85 |
| GET | `/api/marketing/mystery-shopping` | L127 |
| PATCH | `/api/marketing/mystery-shopping/:id/status` | L147 |
| POST | `/api/marketing/etl/run` | L173 |

## `server/routes/mlEtlRun.js`

Mount: `` | Count: 3

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/ml/etl-run` | L85 |
| GET | `/api/ml/etl-run/latest` | L162 |
| GET | `/api/ml/etl-run/:id` | L174 |

## `server/routes/mlSearch.js`

Mount: `` | Count: 1

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/ml/search` | L102 |

## `server/routes/panelin.js`

Mount: `/api/panelin` | Count: 4

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/panelin/health` | L30 |
| GET | `/api/panelin/events` | L36 |
| GET | `/api/panelin/products` | L121 |
| POST | `/api/panelin/_debug/emit` | L126 |

## `server/routes/panelinInternal.js`

Mount: `/api/internal/panelin` | Count: 4

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/internal/panelin/whoami` | L37 |
| GET | `/api/internal/panelin/tools` | L61 |
| GET | `/api/internal/panelin/policies` | L71 |
| POST | `/api/internal/panelin/invoke` | L82 |

## `server/routes/pdf.js`

Mount: `/api/pdf` | Count: 2

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/pdf/generate` | L32 |
| GET | `/api/pdf/metrics` | L156 |

## `server/routes/planInterpret.js`

Mount: `/api` | Count: 1

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/plan/interpret` | L27 |

## `server/routes/proyecto.js`

Mount: `/api` | Count: 1

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/proyecto/status` | L20 |

## `server/routes/quoteDriveArchive.js`

Mount: `/api` | Count: 1

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/quotes/drive-archive` | L63 |

## `server/routes/quoteExport.js`

Mount: `` | Count: 5

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/admin/export` | L186 |
| GET | `/api/me/quotes/:id/export.json` | L239 |
| GET | `/api/me/quotes/:id/export.csv` | L251 |
| GET | `/api/me/quotes/:id/export.pdf` | L280 |
| GET | `/api/me/quotes/:id/export.html` | L305 |

## `server/routes/quotes.js`

Mount: `/api` | Count: 2

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/quotes/counter` | L40 |
| POST | `/api/quotes/counter/next` | L68 |

## `server/routes/shopify.js`

Mount: `` | Count: 9

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/auth/shopify` | L152 |
| GET | `/auth/shopify/callback` | L182 |
| POST | `/webhooks/shopify` | L238 |
| GET | `/api/shopify/products` | L284 |
| GET | `/api/shopify/catalog/full` | L386 |
| GET | `/admin/questions` | L505 |
| POST | `/admin/answer` | L528 |
| POST | `/admin/auto-config` | L560 |
| GET | `/admin/auto-config` | L575 |

## `server/routes/superAgent.js`

Mount: `/api/agent` | Count: 1

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/api/agent/quote-lead` | L140 |

## `server/routes/tasks.js`

Mount: `/api/tasks` | Count: 9

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/tasks/lists` | L69 |
| GET | `/api/tasks/lists/:id` | L88 |
| GET | `/api/tasks/lists/:id/tasks` | L113 |
| GET | `/api/tasks/lists/:id/tasks/:taskId` | L160 |
| POST | `/api/tasks/lists` | L333 |
| DELETE | `/api/tasks/lists/:id` | L361 |
| POST | `/api/tasks/lists/:id/tasks` | L399 |
| PATCH | `/api/tasks/lists/:id/tasks/:taskId` | L461 |
| DELETE | `/api/tasks/lists/:id/tasks/:taskId` | L591 |

## `server/routes/tasksOAuth.js`

Mount: `/auth/tasks` | Count: 4

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/auth/tasks/init` | L58 |
| GET | `/auth/tasks/callback` | L116 |
| GET | `/auth/tasks/scope-probe` | L284 |
| POST | `/auth/tasks/revoke` | L321 |

## `server/routes/tasksSync.js`

Mount: `/sync` | Count: 1

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/sync/google-tasks/pull` | L498 |

## `server/routes/teamAssist.js`

Mount: `/api/team-assist` | Count: 3

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/team-assist/health` | L124 |
| GET | `/api/team-assist/agents` | L137 |
| POST | `/api/team-assist/chat` | L141 |

## `server/routes/traktime.js`

Mount: `` | Count: 33

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/traktime/health` | L58 |
| GET | `/api/traktime/me` | L73 |
| GET | `/api/traktime/clients` | L108 |
| POST | `/api/traktime/clients` | L122 |
| PATCH | `/api/traktime/clients/:id` | L150 |
| GET | `/api/traktime/projects` | L188 |
| POST | `/api/traktime/projects` | L210 |
| PATCH | `/api/traktime/projects/:id` | L251 |
| GET | `/api/traktime/projects/:id/members` | L307 |
| POST | `/api/traktime/projects/:id/members` | L325 |
| DELETE | `/api/traktime/projects/:id/members/:userId` | L358 |
| GET | `/api/traktime/tasks` | L380 |
| POST | `/api/traktime/tasks` | L400 |
| GET | `/api/traktime/tags` | L433 |
| POST | `/api/traktime/tags` | L443 |
| GET | `/api/traktime/reports/billable` | L465 |
| GET | `/api/traktime/invoices` | L523 |
| POST | `/api/traktime/invoices/draft` | L550 |
| POST | `/api/traktime/invoices/:id/issue` | L678 |
| POST | `/api/traktime/invoices/:id/mark-paid` | L802 |
| POST | `/api/traktime/invoices/:id/void` | L830 |
| GET | `/api/traktime/invoices/:id/pdf` | L873 |
| POST | `/api/traktime/admin/mirror-now` | L889 |
| GET | `/api/traktime/timer/current` | L910 |
| POST | `/api/traktime/timer/start` | L926 |
| POST | `/api/traktime/timer/stop` | L973 |
| GET | `/api/traktime/entries` | L997 |
| POST | `/api/traktime/entries` | L1040 |
| PATCH | `/api/traktime/entries/:id` | L1092 |
| DELETE | `/api/traktime/entries/:id` | L1159 |
| GET | `/api/traktime/reports/summary` | L1190 |
| GET | `/api/traktime/day-report` | L1288 |
| GET | `/api/traktime/month-report` | L1335 |

## `server/routes/transportista.js`

Mount: `/api` | Count: 14

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/transportista/health` | L77 |
| POST | `/api/trips` | L95 |
| POST | `/api/trips/:trip_id/confirm` | L109 |
| POST | `/api/trips/:trip_id/assign` | L181 |
| POST | `/api/trips/:trip_id/driver-link/regenerate` | L312 |
| GET | `/api/trips/:trip_id/timeline` | L405 |
| GET | `/api/trips/:trip_id/state` | L421 |
| POST | `/api/trips/:trip_id/close` | L437 |
| GET | `/api/driver/trips` | L478 |
| GET | `/api/driver/trips/:trip_id` | L489 |
| POST | `/api/driver/events` | L508 |
| POST | `/api/driver/evidence/upload-url` | L570 |
| POST | `/api/driver/evidence/commit` | L608 |
| POST | `/api/driver/evidence/upload-b64` | L641 |

## `server/routes/wa.js`

Mount: `/api` | Count: 37

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/wa/config` | L198 |
| PATCH | `/api/wa/settings` | L211 |
| PATCH | `/api/wa/flags/:key` | L240 |
| POST | `/api/wa/settings/test-ai` | L261 |
| GET | `/api/wa/operators` | L284 |
| POST | `/api/wa/operators/invite` | L300 |
| DELETE | `/api/wa/operators/:id/sessions` | L320 |
| GET | `/api/wa/rules` | L336 |
| POST | `/api/wa/rules/preview` | L346 |
| GET | `/api/wa/webhooks` | L358 |
| POST | `/api/wa/webhooks/:id/test` | L368 |
| GET | `/api/wa/audit-log` | L383 |
| POST | `/api/wa/auth/request-magic-link` | L398 |
| GET | `/api/wa/auth/verify` | L417 |
| POST | `/api/wa/auth/verify` | L436 |
| POST | `/api/wa/auth/refresh` | L453 |
| POST | `/api/wa/auth/logout` | L470 |
| GET | `/api/wa/config/extension` | L489 |
| GET | `/api/wa/health` | L508 |
| POST | `/api/wa/ingest` | L534 |
| GET | `/api/wa/conversations` | L660 |
| GET | `/api/wa/messages` | L712 |
| GET | `/api/wa/suggestions` | L757 |
| POST | `/api/wa/suggestions/:id/chosen` | L786 |
| GET | `/api/wa/quotes` | L836 |
| POST | `/api/wa/quotes/run` | L858 |
| POST | `/api/wa/conversations/:chat_id/upsert-lead` | L888 |
| GET | `/api/wa/followups` | L941 |
| POST | `/api/wa/followups` | L971 |
| PATCH | `/api/wa/followups/:id` | L994 |
| POST | `/api/wa/conversations/:chat_id/consent` | L1019 |
| POST | `/api/wa/outbound` | L1045 |
| POST | `/api/wa/outbound/:msg_id/confirm` | L1169 |
| POST | `/api/wa/suggestions/run` | L1192 |
| POST | `/api/wa/heartbeat` | L1243 |
| GET | `/api/wa/operators` | L1268 |
| GET | `/api/wa/metrics` | L1284 |

## `server/routes/webhooks.js`

Mount: `NOT_MOUNTED` | Count: 3

| Method | Full path | Line |
|--------|-----------|------|
| POST | `/ml` | L14 |
| GET | `/whatsapp` | L52 |
| POST | `/whatsapp` | L64 |

## `server/routes/wolfboard.js`

Mount: `/api/wolfboard` | Count: 7

| Method | Full path | Line |
|--------|-----------|------|
| GET | `/api/wolfboard/pendientes` | L356 |
| POST | `/sync` | L394 |
| POST | `/api/wolfboard/row` | L475 |
| POST | `/api/wolfboard/row-create` | L570 |
| POST | `/api/wolfboard/enviados` | L631 |
| GET | `/api/wolfboard/export` | L715 |
| POST | `/api/wolfboard/quote-batch` | L755 |

