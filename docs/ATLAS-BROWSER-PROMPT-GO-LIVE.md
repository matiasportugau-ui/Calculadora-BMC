# Atlas Browmos ser — Go-Live Manual Steps Prompt

**Purpose:** Run this prompt in OpenAI Atlas Browser (agent mode) to complete the manual steps that cannot be automated. The browser agent will navigate Google Sheets and Apps Script to finish the BMC Dashboard go-live.

**Prerequisites:**
- Logged into Google (same account that owns the workbook)
- Workbook ID: from `.env` BMC_SHEET_ID (e.g. `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg`)
- Workbook URL: `https://docs.google.com/spreadsheets/d/{BMC_SHEET_ID}/edit`
- Service account email: run `node scripts/get-service-account-email.js`

---

## TASK: Complete BMC Dashboard Go-Live

Execute these steps in order. After each step, verify success before continuing.

---

### Step 1: Share workbook with service account

1. Open the workbook. URL: `https://docs.google.com/spreadsheets/d/{BMC_SHEET_ID}/edit` (get BMC_SHEET_ID from .env)
2. Click **Share** (top right).
3. In "Add people and groups", paste the **service account email** (from `service-account.json` → `client_email`, e.g. `bmc-dashboard@project.iam.gserviceaccount.com`).
4. Set permission to **Editor**.
5. Uncheck "Notify people" (service accounts don't read email).
6. Click **Share**.
7. **Verify:** The service account appears in the list with Editor access.

---

### Step 2: Apps Script — Paste Code.gs

1. In the same workbook, go to **Extensions → Apps Script**.
2. If there is existing code in `Code.gs`, select all and delete.
3. Open the file `docs/bmc-dashboard-modernization/Code.gs` from the repo (or copy from `Calculadora-BMC/docs/bmc-dashboard-modernization/Code.gs`).
4. Paste the full contents into the Apps Script editor `Code.gs` tab.
5. Click **Save** (disk icon or Ctrl+S).
6. **Verify:** No syntax errors in the editor.

---

### Step 3: Apps Script — Add DialogEntregas.html

1. In Apps Script, click **+** next to Files → **HTML**.
2. Name the file: `DialogEntregas`.
3. Open `docs/bmc-dashboard-modernization/DialogEntregas.html` from the repo.
4. Paste the full contents into the HTML file.
5. Click **Save**.
6. **Verify:** `DialogEntregas` appears in the file list.

---

### Step 4: Apps Script — Run runInitialSetup

1. In the function dropdown (top of editor), select **`runInitialSetup`**.
2. Click **Run** (play button).
3. If prompted to authorize: click **Review permissions** → choose the Google account → **Advanced** → **Go to [project name] (unsafe)** → **Allow**.
4. Wait for execution to complete (check Execution log: "Phase 1 setup complete").
5. **Verify:** In the workbook, new tabs exist: Master_Cotizaciones, EQUIPOS, AUDIT_LOG, Pagos_Pendientes, Metas_Ventas, Ventas realizadas y entregadas, ESTADOS_TRANSICION.

---

### Step 5: Apps Script — Add triggers

1. In Apps Script, click the **clock icon** (Triggers) in the left sidebar.
2. Click **+ Add Trigger**.
3. **Trigger 1:** Function: `autoUpdateQuotationStatus`, Event: Time-driven → Day timer → 8:00–9:00 AM. Save.
4. **Trigger 2:** Function: `sendQuotationAlerts`, Event: Time-driven → Day timer → 9:00–10:00 AM. Save.
5. **Trigger 3:** Function: `onEdit`, Event: From spreadsheet → On edit. Save.
6. **Trigger 4:** Function: `sendPendingPaymentsUpdate`, Event: Time-driven → Week timer → Monday, 8:00–9:00 AM. Save.
7. **Trigger 5:** Function: `sendPendingPaymentsUpdate`, Event: Time-driven → Week timer → Thursday, 8:00–9:00 AM. Save.
8. **Trigger 6:** Function: `sendPendingPaymentsUpdate`, Event: Time-driven → Week timer → Friday, 8:00–9:00 AM. Save.
9. Grant permissions when prompted.
10. **Verify:** All 6 triggers appear in the Triggers list.

---

### Step 6: Verify CRM_Operativo tab

1. In the workbook, check that **CRM_Operativo** (or the main data tab) exists.
2. If the workbook uses a different schema (e.g. "2.0 - Administrador de Cotizaciones"), ensure it has the expected columns or was migrated per IMPLEMENTATION.md.

---

## After completion

1. Run locally: `./scripts/go-live-automation.sh --start-api`
2. Run: `node scripts/verify-sheets-tabs.js` — should pass.
3. Run: `BMC_API_BASE=http://localhost:3001 node scripts/validate-api-contracts.js` — should pass.
4. Open: http://localhost:3001/finanzas — verify KPIs, entregas, breakdown load.

---

## Reference files (repo)

- `docs/bmc-dashboard-modernization/Code.gs`
- `docs/bmc-dashboard-modernization/DialogEntregas.html`
- `docs/bmc-dashboard-modernization/IMPLEMENTATION.md`
- `docs/bmc-dashboard-modernization/service-account.json` (for client_email)

---

**To get service account email:** Run `node scripts/get-service-account-email.js` from repo root.
