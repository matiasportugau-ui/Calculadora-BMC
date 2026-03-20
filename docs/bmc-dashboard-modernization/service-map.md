# BMC Dashboard — Service Map

**Propósito:** Inventario de servicios, entry points, contratos y health checks. Fuente: server/, DASHBOARD-INTERFACE-MAP, planilla-inventory.

---

## 1. Service inventory

| Servicio | Tipo | Entry point | Contract (key) | Health / check | Owner |
|----------|------|-------------|----------------|----------------|-------|
| **API Express (main)** | Backend | http://localhost:3001 | REST /api/*, /calc, /health | GET /health | Shell & Infra |
| **Cloud Run (panelin-calc)** | Producción | https://panelin-calc-*-uc.a.run.app | /calculadora, /finanzas, /api/*, /calc | GET /health | Shell & Infra |
| **Vercel** | Alternativa | (opcional) | Frontend + serverless | — | Shell & Infra |
| **Vite Calculadora** | Frontend | http://localhost:5173 | Quote builder, Drive, Budget Log | — | Cotizaciones |
| **Dashboard Finanzas/Operaciones** | Frontend | http://localhost:3001/finanzas, 3849 | HTML + fetch /api/* | — | Finanzas, Operaciones |
| **bmcDashboard router** | API | /api/cotizaciones, proximas-entregas, kpi-financiero, pagos-pendientes, metas-ventas, audit, marcar-entregado, coordinacion-logistica | GET/POST según ruta | 503 si Sheets no config | Operaciones, Finanzas |
| **Sheets API** | Integration | Via bmcDashboard.js | values.get, values.append, batchUpdate | hasSheets en /health | All |
| **ngrok** | Infra | Optional tunnel (4040) | OAuth redirect | — | Shell & Infra |
| **sheets-api-server (3849)** | Backend standalone | http://localhost:3849 | Dashboard + API propio | — | Shell |
| **legacyQuote** | API | /api/legacy/* | Quote legacy | — | Cotizaciones |
| **calc** | API | /api/calc/* | Cálculos | — | Cotizaciones |
| **actualizar-precios-calculadora** | API | GET /api/actualizar-precios-calculadora | MATRIZ Costos 2026 → CSV (path, costo, venta_bmc_local, venta_web) | — | Cotizaciones |
| **ConfigPanel (Calculadora)** | UI | Config → Precios, Fórmulas | PricingEditor (costos editables, Cargar desde MATRIZ, download/upload); DimensioningFormulasEditor (fórmulas dimensionamiento download/upload) | — | Cotizaciones |
| **Shopify** | API | /api/shopify/*, /webhooks/shopify | OAuth, webhooks | — | Integraciones |
| **Apps Script** | Automation | Code.gs, DialogEntregas, triggers | doGet/doPost, Sheets append, cron | — | Sheets Structure |

---

## 2. Rutas API (bmcDashboard)

| Ruta | Método | Fuente Sheet | Respuesta |
|------|--------|--------------|-----------|
| /api/cotizaciones | GET | CRM_Operativo o Master_Cotizaciones | Array cotizaciones |
| /api/proximas-entregas | GET | Idem | Entregas semana actual |
| /api/coordinacion-logistica | GET | Idem | Texto WhatsApp |
| /api/kpi-financiero | GET | Pagos_Pendientes, Metas_Ventas | byCurrency, calendar, pendingPayments |
| /api/pagos-pendientes | GET | Pagos_Pendientes | Array pagos |
| /api/metas-ventas | GET | Metas_Ventas | Array metas |
| /api/audit | GET | AUDIT_LOG | Array audit |
| /api/marcar-entregado | POST | Master_Cotizaciones → Ventas realizadas | { ok, cotizacionId } |
| /api/kpi-report | GET | kpi-financiero, proximas-entregas, stock-kpi, metas-ventas, ventas | totalPendiente, estaSemana, entregasEstaSemana, bajoStock, equilibrio ✓ |
| Admin_Cotizaciones (tab) | — | Script npm run integrate-admin-cotizaciones | Origen: 2.0 Admin Cotizaciones (1Ie0KCpg...); destino: BMC crm_automatizado. No expuesta por API aún. |

---

## 3. Puertos y comandos

| Puerto | Comando | Rol |
|--------|---------|-----|
| 3001 | npm run start:api, npm run dev:full | API + Dashboard canónico |
| 3849 | npm run bmc-dashboard | Dashboard standalone |
| 5173 | npm run dev | Calculadora React |
| 4040 | ngrok (OAuth) | Tunnel opcional |

---

## 4. Integration checklist

| From | To | Integration | Status |
|------|-----|-------------|--------|
| Shell nav | Cotizaciones | Link a 5173 | OK |
| Dashboard #invoque | Panelin Evolution | Link a localhost:3847 | OK |
| Shell | Operaciones / Finanzas | Anchors #operaciones, #finanzas | OK |
| bmcDashboard | Sheets | BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS | OK (verificar .env) |
| Operaciones | Finanzas | Shared Sheets, UI blocks | OK |
| marcar-entregado | Ventas sheet | Append row, delete from Master | OK (solo schema Master) |
| Dashboard | KPI/Finanzas | Pagos_Pendientes, Metas_Ventas | conditional (degración si faltan) |

---

## 5. Deploy flow

| Paso | Comando / Acción |
|------|------------------|
| Build | `./scripts/deploy-cloud-run.sh` (Cloud Build) o `--local-docker` |
| Image | `gcr.io/$PROJECT_ID/panelin-calc` |
| Deploy | `gcloud run deploy panelin-calc --image ... --region us-central1` |
| URL | `gcloud run services describe panelin-calc --region=us-central1 --format='value(status.url)'` |

**Cloud Run URL:** Calculadora: `<URL>/calculadora` | Dashboard: `<URL>/finanzas` | API: `<URL>/calc`

**Dockerfile:** Dockerfile.bmc-dashboard (easymidi --ignore-scripts, .dockerignore optimizado)

---

**Última actualización:** 2026-03-20 (run22; full team propagate & sync — revisión inventario, sin cambio rutas)
**Handoff:** Usar con dependencies.md para validar integración end-to-end.
