# Examples — Google Sheets Mapping Agent

## Example 1: "Map the Admin Sheet"

**User:** Map the Admin Sheet where the system uploads and gets data.

**Agent:** Uses this skill and [reference.md](reference.md). Produces a mapping document that includes:

- Sheet inventory: CRM_Operativo, Parametros, Dashboard, Data Base.
- CRM_Operativo: data types (ID, dates, contact, categorical, calculated), relationships (Parametros → dropdowns, CRM_Operativo → Dashboard), calculation logic (ID, Score auto, Prioridad auto, Alerta, Dashboard COUNTIFS/SUMIFS).
- Get/Push: what the system reads from CRM_Operativo (e.g. `/api/cotizaciones`), what it writes (new rows, status/date updates).

## Example 2: "Document a new sheet for get/push"

**User:** We added a sheet "Entregas" — document it so the system knows what to get and push.

**Agent:** Runs the workflow: gather (new sheet name, any routes that use it), inspect (columns, types, validations, formulas), document (same structure as reference.md), then explicit "System GETs" and "System PUSHes" for Entregas.

## Example 3: "Schema for BMC_SHEET_SCHEMA"

**User:** Export the Admin Sheet map as something we can use for BMC_SHEET_SCHEMA.

**Agent:** After producing the full mapping, emits a minimal schema (e.g. sheet names, column names, types) in JSON or the format the codebase expects, so GET/PUSH code stays aligned with the map.
