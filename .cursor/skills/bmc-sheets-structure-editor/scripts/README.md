# Scripts — BMC Sheets Structure Editor

Scripts here perform structure edits (tabs, rows, columns, charts) on the BMC workbook. **Only Matias** should run them, from the **Cursor workspace**.

- Use `BMC_SHEET_ID` and `GOOGLE_APPLICATION_CREDENTIALS` from the project (e.g. `.env` or env).
- Add new scripts as needed (e.g. `add-tab.js`, `insert-rows.js`); the agent can generate them and place them here.
- Run from repo root, e.g.: `node .cursor/skills/bmc-sheets-structure-editor/scripts/add-tab.js "NewTabName"`.
