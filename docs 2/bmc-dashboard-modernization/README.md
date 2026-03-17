# BMC Uruguay Dashboard Modernization

This folder contains the **deliverables for Phases 1 and 2** (Apps Script + automation), the **Sheets API server** with **integrated dashboard** (Phase 3), and the implementation guide.

## Contents

| File / folder | Description |
|---------------|-------------|
| **Code.gs** | Google Apps Script: Phase 1 (Master_Cotizaciones, EQUIPOS, AUDIT_LOG, Ventas realizadas y entregadas, LINK_UBICACION, LINK_COTIZACION) and Phase 2 (automation, onEdit, entregas dialog). Paste into **Extensions → Apps Script** in the workbook. |
| **DialogEntregas.html** | HTML template for "Revisar entregas (fecha ayer)" — add as HTML file in Apps Script. |
| **sheets-api-server.js** | Node server: API + **interactive dashboard**. Serves `/api/cotizaciones`, `/api/proximas-entregas`, `/api/coordinacion-logistica`, `/api/audit`, POST `/api/marcar-entregado`, and the dashboard at `/`. |
| **dashboard/** | Dashboard UI: **Próximas entregas**, **Coordinación logística**, **KPIs financieros**, **Audit log** (filter + Export CSV). |
| **IMPLEMENTATION.md** | Step-by-step guide for all phases, triggers, testing, and deployment. |
| **DASHBOARD-FRONT-VISION.md** | Vision and spec: front unificado (datos por API, edición desde dashboard, botones Costeo / Administrar Venta / Marcar entregado, automatismos). |
| **LIVE-EDITING.md** | Cómo dejar el dashboard corriendo y editable en vivo (npm run dev:full, live reload con ?dev=1, skills/agentes). |
| **README.md** | This file. |

## Quick start (Phase 1 + 2)

1. Open the Google Sheets workbook **"2.0 - Administrador de Cotizaciones"**.
2. **Extensions → Apps Script** → paste **Code.gs** → add **DialogEntregas.html** (New → HTML file, name `DialogEntregas`) → Save as **BMC_Dashboard_Automation**.
3. Run **`runInitialSetup`** once → authorize.
4. Run **`migrateTwoRecords`** to migrate the two sample rows.
5. In Apps Script, add **Triggers**:  
   - `autoUpdateQuotationStatus` → daily 8–9 AM  
   - `sendQuotationAlerts` → daily 9–10 AM  
   - `onEdit` → From spreadsheet, On edit  
   - `sendPendingPaymentsUpdate` → Week timer: Monday, Thursday, Friday (e.g. 8–9 AM)  

## Corriendo y editando en vivo

Para tener todo levantado con un comando y poder editar el dashboard mientras probás:

- **`npm run dev:full`** — levanta API (3001) + Vite (5173). Abrí http://localhost:5173 y usá la pestaña Finanzas.
- En desarrollo, el iframe de Finanzas lleva **?dev=1** y el dashboard hace **live reload** cada ~2 s al cambiar `index.html`, `app.js` o `styles.css` (editá en `dashboard/` y guardá).
- Detalle completo: [LIVE-EDITING.md](LIVE-EDITING.md) (agentes bmc-dashboard-setup / bmc-dashboard-automation, skill panelin-live-editor).

## Integración en la app principal

El dashboard de Finanzas está integrado como **pestaña** en la calculadora Panelin:

- En la app (Vite + API en el mismo backend), en el header verás las pestañas **Invocar Panelin** y **Finanzas**.
- Al elegir **Finanzas**, se muestra el dashboard (próximas entregas, coordinación logística, KPIs, audit log). Los datos se sirven desde la API del mismo servidor (`/api/*` y `/finanzas`).
- Requiere que el backend (puerto 3001) tenga configurados `BMC_SHEET_ID` y `GOOGLE_APPLICATION_CREDENTIALS` en `.env`.

## Quick start (Dashboard + API)

1. **Env:** From repo root, `.env` should have (already set if you ran setup):
   - `GOOGLE_APPLICATION_CREDENTIALS` = absolute path to your Google Cloud service account JSON key (Sheets API enabled; share the sheet with that account as Editor). Default path: `docs/bmc-dashboard-modernization/service-account.json` — **drop your downloaded JSON there** and the dashboard will use it.
   - `BMC_SHEET_ID` = spreadsheet ID from the workbook URL (`https://docs.google.com/spreadsheets/d/<BMC_SHEET_ID>/edit`).
2. **Run:** `npm run bmc-dashboard` (from repo root; loads `.env`) or `node docs/bmc-dashboard-modernization/sheets-api-server.js`
3. **Open:** [http://localhost:3849/](http://localhost:3849/)

The dashboard shows:
- **Próximas entregas** — listado de entregas de la semana actual (ESTADO = Confirmado, FECHA_ENTREGA esta semana), con botones **WhatsApp** (copiar mensaje por pedido) y **Marcar entregado** (mueve a Ventas realizadas y entregadas).
- **Coordinación logística** — texto listo para copiar/pegar en WhatsApp para transportistas: nombre de cliente, teléfono, ubicación (link o datos), nº pedido, items/cotización (LINK_COTIZACION o NOTAS).
- **KPIs financieros** — total pendiente, montos por periodo (esta semana, próxima, este mes), **calendario de vencimientos** (todos los due dates de pagos pendientes), detalle de pagos pendientes y **metas de ventas**. Reporte por email **Lunes, Jueves y Viernes** (trigger `sendPendingPaymentsUpdate`) a todos los de EQUIPOS.
- **Audit log** — registro de cambios (AUDIT_LOG) con filtro de texto y botón **Exportar CSV**.

Details and Phase 3/4 are in **IMPLEMENTATION.md**.
