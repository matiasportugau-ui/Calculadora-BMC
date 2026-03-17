# Admin Sheet Mapping — CRM_Operativo (Reference)

Canonical example for mapping a Google Sheet used for get/push by the system. Use this structure when documenting other sheets (e.g. Parametros, Dashboard, Data Base).

**Target 10/10 architecture:** For the BMC crm_automatizado workbook, the implementation blueprint is `docs/bmc-dashboard-modernization/SHEET-ARCHITECTURE-BLUEPRINT-V2.md` (Parametros, CRM_Operativo column set, Motor_IA, Dashboard layout, dropdowns from Parametros, Urgencia rule, Apps Script, Panel Agente AI sidebar).

---

## 1. Sheet Inventory

| Sheet name        | Role                          |
|-------------------|-------------------------------|
| **CRM_Operativo** | Source for Dashboard; main data entry |
| **Parametros**    | Dropdown/validation lists     |
| **Dashboard**     | Aggregations, charts (reads CRM_Operativo) |
| **Data Base**     | Backup/mirror of CRM_Operativo |

---

## 2. Data Types and Typical Values (CRM_Operativo)

- **Identifiers**: `ID` (Integer, auto-incrementing).
- **Dates**: `Fecha`, `Fecha próxima acción`, `Último contacto` (YYYY-MM-DD).
- **Contact Info**: `Cliente` (String), `Teléfono` (Numeric/Float), `Ubicación` (String).
- **Categorical (Dropdowns)**:
  - `Estado`: "Pendiente", "En análisis", "Cotizando", "Descartado".
  - `Categoría`: "Accesorios", "Paneles techo", "Proyecto completo", "Tornillería".
  - `Prioridad manual`: "Alta", "Media", "Baja", "Sin prioridad".
  - `Urgencia`: "Hoy", "24 h", "Esta semana", "Sin urgencia".
- **Calculated Metrics**:
  - `Score auto`: Integer (0–100).
  - `Días sin movimiento`: Float (e.g. 4.0).
  - `Prioridad auto`: "Alta", "Media", "Baja".
  - `Alerta`: "Seguimiento vencido", "OK", "Descartado".

---

## 3. Relationships and Lookups

- **Dropdown sources**: `CRM_Operativo` uses **Parametros** to populate validation lists for: `Estado`, `Categoría`, `Responsable`, `Prioridad manual`, `Urgencia`, `Cierre / Estado final`.
- **Data flow**: `CRM_Operativo` is the **source** for all tables and charts in **Dashboard**.
- **Redundancy**: **Data Base** mirrors `CRM_Operativo` for backup or reporting.

---

## 4. Calculation Logic and Automatisms

- **ID generation**: `ROW()-3` to assign unique IDs to new rows.
- **Scoring engine (`Score auto`)**: Weighted formula (0–100):
  - **Urgency**: Higher points for "Hoy" or "24 h".
  - **Aging**: Points decrease as `Días sin movimiento` increases.
  - **Quote status**: Points added if `Necesita cotización` is "Sí".
- **Priority logic (`Prioridad auto`)**: Maps `Score auto` to category (e.g. Score > 60 = "Alta").
- **Alert system**:
  - `Vence hoy`: "SI" if `Fecha próxima acción` = TODAY().
  - `Alerta`: "Seguimiento vencido" if `Fecha próxima acción` < TODAY() and state is "Abierto".
- **Dashboard aggregations**: `COUNTIFS` and `SUMIFS` to summarize active consultations, pending quotes, pipeline value by responsibility and status.

---

## 5. Get/Push Contract (Example)

- **System GETs**: Full or filtered rows from `CRM_Operativo` (e.g. for `/api/cotizaciones`, list views, Dashboard formulas).
- **System PUSHes**: New rows or cell updates to `CRM_Operativo` (e.g. new consultation, status/date changes); optionally sync to **Data Base**.
- **Read-only from app**: **Parametros** (validation), **Dashboard** (display).

Adapt "System GETs" and "System PUSHes" to the actual API or Apps Script ranges used in your project.

---

## 6. Direct Read/Write (Map & Edit via API)

To **work directly on the sheet** (map = read, edit = write), use the Sheets API from backend or scripts:

- **Read (map)**  
  - Backend: `server/routes/bmcDashboard.js` → `getSheetData(sheetId, sheetName, false, opts)` uses `sheets.spreadsheets.values.get`.  
  - Ranges: e.g. `'CRM_Operativo'!A3:ZZ` when `headerRowOffset: 2`.  
  - Agent can add a route or script that dumps any tab’s headers + rows to produce or refresh the mapping doc.

- **Write (edit)**  
  - **Append**: `sheets.spreadsheets.values.append` (see `handleMarcarEntregado`: append to `'Ventas realizadas y entregadas'!A:Y`).  
  - **Update range**: `sheets.spreadsheets.values.update` with `range` and `values`.  
  - **Delete/move**: `sheets.spreadsheets.batchUpdate` with `deleteDimension` or other requests.  
  - Auth: same as read — `GoogleAuth` with `GOOGLE_APPLICATION_CREDENTIALS` and scope `spreadsheets` (read-only) or `spreadsheets` (read/write).  
  - Agent implements new routes or scripts that call these; user runs the server or script with valid `BMC_SHEET_ID` and credentials.
