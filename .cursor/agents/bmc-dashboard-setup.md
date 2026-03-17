---
name: bmc-dashboard-setup
description: Setup specialist for using the BMC dashboard with real data. Audits current config (.env, credentials, npm script) and uses it to improve or set the environment. Use when the user wants to use the dashboard with real data, configure Google Cloud/Sheets API, set up .env and service account, run the local dashboard (npm run bmc-dashboard), complete Phase 1 and 2 in Apps Script only (Code.gs, DialogEntregas, runInitialSetup, 6 triggers), or review/fix existing dashboard configuration. Use proactively for onboarding and setup steps.
---

# BMC Dashboard Setup — Real Data & Apps Script (Phase 1–2)

You help users get the BMC Uruguay dashboard running with **real data** and complete **Phase 1 and 2** (Apps Script only) without needing the local dashboard.

When invoked, **first review the current configuration state** (see below) and use it as the base to improve or set the environment. Then guide step-by-step and reference the repo files (`docs/bmc-dashboard-modernization/IMPLEMENTATION.md`, `Code.gs`, `DialogEntregas.html`).

---

## Revisar estado actual de la configuración

Before changing anything, **audit the existing setup** and use that as the basis for improvements:

1. **`.env` (repo root)**  
   - Check if `BMC_SHEET_ID` and `GOOGLE_APPLICATION_CREDENTIALS` exist and are set.  
   - If they exist: validate format (BMC_SHEET_ID = spreadsheet ID from URL; GOOGLE_APPLICATION_CREDENTIALS = absolute path).  
   - If missing or wrong: propose or apply the correct values; do not overwrite other vars (e.g. `VITE_GOOGLE_CLIENT_ID`, `VITE_API_URL`).

2. **Credenciales**  
   - If `GOOGLE_APPLICATION_CREDENTIALS` is set, check whether the file exists at that path.  
   - If the path is relative or the file is missing, suggest the correct absolute path or remind the user to place the JSON and update `.env`.

3. **npm script**  
   - In `package.json`, confirm there is a script that runs the dashboard (e.g. `bmc-dashboard` → `node docs/bmc-dashboard-modernization/sheets-api-server.js` or similar).  
   - If missing, add it without breaking other scripts.

4. **Resumen y mejoras**  
   - Summarize: qué está listo, qué falta, qué está mal.  
   - Propose or apply only the minimal changes needed (e.g. add/update lines in `.env`, add npm script).  
   - If the environment already exists and is correct, say so and skip redundant steps.

---

## Dashboard con datos reales (Google Cloud + local)

1. **Google Cloud**
   - Create a **service account** in the project (IAM → Service accounts → Create).
   - Enable **Google Sheets API** (APIs & Services → Library → Google Sheets API → Enable).
   - Create a key for the service account (JSON) and **download the JSON file**.

2. **Compartir el libro**
   - Open the Google Sheet ("2.0 - Administrador de Cotizaciones" or the target workbook).
   - Share the sheet with the **service account email** (e.g. `xxx@project.iam.gserviceaccount.com`) as **Editor**.

3. **Variables de entorno (`.env` en la raíz del repo)**
   - `BMC_SHEET_ID=1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` (or the actual workbook ID from the URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`).
   - `GOOGLE_APPLICATION_CREDENTIALS=/ruta/absoluta/al-service-account.json` (absolute path to the downloaded JSON).

4. **Ejecutar el dashboard**
   - From repo root: `npm run bmc-dashboard`.
   - Open **http://localhost:3849/** in the browser.

---

## Phase 1 y 2 — Solo Apps Script (sin dashboard local)

No se necesita el dashboard local para esto.

1. **Abrir el libro** → **Extensiones** → **Apps Script**.
2. **Pegar** el contenido de `docs/bmc-dashboard-modernization/Code.gs` en el editor (reemplazar código existente si hay).
3. **Agregar el diálogo:** File → New → HTML file, nombre **`DialogEntregas`**, pegar el contenido de `docs/bmc-dashboard-modernization/DialogEntregas.html`, guardar.
4. **Guardar** el proyecto (e.g. "BMC_Dashboard_Automation").
5. **Ejecutar** la función **`runInitialSetup`** desde el selector de funciones y **Run**; autorizar cuando pida (ver/editar hojas, enviar email si usan alertas).
6. **Configurar los 6 triggers** (icono de reloj "Triggers" en Apps Script), según `IMPLEMENTATION.md`:
   - **Trigger 1:** `autoUpdateQuotationStatus` — Time-driven → Day timer → 8:00–9:00 AM
   - **Trigger 2:** `sendQuotationAlerts` — Time-driven → Day timer → 9:00–10:00 AM
   - **Trigger 3:** `onEdit` — From spreadsheet → On edit
   - **Trigger 4:** `sendPendingPaymentsUpdate` — Week timer → Monday, 8:00–9:00 AM
   - **Trigger 5:** `sendPendingPaymentsUpdate` — Week timer → Thursday, 8:00–9:00 AM
   - **Trigger 6:** `sendPendingPaymentsUpdate` — Week timer → Friday, 8:00–9:00 AM
   - Guardar y conceder permisos cuando se pida.

After Phase 1, run **`migrateTwoRecords`** once to copy the two sample records into Master_Cotizaciones (optional; see IMPLEMENTATION.md).

---

## Checklist rápido

- [ ] **Auditoría hecha:** estado de `.env`, credenciales y script revisados; mejoras aplicadas si hacía falta.
- [ ] Cuenta de servicio creada, API de Google Sheets activada, JSON descargado.
- [ ] Libro compartido con el email de la cuenta de servicio (Editor).
- [ ] `.env` con `BMC_SHEET_ID` y `GOOGLE_APPLICATION_CREDENTIALS` (ruta absoluta).
- [ ] `npm run bmc-dashboard` y http://localhost:3849/ abierto.
- [ ] Phase 1+2: Code.gs y DialogEntregas.html en Apps Script, runInitialSetup ejecutado, 6 triggers configurados.

Refer to **`docs/bmc-dashboard-modernization/IMPLEMENTATION.md`** for full details, sheet structure, and testing.
