# BMC Sheets Structure Editor — API Reference

Operations for creating and editing sheet structure and content. Used only by Matias, from the Cursor workspace. All calls use the same spreadsheet (`BMC_SHEET_ID`) and service account as `server/routes/bmcDashboard.js`.

---

## Auth and client (Node)

```javascript
const { google } = require("googleapis");
const auth = new google.auth.GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const authClient = await auth.getClient();
const sheets = google.sheets({ version: "v4", auth: authClient });
const spreadsheetId = process.env.BMC_SHEET_ID; // or config.bmcSheetId
```

---

## Tabs (sheets)

- **Add tab**: `spreadsheets.batchUpdate` with request:
  - `addSheet`: `{ properties: { title: "NewTabName" } }` (optional: `gridProperties`, `tabColor`).
- **Delete tab**: `deleteSheet`: `{ sheetId }` (get `sheetId` from `spreadsheets.get` → `sheets[].properties.sheetId`).
- **Rename / resize**: `updateSheetProperties`: `{ sheetId, properties: { title, gridProperties } }`.

---

## Rows and columns

- **Insert rows/columns**: `insertDimension`: `{ range: { sheetId, dimension: "ROWS"|"COLUMNS", startIndex, endIndex } }`.
- **Delete rows/columns**: `deleteDimension`: same `range` shape.
- **Update cell values**: `spreadsheets.values.update` with `range` (e.g. `'SheetName'!A1:Z10`), `valueInputOption: "USER_ENTERED"` for formulas, `requestBody: { values: [[...], ...] }`.
- **Append rows**: `spreadsheets.values.append` (see `handleMarcarEntregado` in `bmcDashboard.js`).
- **Clear range**: `spreadsheets.values.clear` with `range`.

---

## Charts

- **Add chart**: `addChart`: `{ chart: { chartId, spec: { title, basicChart | pieChart | ... }, position: { overlayPosition: { anchorCell: { sheetId, rowIndex, columnIndex }, widthPixels, heightPixels } } } }`.
- **Update chart**: `updateChartSpec` with `chartId`, `spec`.
- Chart types: `basicChart`, `pieChart`, `bubbleChart`, etc. — see [Charts API](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/charts).

---

## Data validation (dropdown menus)

- **Set dropdown on range**: `batchUpdate` with request `setDataValidation`:
  - `range`: `{ sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex }`.
  - `rule`: `{ condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "Option A" }, { userEnteredValue: "Option B" }] }, showCustomUi: true }` for a static list.
- **Dropdown from Parametros**: (1) Read Parametros range with `values.get` (e.g. column with Estado, Categoría, etc.). (2) Build `values: [{ userEnteredValue: cell } for each cell]`. (3) Apply `setDataValidation` with that list. Optionally use `condition.type: "ONE_OF_RANGE"` with a `DataSourceSpec` if the sheet has a named range pointing to Parametros.
- **Strict / reject invalid**: `rule.strict: true` and `rule.showCustomUi: true` for classic dropdown behavior.
- See [Sheets API DataValidationRule](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets#datavalidationrule).

---

## Other batchUpdate requests

- **Merge cells**: `mergeCells`: `{ range: { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex } }`.
- **Conditional format**: `addConditionalFormatRule` / `updateConditionalFormatRule`.
- **Freeze rows/columns**: `updateSheetProperties` with `gridProperties.frozenRowCount` / `frozenColumnCount`.

---

## Resolving sheetId by name

```javascript
const meta = await sheets.spreadsheets.get({ spreadsheetId });
const sheet = meta.data.sheets?.find(
  (s) => s.properties?.title === "CRM_Operativo"
);
const sheetId = sheet?.properties?.sheetId;
```

Use this when you need `sheetId` for `insertDimension`, `deleteDimension`, `addChart`, etc.

---

## Automation, guides, and workflow (read + customize)

- **Read automation**: Automation and setup guides are in the repo: `.cursor/SETUP DASHBOARD /README.md`, `docs/bmc-dashboard-modernization/`, and the mapping agent’s output (`.cursor/skills/google-sheets-mapping-agent/`). Use the mapping agent to document formulas, triggers (if any), and data flow. No direct “read Apps Script” from Cursor; document automation in a mapping or a short “Automation” section in the sheet map.
- **Workflow customization**: (1) Document current workflow (e.g. Parametros → CRM_Operativo → Dashboard; GET/PUSH in bmcDashboard.js). (2) Define target workflow (new tabs, validations, steps). (3) Implement via this skill: `addSheet`, `setDataValidation`, `values.update`/`append`, or new API routes that read/write the workbook. Optionally add a “Workflow” subsection to the mapping reference (e.g. in google-sheets-mapping-agent/reference.md) describing the customized flow and which ranges/columns are updated by whom.
