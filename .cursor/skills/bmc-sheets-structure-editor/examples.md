# Examples — BMC Sheets Structure Editor (Matias only)

Use only when the request is from **Matias** and in **this Cursor workspace**. Otherwise, do not perform structure edits.

---

## Example 1: "Create a new tab"

**Matias:** Add a new tab "Reportes_Semanal" to the BMC sheet.

**Agent:** Proposes or adds code (route or script) that calls `spreadsheets.batchUpdate` with:

```json
{ "addSheet": { "properties": { "title": "Reportes_Semanal" } } }
```

Uses `BMC_SHEET_ID` and project credentials. Matias runs the server or script to apply.

---

## Example 2: "Insert 10 rows after row 5 in CRM_Operativo"

**Agent:** Proposes code that (1) gets `sheetId` for "CRM_Operativo" via `spreadsheets.get`, (2) calls `batchUpdate` with `insertDimension`: dimension `ROWS`, `startIndex: 5`, `endIndex: 15`. Matias runs it from Cursor.

---

## Example 3: "Add a chart to Dashboard"

**Agent:** Proposes code that uses `addChart` with a `ChartSpec` (e.g. `basicChart` or `pieChart`) and `position.overlayPosition` with `anchorCell` (sheetId, rowIndex, columnIndex) and size. Reference: [reference.md](reference.md). Matias runs from Cursor.

---

## Example 4: "Add dropdown to column Estado from Parametros"

**Matias:** Add a dropdown to the Estado column in CRM_Operativo using the list from Parametros.

**Agent:** Proposes code that (1) reads the Parametros range for Estado (e.g. `values.get` on the Parametros column), (2) builds a `setDataValidation` rule with `ONE_OF_LIST` and those values, (3) calls `batchUpdate` with the range for the Estado column in CRM_Operativo. See [reference.md](reference.md) § Data validation. Matias runs from Cursor.

---

## Example 5: "Document and customize workflow"

**Matias:** I want to add a step where new rows in CRM_Operativo get a default "Prioridad manual" from Parametros.

**Agent:** (1) Uses mapping agent context to confirm current flow (Parametros → CRM_Operativo, columns). (2) Proposes workflow change: set data validation on "Prioridad manual" from Parametros and/or document that new rows should get a default (e.g. formula or script). (3) Implements via structure editor: e.g. `setDataValidation` for Prioridad manual from Parametros list; optionally a short "Workflow" note in the mapping doc. Matias runs scripts from Cursor.

---

## Example 6: Request from someone other than Matias

**User (not Matias):** Create a new tab in the BMC sheet.

**Agent:** Does **not** apply structure-editing. Responds that this kind of edit is restricted to Matias from the Cursor workspace; suggests contacting Matias or using read-only/mapping flows.
