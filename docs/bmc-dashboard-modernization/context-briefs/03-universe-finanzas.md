# Universe brief: Finanzas

**Source:** IA report, DASHBOARD-VISUAL-MAP, DASHBOARD-EVALUATION-REPORT, bmcDashboard.js.

---

## Scope

- **From docs/code:** Financial visibility: (1) **KPIs financieros** — calendar view, pagos pendientes, metas de ventas; (2) **Pagos pendientes** — from Pagos_Pendientes sheet; (3) **Metas de ventas** — from Metas_Ventas sheet; (4) Exportar CSV, Filtrar. Same static app at 3001/finanzas also hosts Operaciones (entregas, logística, audit).
- **Directly observed:** GET /api/kpi-financiero, /api/pagos-pendientes, /api/metas-ventas. bmcDashboard.js builds KPI aggregates (resumen por período, byCurrency, estaSemana, esteMes, etc.).

## Data

- **Sheets:** Pagos_Pendientes, Metas_Ventas (and Master/CRM for cotizaciones used in same UI). AUDIT_LOG for audit block.
- **Env:** BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS, BMC_SHEET_SCHEMA (Master_Cotizaciones schema for BMC).
- **Variables (evaluation report):** Pagos_Pendientes → /api/pagos-pendientes, /api/kpi-financiero; Metas_Ventas → /api/metas-ventas, /api/kpi-financiero.

## Tech

- **Entry:** http://localhost:3001/finanzas (static dashboard). Served by Express from `docs/bmc-dashboard-modernization/dashboard/`.
- **Stack:** Static HTML/JS/CSS; API calls to /api/*. Evaluation notes: loading states, error banner, “Reintentar,” lastRefresh implemented.
- **Key files:** `server/routes/bmcDashboard.js` (kpi-financiero, pagos-pendientes, metas-ventas); dashboard front in docs/bmc-dashboard-modernization/dashboard/.

## Users / personas

- **Inferred:** Finance or management viewing cash flow, pending payments, sales targets. Not explicitly documented.

## Current pain points

- **From evaluation:** Without service account, KPI/pagos/metas can 503 or return empty; with Sheets OK, 200 and full structure. Dashboard error UI (banner, retry) present.
- **From IA report:** “KPI” as planned section vs “Finanzas” — overlap; Finanzas UI already contains “KPIs financieros.” Need to treat KPI as sub-area of Finanzas to avoid duplication.

## Dependencies

- **On Operaciones:** Same app and entry; shared Sheets credentials.
- **On Shell:** Nav item “Finanzas” (and optionally “KPI” as sub or alias) pointing to /finanzas or a Finanzas sub-route.
- **On Ventas:** Metas_Ventas and “Ventas realizadas y entregadas” are sales-related; boundary between Finanzas (metrics) and Ventas (pipeline) TBD.

## Uncertainties

- Whether KPI should be a separate nav item or always under Finanzas. Exact scope of “Ventas 2.0” vs Finanzas (metas vs pipeline).
