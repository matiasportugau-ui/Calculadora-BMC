# INVENTARIO CRUDO — Parte 2

**Fecha:** 2026-04-23
**Nota:** listado de TODAS las fuentes referenciadas, sin filtrar por importancia. IDs y rutas son las que aparecen en archivos git-tracked del repo `calculadora-bmc` (y reporte de MCP/GitHub). Estado en vivo de cada fuente no se puede verificar sin `gcloud`, Drive API o acceso a los otros repos — ver `gaps.md`.

---

## Dominio 1 — Cotizaciones

| Fuente | Tipo | Ubicación / ID | Última mod. visible | Rol aparente | Etiqueta |
|---|---|---|---|---|---|
| BMC crm_automatizado · tab CRM_Operativo | Google Sheet tab | `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg` | ? (no gcloud/drive) | Master cotizaciones (schema activo) | inferencia |
| BMC crm_automatizado · tab Master_Cotizaciones | Google Sheet tab | mismo ID, tab distinto | ? | Schema alt (activado por `BMC_SHEET_SCHEMA`) | inferencia |
| 2.0 – Administrador de Cotizaciones | Google Sheet | `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` | ? | Fuente para tab `Admin_Cotizaciones` (integración manual) | inferencia |
| `server/routes/calc.js` | Código | repo local · 888+ líneas | commit `1118dfd` | Endpoints `/calc/cotizar`, `/calc/cotizar/pdf`, `/calc/catalogo`, `/calc/escenarios`, `/calc/informe` | hecho confirmado |
| `server/routes/legacyQuote.js` | Código | repo local | commit `1118dfd` | GPT Actions legacy: `/calculate_quote`, `/find_products`, `/resolve_product`, `/product_price`, `/check_availability` (requiere `API_AUTH_TOKEN`) | hecho confirmado |
| `server/routes/agentChat.js` | Código | repo local | commit `1118dfd` | `POST /api/agent/chat` con action `buildQuote` (compositer) | hecho confirmado |
| `server/lib/quotePayloadValidator.js` | Código | repo local | commit `1118dfd` | Validador de payloads buildQuote + ejecución sincrónica | hecho confirmado |
| `api/cotizar.js` | Código (Vercel serverless) | repo local · `/api/` | commit `1118dfd` | Stub serverless para Vercel (alternativa a Cloud Run) | hecho confirmado |
| `app/api/chat/route.ts` | Código (Next.js route) | repo local · `/app/api/chat/` | commit `1118dfd` | Stub TypeScript para futuro Next.js / Vercel | hecho confirmado |
| `docs/google-sheets-module/INTEGRACION-ADMIN-COTIZACIONES.md` | Doc | repo local | commit `1118dfd` | Procedimiento para integrar Admin_Cotizaciones | hecho confirmado |

---

## Dominio 2 — CRM

| Fuente | Tipo | Ubicación / ID | Última mod. visible | Rol aparente | Etiqueta |
|---|---|---|---|---|---|
| BMC crm_automatizado · tab CRM_Operativo | Google Sheet tab | `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg` | ? | Master CRM (schema activo) — mapeo 9 columnas canónicas | inferencia |
| AUDIT_LOG tab | Google Sheet tab | mismo workbook | ? | Auditoría mutaciones (fechas, old/new, reason, user) | inferencia |
| Extensión Chrome **OmniCRM Sync** | Código externo | **no en este repo** — referenciada en 10+ docs | ? | Sync ML → Sheets CRM | duda abierta |
| `server/routes/bmcDashboard.js` líneas 2384–2752 | Código | repo local | commit `1118dfd` | 13 endpoints cockpit `/crm/*` (token, row, quote-link, approval, mark-sent, send-approved, ml-queue, wa-queue, sync-ml) | hecho confirmado |
| `server/lib/crmOperativoLayout.js` | Código | repo local | commit `1118dfd` | Layout AHAK (col A→AK) | hecho confirmado |
| `server/lib/crmRowParse.js` | Código | repo local | commit `1118dfd` | Parser de filas CRM | hecho confirmado |
| `server/ml-crm-sync.js` | Código | repo local | commit `1118dfd` | Sync incoming ML → CRM | hecho confirmado |
| `docs/google-sheets-module/VARIABLES-Y-MAPEO-UNO-A-UNO.md` | Doc | repo local | commit `1118dfd` | Mapeo canónico variable ↔ columna | hecho confirmado |
| `docs/google-sheets-module/CRM_OPERATIVO_MAPPING.md` | Doc | repo local · bmc-dashboard-modernization | commit `1118dfd` | Mapping CRM_Operativo | hecho confirmado |

