# BMC Uruguay Dashboard Modernization — Implementation Guide

Complete 4-phase project to transform the dashboard into an automated, real-time collaborative platform. **Duration:** 3–4 weeks. **Team:** Matías (CEO), Sandra (Admin), Ramiro, Martin (Ventas).

---

## Phase 1: Data Layer Foundation (3–4 days)

### 1.1 Open the workbook and run setup

1. Open the Google Sheets workbook **"2.0 - Administrador de Cotizaciones"** (or the one that contains the old Admin sheet).
2. Go to **Extensions → Apps Script**.
3. Replace any existing code with the contents of **`Code.gs`** in this folder.
4. Add the diálogo de entregas: **File → New → HTML file**, name it **`DialogEntregas`**, paste the contents of **`DialogEntregas.html`** from this folder, save.
5. Save the project as **"BMC_Dashboard_Automation"**.

### 1.2 Create sheets and migrate data

1. In the Apps Script editor, select the function **`runInitialSetup`** in the dropdown and click **Run**.
2. Authorize the script when prompted (view/edit spreadsheets, send email if you use alerts).
3. Check that the workbook now has:
   - **Master_Cotizaciones** — 23 columns (incl. FECHA_ENTREGA, COMENTARIOS_ENTREGA), ESTADO = Borrador | Enviado | Pendiente | Confirmado | Rechazado | **Entregado**, validations (ESTADO, MONEDA, ASIGNADO_A), conditional formatting.
   - **EQUIPOS** — 4 rows (Matías, Sandra, Ramiro, Martin).
   - **AUDIT_LOG** — headers only.
   - **ESTADOS_TRANSICION** — workflow rules.
   - **Ventas realizadas y entregadas** — hoja de destino para ventas confirmadas como entregadas (misma estructura + FECHA_ENTREGA_REAL).
   - **Pagos_Pendientes** — vencimientos y cobros (PAGO_ID, COTIZACION_ID, CLIENTE_NOMBRE, MONTO, MONEDA, FECHA_VENCIMIENTO, ESTADO_PAGO, etc.).
   - **Metas_Ventas** — metas de ventas por período (PERIODO, META_MONTO, MONEDA, TIPO, NOTAS).
4. Run **`migrateTwoRecords`** to copy the two sample records (COT-20260314-001, COT-20260314-002) into `Master_Cotizaciones` rows 2 and 3.
5. *(Optional)* Rename the **original** “2.0 - Administrador de Cotizaciones” sheet to **"2.0 - Administrador de Cotizaciones [ARCHIVED 14-03-2026]"** as backup.

### 1.3 Manual checks

- **Master_Cotizaciones:** ESTADO dropdown = Borrador | Enviado | Pendiente | Confirmado | Rechazado | **Entregado**; columnas **FECHA_ENTREGA** (fecha prevista de entrega) y **COMENTARIOS_ENTREGA** (opcional); MONEDA = $ | UES; ASIGNADO_A = names from EQUIPOS.
- **Formulas:** In a data row, set ESTADO to “Pendiente” and FECHA_ENVIO to a date; DIAS_PENDIENTE (col O) should compute.
- **Conditional formatting:** Changing ESTADO should change row color (gray/blue/yellow/green/red; Entregado = verde oscuro).

---

## Phase 2: Automation Layer (4–5 days)

### 2.1 Install triggers

1. In Apps Script, click the **clock (Triggers)** icon.
2. **Trigger 1**
   - Function: `autoUpdateQuotationStatus`
   - Event: Time-driven → Day timer → 8:00–9:00 AM
3. **Trigger 2**
   - Function: `sendQuotationAlerts`
   - Event: Time-driven → Day timer → 9:00–10:00 AM
4. **Trigger 3**
   - Function: `onEdit`
   - Event: From spreadsheet → On edit
5. **Trigger 4 (reporte pagos pendientes — Lunes)**
   - Function: `sendPendingPaymentsUpdate`
   - Event: Time-driven → Week timer → Monday, 8:00–9:00 AM
6. **Trigger 5 (reporte pagos pendientes — Jueves)**
   - Function: `sendPendingPaymentsUpdate`
   - Event: Time-driven → Week timer → Thursday, 8:00–9:00 AM
7. **Trigger 6 (reporte pagos pendientes — Viernes)**
   - Function: `sendPendingPaymentsUpdate`
   - Event: Time-driven → Week timer → Friday, 8:00–9:00 AM
8. Save and grant permissions when asked.

### 2.2 Test automation

