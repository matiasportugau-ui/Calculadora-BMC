# Universe brief: Operaciones

**Source:** IA report, DASHBOARD-VISUAL-MAP, DASHBOARD-EVALUATION-REPORT, bmcDashboard.js, server/index.js.

---

## Scope

- **From docs/code:** Day-to-day delivery and logistics: (1) **Próximas entregas** — table of confirmados/current-week from Master or CRM; (2) **Coordinación logística** — same rows with WhatsApp blocks to coordinate; (3) **Audit log** — read from AUDIT_LOG sheet; (4) **Marcar entregado** — move row from Master to “Ventas realizadas y entregadas” and delete from Master.
- **Directly observed:** All served by bmcDashboard router under `/api`: GET /api/cotizaciones, /api/proximas-entregas, /api/coordinacion-logistica, /api/audit; POST /api/marcar-entregado. UI is the Finanzas static app at 3001/finanzas (same HTML app shows Operaciones + Finanzas blocks).

## Data

- **Sheets:** Master_Cotizaciones or CRM_Operativo (schema), AUDIT_LOG, “Ventas realizadas y entregadas” (write target for marcar-entregado).
- **Env:** BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS, BMC_SHEET_SCHEMA.
- **Flows:** getProximasEntregas filters by ESTADO + FECHA_ENTREGA this week; handleMarcarEntregado appends to Ventas realizadas and deletes row from Master.

## Tech

- **Entry:** Same as Finanzas: http://localhost:3001/finanzas (static dashboard from `docs/bmc-dashboard-modernization/dashboard/`). No separate Operaciones URL.
- **Stack:** Express static for /finanzas; bmcDashboard.js (Sheets API, CRM_TO_BMC mapping, getSheetData, getProximasEntregas, handleMarcarEntregado).
- **Key files:** `server/routes/bmcDashboard.js`, `server/index.js` (mounts /api and /finanzas), dashboard HTML/JS/CSS in docs/bmc-dashboard-modernization/dashboard/.

## Users / personas

- **Inferred:** Operations/logistics staff checking deliveries, sending WhatsApp, marking delivered. Not explicitly documented.

## Current pain points

- **From evaluation:** Without service account, /api/cotizaciones and /api/proximas-entregas fail (503); Próximas entregas table empty; Coordinación logística WhatsApp buttons disabled when no data.
- **From IA report:** Operaciones and Finanzas share the same “Finanzas” UI and entry; no separate Operaciones section in nav; weak grouping (entregas vs logística vs audit are blocks, not a named “Operaciones” area).

## Dependencies

- **On Cotizaciones (data):** Master_Cotizaciones / CRM_Operativo are the source; marcar-entregado writes to “Ventas realizadas y entregadas” (feeds Ventas universe).
- **On Finanzas:** Same HTML app; KPIs and Operaciones blocks coexist. Shared dependency on Sheets credentials.
- **On Shell:** Needs nav item “Operaciones” (or “Entregas”) that lands on /finanzas with focus on entregas/logística/audit (or a dedicated sub-route if split later).

## Uncertainties

- Whether Operaciones should have its own URL (e.g. /operaciones) or stay under /finanzas with tabs. Whether standalone app (3849) differs from 3001/finanzas.