---

## Dominio 3 — Precios

| Fuente | Tipo | Ubicación / ID | Última mod. visible | Rol aparente | Etiqueta |
|---|---|---|---|---|---|
| MATRIZ de COSTOS y VENTAS 2026 | Google Sheet | `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo` (default hardcoded en `server/config.js:52`) | ? | Master precios (costo + venta BMC + venta web + unidad + categoría) | inferencia |
| `src/data/constants.js` | Código | repo local · 35KB | commit `1118dfd` | Catálogo local (paneles, listas, perfiles, escenarios) | hecho confirmado |
| `src/data/pricing.js` | Código | repo local · 6.7KB | commit `1118dfd` | Lista de precios default | hecho confirmado |
| `src/data/matrizPreciosMapping.js` | Código | repo local · 10KB | commit `1118dfd` | Mapeo SKU MATRIZ → path calculadora | hecho confirmado |
| `src/components/PricingEditor.jsx` | Código | repo local | commit `1118dfd` | UI para cargar precios desde MATRIZ y escribir overrides | hecho confirmado |
| `src/utils/pricingOverrides.js` | Código | repo local | commit `1118dfd` | Lógica runtime de overrides | hecho confirmado |
| `src/utils/csvPricingImport.js` | Código | repo local | commit `1118dfd` | Parser CSV MATRIZ | hecho confirmado |
| `docs/google-sheets-module/MATRIZ-PRECIOS-CALCULADORA.md` | Doc | repo local | commit `1118dfd` | Procedimiento importación MATRIZ | hecho confirmado |
| `docs/PRICING-ENGINE.md` | Doc | repo local | commit `1118dfd` | Motor de precios | hecho confirmado |
| `scripts/sync-fijaciones-isodec-bromyros.mjs` + `scripts/sync-silicona-300-neutra-bromyros.mjs` | Script | repo local | commit `1118dfd` | Sync de SKUs fijaciones/silicona a MATRIZ (BROMYROS) | hecho confirmado |
| `scripts/matriz-rename-bromyros-headers.mjs` | Script | repo local | commit `1118dfd` | Rename de headers MATRIZ a estándar BROMYROS | hecho confirmado |
| `scripts/pull-matriz-csv.mjs`, `scripts/reconcile-matriz-csv.mjs` | Scripts | repo local | commit `1118dfd` | Pull/reconcile local de MATRIZ | hecho confirmado |

---

## Dominio 4 — Ventas / envíos