| Test | Action | Expected |
|------|--------|----------|
| 1 | Run `autoUpdateQuotationStatus` manually (Run) | Execution log shows “Auto-updated N quotations” (or 0 if none Enviado &gt;5 days). |
| 2 | Check **AUDIT_LOG** | New row after manual run or after editing a cell. |
| 3 | Run `sendQuotationAlerts` manually | Assignees with Borrador/Pendiente/Enviado 7+ days receive email (if Gmail set up). |
| 4 | Edit a cell in **Master_Cotizaciones** | `onEdit` runs; AUDIT_LOG has “Manual Edit”; FECHA_ACTUALIZACION updates. |
| 5 | Change ESTADO to “Confirmado” | FECHA_CONFIRMACION can be set (formula or script); sync to “2.0 - Ventas” if that sheet exists and has matching COTIZACION_ID. |
| 6 | **Ventas → Revisar entregas (fecha ayer)** | Abre diálogo con ventas Confirmadas cuya FECHA_ENTREGA = ayer; marcar entregadas + comentarios y “Mover a Ventas realizadas y entregadas”. |
| 7 | Set ESTADO to “Entregado” (o marcar en el diálogo) | La fila se copia a **Ventas realizadas y entregadas** (con FECHA_ENTREGA_REAL = hoy y COMENTARIOS_ENTREGA) y se elimina de Master_Cotizaciones. |

### 2.3 Entregas (fecha ayer) — confirmar y mover a Ventas realizadas y entregadas

- **Menú:** Al abrir la hoja aparece **Ventas → Revisar entregas (fecha ayer)**.
- Al elegirlo se listan las filas de **Master_Cotizaciones** con **ESTADO = Confirmado** y **FECHA_ENTREGA = ayer**. Si no hay ninguna, se muestra un mensaje.
- En el diálogo: tabla con checkbox **Entregado**, Cotización, Cliente y campo **Comentarios** por fila. El usuario marca las que ya se entregaron hoy y opcionalmente escribe comentarios.
- Al hacer clic en **"Mover a Ventas realizadas y entregadas"**: cada fila marcada se copia a la pestaña **Ventas realizadas y entregadas** (con **FECHA_ENTREGA_REAL** = hoy y los comentarios ingresados), se elimina de Master_Cotizaciones y se registra en AUDIT_LOG.
- **Alternativa manual:** En Master_Cotizaciones se puede poner **ESTADO = Entregado** (y opcionalmente **COMENTARIOS_ENTREGA**). Al guardar, la fila se mueve automáticamente a Ventas realizadas y entregadas.

### 2.4 Reporte de pagos pendientes y metas (Lunes, Jueves, Viernes)

- **Función:** `sendPendingPaymentsUpdate()` — envía por email a todos los de EQUIPOS un resumen: pagos pendientes (total, esta semana, próxima, este mes), calendario de vencimientos, detalle por cliente, y metas de ventas (Metas_Ventas).
- **Triggers:** 3 triggers time-driven Week timer: **Lunes**, **Jueves**, **Viernes** (ej. 8:00–9:00 AM).

### 2.5 Hojas Pagos_Pendientes y Metas_Ventas

- **Pagos_Pendientes:** PAGO_ID, COTIZACION_ID, CLIENTE_NOMBRE, MONTO, MONEDA, FECHA_VENCIMIENTO, ESTADO_PAGO, FECHA_COBRO, NOTAS.
- **Metas_Ventas:** PERIODO, META_MONTO, MONEDA, TIPO (mensual/semanal), NOTAS.

### 2.6 Email (Gmail)

- Alerts use **GmailApp.sendEmail**. The script must run as a user who can send mail (e.g. matias@bmc.com).
- If you use a Google Workspace account, ensure “Less secure app access” or OAuth is configured as needed for Apps Script.

---

## Phase 3: Viewer/Dashboard Enhancement (3–4 days)

The Panelin Evolution viewer at **http://localhost:3847/viewer/** currently embeds Google Sheets. Phase 3 adds:

- **Data source:** A backend API that reads **Master_Cotizaciones** via Google Sheets API v4 and returns JSON (to avoid CORS and expose only needed columns).
- **Dashboard UI:** Replace or complement the “Administrador de Cotizaciones” embed with a **dynamic table** that:
  - Pulls from that API (e.g. every 30 s or on demand).
  - Shows: COTIZACION_ID, CLIENTE_NOMBRE, ESTADO, DIAS_PENDIENTE, ASIGNADO_A, FECHA_ENVIO, MONTO_ESTIMADO.
  - Adds an **ACCIONES** column (Mark Sent, Mark Confirmed, Mark Rejected, Assign, Edit Notes).
