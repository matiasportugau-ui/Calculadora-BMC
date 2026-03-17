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
| **Invoque Panelin** | — | GPT/OpenAI, future hooks | All (transversal) | Placeholder |
| **Shell & Infra** | BMC_SHEET_ID, BMC_SHEET_SCHEMA, GOOGLE_APPLICATION_CREDENTIALS | 3001, 5173, 3849, ngrok | All | — |

---

## 2. Dependencias por servicio

| Servicio | Env requerido | APIs/Sheets | Otros |
|----------|----------------|-------------|-------|
| **bmcDashboard.js** | BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS, BMC_SHEET_SCHEMA | Sheets API (values.get, values.append, batchUpdate) | config.js |
| **Calculadora (5173)** | VITE_API_URL, VITE_GOOGLE_CLIENT_ID | /api/calc, Google Drive | — |
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
| Invoque Panelin placeholder | Invoque | Definir transversal entry points |
| 3849 vs 3001 duplicación | Shell | 3001 canónico |

---

## 4. Full Sheets Audit (2026-03-16)

5 workbooks, 83 tabs, ~200+ columnas. Ver FULL-SHEETS-AUDIT-REPORT.md, MAPPING-VALIDATION-AUDIT-VS-INVENTORY.md. STRATEGIC-REVIEW Phase 1–2: mejorar GET (Ventas, Calendario, Stock), añadir PUSH (cotizaciones, pagos, ventas, stock).

---

**Última actualización:** 2026-03-16  
**Handoff:** Usar con service-map.md, IMPLEMENTATION-PLAN-SOLUTION-CODING.md (Phase 1–2).
