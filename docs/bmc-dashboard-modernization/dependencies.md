# BMC Dashboard — Dependency Graph

**Propósito:** Mapeo de dependencias por módulo. Fuente: planilla-inventory, DASHBOARD-INTERFACE-MAP, bmcDashboard.js, server/index.js.

---

## 1. Dependency graph (por módulo)

| Módulo | Depends on (env) | Depends on (APIs/Sheets) | Depends on (otros módulos) | Gaps |
|--------|-------------------|---------------------------|----------------------------|------|
| **Cotizaciones** | VITE_API_URL, VITE_GOOGLE_CLIENT_ID | /api/cotizaciones, Sheets Master/CRM, Google Drive | Shell (nav link) | — |
| **Operaciones** | — | bmcDashboard routes, CRM_Operativo o Master_Cotizaciones | Shell, Finanzas (UI) | — |
| **Finanzas** | — | bmcDashboard routes, Pagos_Pendientes, Metas_Ventas | Shell | Pagos_Pendientes, Metas_Ventas conditional; degrada si faltan |
| **Ventas** | BMC_VENTAS_SHEET_ID | GET /api/ventas, 2.0 - Ventas (1KFNKWLQmBHj...) | Shell | API activa; mapper COSTO/GANANCIA |
| **Invoque Panelin** | — | GPT/OpenAI, Panelin Evolution 3847 | All (transversal) | Link #invoque → localhost:3847 ✓ |
| **Shell & Infra** | BMC_SHEET_ID, BMC_SHEET_SCHEMA, GOOGLE_APPLICATION_CREDENTIALS | 3001, 5173, 3849, ngrok | All | — |
| **Admin Cotizaciones (sync)** | GOOGLE_APPLICATION_CREDENTIALS, BMC_SHEET_ID, opcional BMC_ADMIN_COTIZACIONES_SOURCE_ID | Workbook origen 1Ie0KCpg... (2.0 Admin Cotizaciones) → tab Admin_Cotizaciones en principal | Script integrate-admin-cotizaciones.js | Tab conditional; no consumida por API dashboard aún. Ver INTEGRACION-ADMIN-COTIZACIONES.md |

---

## 2. Dependencias por servicio

| Servicio | Env requerido | APIs/Sheets | Otros |
|----------|----------------|-------------|-------|
| **bmcDashboard.js** | BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS, BMC_SHEET_SCHEMA | Sheets API (values.get, values.append, batchUpdate) | config.js |
| **Calculadora (5173)** | VITE_API_URL, VITE_GOOGLE_CLIENT_ID, BMC_MATRIZ_SHEET_ID | /api/calc, /api/actualizar-precios-calculadora, Google Drive, MATRIZ Costos 2026 | — |
| **Dashboard 3001** | — | /api/* (bmcDashboard) | Express static |
| **Dashboard 3849** | BMC_SHEET_ID, creds | sheets-api-server.js (propio) | Schema fijo Master |
| **Shopify** | SHOPIFY_* | Firestore, webhooks | tokenStore |
| **MercadoLibre** | ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REDIRECT_* | OAuth, tokenStore | — |

---

## 3. Gaps y riesgos

| Gap | Módulo | Mitigación |
|-----|--------|------------|
| Pagos_Pendientes, Metas_Ventas pueden no existir | Finanzas | API degrada limpio; tab real "Pendientes_" (ver MAPPING-VALIDATION) |
| Ventas 2.0 API | Ventas | ✅ Implementado; lee solo 1 de 23 tabs; Phase 1: iterar todos |
| Calendario | Finanzas | Lee 1 de 46 tabs; Phase 1: ?month= para tab mensual |
| Stock | Stock | Lee 1 de 7 tabs; Phase 1: /api/stock/history (EXISTENCIAS, Egresos) |
| Invoque Panelin link | Invoque | ✓ Link #invoque → 3847; transversal entry points futuros |
| 3849 vs 3001 duplicación | Shell | 3001 canónico |

---

## 4. Full Sheets Audit (2026-03-16)

5 workbooks, 83 tabs, ~200+ columnas. Ver FULL-SHEETS-AUDIT-REPORT.md, MAPPING-VALIDATION-AUDIT-VS-INVENTORY.md. STRATEGIC-REVIEW Phase 1–2: mejorar GET (Ventas, Calendario, Stock), añadir PUSH (cotizaciones, pagos, ventas, stock).

---

## 5. Deploy flow (2026-03-19 run18)

| Paso | Herramienta | Comando / Acción |
|------|-------------|------------------|
| Build | Cloud Build o Docker local | `./scripts/deploy-cloud-run.sh` (Cloud Build) o `--local-docker` |
| Push | gcr.io | `gcr.io/$PROJECT_ID/panelin-calc` |
| Deploy | Cloud Run | `gcloud run deploy panelin-calc --image ... --region us-central1` |
| URL | Cloud Run | `gcloud run services describe panelin-calc --region=us-central1 --format='value(status.url)'` |

**Alternativas:** Vercel (frontend + serverless), VPS Netuy (PM2). Ver REPORT-SOLUTION-CODING run17/run18.

---

**Última actualización:** 2026-03-19 (run18; deploy completado)  
**Handoff:** Usar con service-map.md, IMPLEMENTATION-PLAN-SOLUTION-CODING.md (Phase 1–2), INTEGRACION-ADMIN-COTIZACIONES.md, MATRIZ-PRECIOS-CALCULADORA.md.