- **Filters:** Date range (FECHA_CREACION), ESTADO checkboxes, ASIGNADO_A dropdown, free-text search (CLIENTE_NOMBRE, COTIZACION_ID).
- **Quick stats cards:** Total This Week, Pending 3+ Days, Overdue 7+ Days, Confirmed This Week.
- **Tabs:** “Mis Tareas” (ASIGNADO_A = current user, ESTADO ≠ Confirmado/Rechazado), “Estado de Ventas” (join Cotizaciones + Ventas + Pagos), “Pagos Pendientes”, “KPIs” (charts + conversion metrics).
- **Inline editing:** ESTADO, ASIGNADO_A, NOTAS, FECHA_CONFIRMACION — save via API → sheet; `onEdit` and sync still run when sheet is edited.

### Integrated dashboard (Próximas entregas + Coordinación logística)

The same Node server serves an **interactive dashboard** at **http://localhost:3849/** (or `/dashboard`):

- **Próximas entregas:** Listado de entregas de la **semana corriente** (ESTADO = Confirmado, FECHA_ENTREGA dentro de la semana). Tabla con: Pedido, Cliente, Teléfono, Ubicación, Fecha entrega. Acciones por fila:
  - **WhatsApp** — copia al portapapeles el mensaje de coordinación logística para ese pedido.
  - **Marcar entregado** — mueve la fila a **Ventas realizadas y entregadas** (vía API POST) y la elimina de Master_Cotizaciones.
- **Coordinación logística:** Bloque de texto listo para copiar/pegar en WhatsApp para transportistas. Incluye por pedido: nombre de cliente, teléfono, ubicación ( **LINK_UBICACION** o, si no hay link, dirección/zona), número de pedido, y referencia a **LINK_COTIZACION** (foto/PDF de la cotización con items) o NOTAS si no hay link.
- **KPIs financieros:** Tarjetas con total pendiente, esta semana, próxima semana, este mes; **calendario de vencimientos** (monto por fecha); tabla de pagos pendientes (detalle); tabla de **metas de ventas** (desde Metas_Ventas). Datos desde hojas Pagos_Pendientes y Metas_Ventas.

**Columnas en Master para logística:** **LINK_UBICACION** y **LINK_COTIZACION** (agregadas en Code.gs). Si no hay link de ubicación se usa DIRECCION + ZONA; si no hay link de cotización se usan NOTAS.

### Sheets API server (included)

The Node server provides the API and serves the dashboard:

1. Install dependency: `npm install googleapis`
2. Create a **Google Cloud service account** with Sheets API enabled (read + **write** for "Marcar entregado"); download JSON key.
3. Set env vars:
   - `GOOGLE_APPLICATION_CREDENTIALS` = path to the service account JSON
   - `BMC_SHEET_ID` = the spreadsheet ID (from the workbook URL: `https://docs.google.com/spreadsheets/d/<BMC_SHEET_ID>/edit`)
4. Run: `node docs/bmc-dashboard-modernization/sheets-api-server.js`
5. Open **http://localhost:3849/** for the dashboard.
6. Endpoints:
   - `GET /api/cotizaciones` → Master_Cotizaciones (headers + data)
   - `GET /api/proximas-entregas` → Entregas de la semana (Confirmado + FECHA_ENTREGA esta semana)
   - `GET /api/coordinacion-logistica?ids=COT-001,COT-002` → Mensaje WhatsApp (sin `ids` = todos de próximas entregas)
   - `GET /api/audit` → AUDIT_LOG
   - `POST /api/marcar-entregado` → body `{ "cotizacionId": "...", "comentarios": "..." }` — mueve a Ventas realizadas y entregadas

The viewer/dashboard fetches from the API; write actions (marcar entregado) require the service account to have **edit** access to the spreadsheet.

**Spreadsheet ID:** The workbook "2.0 - Administrador de Cotizaciones" has sheet ID `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` (see `data/bmc-sheets.json` in the viewer repo). Use this as `BMC_SHEET_ID` when running the API server.

---

## Phase 4: Collaboration & Task Management (2–3 days)

- **Audit log tab:** Implemented in the dashboard: section **Audit log** that lists **AUDIT_LOG** (TIMESTAMP, ACTION, ROW, OLD_VALUE, NEW_VALUE, REASON, USER, SHEET) with a text filter (acción, usuario, razón) and **Exportar CSV** button.
- **Permissions:** In Apps Script and/or backend, enforce:
  - **CEO:** Full read/write/delete, configure automation.
  - **Admin:** Read/write all (no delete), assign tasks, configure alerts.
  - **Sales:** Read all; write only assigned quotations; no delete.