| Fuente | Tipo | Ubicación / ID | Última mod. visible | Rol aparente | Etiqueta |
|---|---|---|---|---|---|
| 2.0 – Ventas | Google Sheet | `1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA` | ? | Master ventas (todas las tabs; merge en `/api/ventas`) | inferencia |
| Stock E-Commerce | Google Sheet | `1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw` | ? | Stock + KPI stock + historial (EXISTENCIAS_Y_PEDIDOS, Egresos) | inferencia |
| Postgres (Transportista) | DB | `DATABASE_URL` (Cloud Run env) | ? | Viajes, eventos, sesiones conductor, outbox WhatsApp | duda abierta |
| `server/routes/bmcDashboard.js` líneas 1467–1945 | Código | repo local | commit `1118dfd` | Rutas `/coordinacion-logistica`, `/ventas`, `/ventas/tabs`, `/stock*`, `/marcar-entregado` | hecho confirmado |
| `server/routes/transportista.js` | Código | repo local | commit `1118dfd` | ~14 endpoints Modo Transportista (driver token, evidencias, outbox) | hecho confirmado |
| `server/lib/transportistaDb.js`, `FSM.js`, `Evidence.js`, `OutboxWorker.js` | Código | repo local · `server/lib/` | commit `1118dfd` | Capa Postgres + FSM + GCS evidencias + outbox worker | hecho confirmado |
| `transportista-cursor-package/migrations/` | Migrations | repo local | commit `1118dfd` | SQL migrations transportista | hecho confirmado |
| `src/components/BmcLogisticaApp.jsx`, `logistica/*`, `DriverTransportistaApp.jsx` | Código | repo local · `src/components` | commit `1118dfd` | UI logística y driver | hecho confirmado |
| `docs/bmc-dashboard-modernization/logistica-carga-prototype/` | Doc + prototype | repo local | commit `1118dfd` | Prototype logística carga | hecho confirmado |

---

## Dominio 5 — Pagos / fiscal

| Fuente | Tipo | Ubicación / ID | Última mod. visible | Rol aparente | Etiqueta |
|---|---|---|---|---|---|
| Pagos Pendientes 2026 | Google Sheet | `1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI` · tab **`Pendientes_`** (real) + `Metas_Ventas` (opcional) | ? | Master saldos por pagar; KPI financiero | inferencia |
| Calendario vencimientos | Google Sheet | `1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk` · tabs mensuales | ? | Vencimientos por mes | inferencia |
| `server/routes/bmcDashboard.js` líneas 1486–1950 | Código | repo local | commit `1118dfd` | `/audit`, `/pagos-pendientes`, `/metas-ventas`, `/calendario-vencimientos`, `/kpi-financiero`, `/kpi-report`, `POST /pagos`, `PATCH /pagos/:id` | hecho confirmado |
| `docs/billing/CHECKLIST-CIERRE-MENSUAL.md` | Doc | repo local | commit `1118dfd` | Cierre mensual | hecho confirmado |
| `docs/billing/FORMATO-EXPORT-FACTURACION.md` | Doc | repo local | commit `1118dfd` | Formato export facturación | hecho confirmado |
| `docs/billing/REGLAS-NEGOCIO-FACTURACION.md` | Doc | repo local | commit `1118dfd` | Reglas negocio facturación | hecho confirmado |
| `docs/team/fiscal/CONTEXTO-FISCAL-DASHBOARD.md` | Doc | repo local | commit `1118dfd` | Contexto fiscal dashboard | hecho confirmado |
| `docs/team/fiscal/DGI-CLAUDE-INGESTA.md` | Doc | repo local | commit `1118dfd` | Ingesta DGI | hecho confirmado |
| `docs/team/fiscal/DGI-DEFENSA-EQUIPO-Y-SISTEMA-METALOG.md` | Doc | repo local | commit `1118dfd` | Defensa Art. 46 (ref. contexto inicial) | hecho confirmado |
| `docs/team/fiscal/FISCAL-PROTOCOL-STATE-RANKING.md` | Doc | repo local | commit `1118dfd` | State ranking fiscal | hecho confirmado |
| `docs/team/fiscal/LOG-INCUMPLIMIENTOS-RESUELTOS.md` | Doc | repo local | commit `1118dfd` | Log incumplimientos | hecho confirmado |

---

## Dominio 6 — Calculadora (código)

