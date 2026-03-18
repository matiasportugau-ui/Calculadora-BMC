# BMC Dashboard — Service Map

**Propósito:** Inventario de servicios, entry points, contratos y health checks. Fuente: server/, DASHBOARD-INTERFACE-MAP, planilla-inventory.

---

## 1. Service inventory

| Servicio | Tipo | Entry point | Contract (key) | Health / check | Owner |
|----------|------|-------------|----------------|----------------|-------|
| **API Express (main)** | Backend | http://localhost:3001 | REST /api/*, /calc, /health | GET /health | Shell & Infra |
| **Vite Calculadora** | Frontend | http://localhost:5173 | Quote builder, Drive, Budget Log | — | Cotizaciones |
| **Dashboard Finanzas/Operaciones** | Frontend | http://localhost:3001/finanzas, 3849 | HTML + fetch /api/* | — | Finanzas, Operaciones |
| **bmcDashboard router** | API | /api/cotizaciones, proximas-entregas, kpi-financiero, pagos-pendientes, metas-ventas, audit, marcar-entregado, coordinacion-logistica | GET/POST según ruta | 503 si Sheets no config | Operaciones, Finanzas |
| **Sheets API** | Integration | Via bmcDashboard.js | values.get, values.append, batchUpdate | hasSheets en /health | All |
| **ngrok** | Infra | Optional tunnel (4040) | OAuth redirect | — | Shell & Infra |
| **sheets-api-server (3849)** | Backend standalone | http://localhost:3849 | Dashboard + API propio | — | Shell |
| **legacyQuote** | API | /api/legacy/* | Quote legacy | — | Cotizaciones |
| **calc** | API | /api/calc/* | Cálculos | — | Cotizaciones |
| **Shopify** | API | /api/shopify/*, /webhooks/shopify | OAuth, webhooks | — | Integraciones |

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
| /api/kpi-report | GET | kpi-financiero, proximas-entregas, stock-kpi, metas-ventas, ventas | totalPendiente, estaSemana, entregasEstaSemana, bajoStock, equilibrio |

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
| Shell | Operaciones / Finanzas | Anchors #operaciones, #finanzas | OK |
| bmcDashboard | Sheets | BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS | OK (verificar .env) |
| Operaciones | Finanzas | Shared Sheets, UI blocks | OK |
| marcar-entregado | Ventas sheet | Append row, delete from Master | OK (solo schema Master) |
| Dashboard | KPI/Finanzas | Pagos_Pendientes, Metas_Ventas | conditional (degración si faltan) |

---

**Última actualización:** 2026-03-17 (run6: full team run; estado vigente)
**Handoff:** Usar con dependencies.md para validar integración end-to-end.