- **Browser notifications:** Use Web Notifications API in the viewer for: “Nueva tarea: COT-123 - Cliente”, “COT-123 ahora Confirmado”, “ALERTA: COT-123 vencido 7 días”.

---

## Testing Checklist

### Phase 1
- [ ] Master_Cotizaciones has 23 columns (incl. FECHA_ENTREGA, COMENTARIOS_ENTREGA, LINK_UBICACION, LINK_COTIZACION) and validations.
- [ ] Formulas (K, L, O) behave as expected.
- [ ] Both migrated records appear correctly.
- [ ] EQUIPOS has 4 members; AUDIT_LOG, ESTADOS_TRANSICION, Ventas realizadas y entregadas, Pagos_Pendientes, Metas_Ventas exist.
- [ ] DialogEntregas.html added as HTML file in Apps Script.

### Phase 2
- [ ] `autoUpdateQuotationStatus` runs without errors.
- [ ] AUDIT_LOG gets new rows after runs/edits.
- [ ] `sendQuotationAlerts` sends emails when applicable.
- [ ] `onEdit` runs and FECHA_ACTUALIZACION updates.
- [ ] Sync to “2.0 - Ventas” works when sheet and column exist.

### Phase 3
- [ ] Dashboard at http://localhost:3849/ loads (run `npm run bmc-dashboard` with BMC_SHEET_ID and GOOGLE_APPLICATION_CREDENTIALS set).
- [ ] Próximas entregas table and WhatsApp / Marcar entregado work.
- [ ] Coordinación logística preview and copy work.
- [ ] KPIs financieros: cards, calendario de vencimientos, pagos pendientes, metas de ventas.
- [ ] API: /api/cotizaciones, /api/proximas-entregas, /api/coordinacion-logistica, /api/audit, /api/pagos-pendientes, /api/metas-ventas, /api/kpi-financiero, POST /api/marcar-entregado.

### Phase 4
- [ ] Audit log tab shows AUDIT_LOG with filter and Export CSV.
- [ ] Role-based permissions enforced (Apps Script / process).
- [ ] Browser notifications (optional): configure when needed.

---

## Deployment

1. **Backup:** Export critical sheets to CSV.
2. **Triggers:** Confirm all six triggers are active (autoUpdateQuotationStatus, sendQuotationAlerts, onEdit, sendPendingPaymentsUpdate × Mon/Thu/Fri) at the correct times.
3. **Dashboard:** Point the viewer to the new API (or embed) and verify Master_Cotizaciones is the primary source.
4. **Monitor:** Check execution log and AUDIT_LOG for the first 24 hours; have a rollback plan (restore sheet from backup, disable triggers).

---

## Success Criteria

- Automation covers ~80% of status updates.
- Data validation prevents invalid ESTADO/MONEDA/ASIGNADO_A.
- Most quotations confirmed within 7 days.
- Full team uses the new dashboard.
- Dashboard load &lt; 2 s; error rate &lt; 1%.

---

## File reference

| File | Purpose |
|------|--------|
| `Code.gs` | Phase 1 setup + Phase 2 automation (paste into Apps Script). |
| `DialogEntregas.html` | Plantilla HTML del diálogo "Revisar entregas (fecha ayer)" — agregar como archivo HTML en Apps Script (File → New → HTML file, nombre `DialogEntregas`). |
| `sheets-api-server.js` | Node server: API (cotizaciones, próximas-entregas, coordinacion-logistica, audit, pagos-pendientes, metas-ventas, kpi-financiero, marcar-entregado) + sirve el dashboard estático. |
| `dashboard/` | UI del dashboard: index.html, styles.css, app.js (Próximas entregas, Coordinación logística, KPIs financieros, Audit log con export CSV). |
| `README.md` | Quick start Phase 1+2 y dashboard. |
| `IMPLEMENTATION.md` | This guide. |

**Run dashboard from repo root:** `npm run bmc-dashboard` (requires `BMC_SHEET_ID` and `GOOGLE_APPLICATION_CREDENTIALS`). Or: `node docs/bmc-dashboard-modernization/sheets-api-server.js`.

After Phase 1 and 2, use this guide to implement Phase 3 (viewer + API) and Phase 4 (audit, permissions, notifications) in the codebase and Apps Script as needed.