| Fuente | Tipo | Ubicación | Última mod. visible | Rol aparente | Etiqueta |
|---|---|---|---|---|---|
| `matiasportugau-ui/calculadora-bmc` | Repo GitHub | MCP accesible | Commit main `1118dfd` (2026-04-22T10:09Z) | **Master del código calculadora + API** | hecho confirmado |
| `src/components/PanelinCalculadoraV3_backup.jsx` | Componente principal | repo local | commit `1118dfd` | Calculadora V3 (canónico; el archivo `PanelinCalculadoraV3.jsx` re-exporta de éste) | hecho confirmado |
| `src/utils/calculations.js` · 60KB | Código | repo local | commit `1118dfd` | Cálculos core (techo, pared, cámara, BOM, totales) | hecho confirmado |
| `src/utils/helpers.js` · 42KB | Código | repo local | commit `1118dfd` | Helpers compartidos | hecho confirmado |
| `src/data/constants.js` · 35KB | Código | repo local | commit `1118dfd` | Constantes (paneles, listas, fijaciones, siliconas) | hecho confirmado |
| Branch `claude/bmc-production-audit-3Pjos` (esta sesión) | Rama | `matiasportugau-ui/calculadora-bmc` | 2026-04-23 | Rama designada para este relevamiento | hecho confirmado |
| 20 PRs open + 84 ramas totales | Git | MCP | varias | Deuda de integración | hecho confirmado |
| Repos hermanos referenciados (en .env.example + docs): `GPT-Panelin-Calc`, `bmc-dashboard-2.0`, `bmc-development-team`, `conexion-cuentas-email-agentes-bmc`, `Calculadora-BMC-GPT`, `GPT-PANELIN-V3.2`, `aistudioPAnelin`, `2026_Mono_rep`, `ChatBOT`, `Chatbot-Truth-base--Creation`, `bmc-cotizacion-inteligente`, `chatbot-2311` | Repos externos | NO accesibles desde este entorno | ? | **duda abierta** — no puedo confirmar estado real | duda abierta |

---

## Dominio 7 — Dashboards / KPIs

| Fuente | Tipo | Ubicación | Última mod. visible | Rol aparente | Etiqueta |
|---|---|---|---|---|---|
| `server/routes/bmcDashboard.js` · 110KB / 2781 líneas | Código API | repo local | commit `1118dfd` | **Backend canónico** del dashboard — todas las rutas `/api/*` dashboard | hecho confirmado |
| `src/components/` (BmcDashboard*, KpiReport*, BmcWolfboardHub) | Código UI | repo local | commit `1118dfd` | UI dashboard (frontend) | hecho confirmado |
| `docs/bmc-dashboard-modernization/Code.gs` | Apps Script | repo local (referencia) | commit `1118dfd` | Apps Script bound to workbook CRM | hecho confirmado (repo) / duda abierta (prod) |
| `docs/bmc-dashboard-modernization/CalendarioRecordatorio.gs` | Apps Script | repo local | commit `1118dfd` | Recordatorios calendario | hecho confirmado (repo) / duda abierta (prod) |
| `docs/bmc-dashboard-modernization/PagosPendientes.gs` | Apps Script | repo local | commit `1118dfd` | Triggers onEdit Pagos Pendientes | hecho confirmado (repo) / duda abierta (prod) |
| `docs/bmc-dashboard-modernization/StockAlertas.gs` | Apps Script | repo local | commit `1118dfd` | Alertas stock | hecho confirmado (repo) / duda abierta (prod) |
| `docs/bmc-dashboard-modernization/VentasConsolidar.gs` | Apps Script | repo local | commit `1118dfd` | Consolidador ventas | hecho confirmado (repo) / duda abierta (prod) |
| `docs 2/bmc-dashboard-modernization/Code.gs` | **Copia duplicada** | repo local · `docs 2/` | commit `1118dfd` | Copia — ver `conflictos.md` | hecho confirmado |
| `docs.zip` (133KB) | **Copia archivada de docs/** | repo local raíz | commit `1118dfd` | Snapshot, legacy | hecho confirmado |

---

## Dominio 8 — Automatizaciones / infra

| Fuente | Tipo | Ubicación | Última mod. visible | Rol aparente | Etiqueta |
|---|---|---|---|---|---|
| `.github/workflows/deploy-calc-api.yml` | CI/CD | repo local | commit `1118dfd` | Deploy API Cloud Run `panelin-calc` (via Artifact Registry) | hecho confirmado |
| `.github/workflows/deploy-frontend.yml` | CI/CD | repo local | commit `1118dfd` | Deploy frontend nginx Cloud Run `panelin-calc-web` (via Artifact Registry) | hecho confirmado |
| `.github/workflows/ci.yml` | CI | repo local | commit `1118dfd` | Lint + tests + build + channels_pipeline smoke prod | hecho confirmado |
| `.github/workflows/dev-trace.yml` | CI | repo local | commit `1118dfd` | Dev trace | hecho confirmado |
| `.github/workflows/drive-oauth-verify.yml` + `drive-oauth-dist-verify.yml` | CI | repo local | commit `1118dfd` | Verificación OAuth Google Drive | hecho confirmado |
| `.github/workflows/knowledge-antenna-reusable.yml` + `knowledge-antenna-scheduled.yml` | CI | repo local | commit `1118dfd` | Knowledge antenna scheduler (cron) | hecho confirmado |
| `cloudbuild.yaml` + `Dockerfile.bmc-dashboard` | Alt deploy model | repo local | commit `1118dfd` | Cloud Build (GCR) del full-stack — **COMPITE con workflows** | hecho confirmado |
| `cloudbuild-api.yaml` | Alt deploy model | repo local | commit `1118dfd` | Cloud Build a Artifact Registry (solo API) | hecho confirmado |
| `cloudbuild-frontend.yaml` | Alt deploy model | repo local | commit `1118dfd` | Cloud Build a Artifact Registry (solo frontend) | hecho confirmado |
| `scripts/deploy-cloud-run.sh` | Script deploy manual | repo local | commit `1118dfd` | Wrapper manual | hecho confirmado |
| `scripts/deploy-vercel.sh` | Script deploy | repo local | commit `1118dfd` | Deploy Vercel | hecho confirmado |
| `scripts/install-knowledge-antenna-schedule.sh`, `install-magazine-daily-schedule.sh`, `install-session-artifact-schedule.sh` | Scheduler | repo local · macOS launchagents | commit `1118dfd` | Schedulers locales (host) | hecho confirmado |
| `scripts/drive-cleanup-launchd.plist` | Launchagent | repo local | commit `1118dfd` | Cleanup Drive horario | hecho confirmado |
| `shop-chat-agent/` | Sub-aplicación | repo local | commit `1118dfd` | Shopify chat agent (Remix, Prisma, Dockerfile propio) | hecho confirmado |
| `POST /webhooks/ml` (server/index.js:383) | Webhook | repo local | commit `1118dfd` | Webhook MercadoLibre | hecho confirmado |
| `POST /webhooks/whatsapp` + `GET /webhooks/whatsapp` | Webhook | server/index.js:437, 582 | commit `1118dfd` | Webhook Meta/WhatsApp (HMAC via `WHATSAPP_APP_SECRET`) | hecho confirmado |
| `POST /webhooks/shopify` | Webhook | server/routes/shopify.js:244 | commit `1118dfd` | Webhook Shopify (raw body) | hecho confirmado |
| Postgres (Transportista) | DB | Cloud Run env `DATABASE_URL` | ? | Viajes, eventos, outbox WhatsApp | duda abierta |
| GCS bucket (Transportista evidencias) | Storage | env `TRANSPORTISTA_GCS_BUCKET` (opcional) | ? | Evidencias firmadas | duda abierta |
| GCS bucket (ML tokens) | Storage | env `ML_TOKEN_GCS_BUCKET` + `ML_TOKEN_GCS_OBJECT=ml-tokens.enc` | ? | Persistencia OAuth ML en Cloud Run | duda abierta |
| Extensión Chrome OmniCRM Sync | Externo | no en repo | ? | ML → Sheets CRM sync | duda abierta |
