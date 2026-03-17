# Universe brief: Cotizaciones

**Source:** IA report, DASHBOARD-VISUAL-MAP, DASHBOARD-EVALUATION-REPORT, repo (App.jsx, legacyQuote.js, calc router, PanelinCalculadoraV3*, GoogleDrivePanel).

---

## Scope

- **From docs/code:** Build and manage quotes: (1) **Quote builder (Calculadora)** — panel configurator (techo/pared, familias, espesores, zonas), BOM, PDF, save/load to Google Drive; (2) **Quote list/admin** — data comes from Master_Cotizaciones or CRM_Operativo via `/api/cotizaciones` (consumed by Operaciones/Finanzas UI, not by the Vite app today). The “Administrador de Cotizaciones 2.0” is a product concept; in repo, the builder lives in Vite and the list lives in the Finanzas dashboard.
- **Directly observed:** Vite app at 5173 is the Calculadora (PanelinCalculadoraV3_backup per App.jsx; DASHBOARD-VISUAL-MAP.md names PanelinCalculadoraV3_backup). legacyQuote router serves product catalog and legacy quote endpoints; calc router serves `/calc/cotizar`, `/calc/catalogo`.

## Data

- **Sheets:** Master_Cotizaciones, CRM_Operativo (schema driven by BMC_SHEET_SCHEMA). Read via bmcDashboard API, not directly from Vite.
- **APIs:** `VITE_API_URL` → Express: `/calc/cotizar` (POST), `/calc/catalogo`, legacyQuote routes. Cotizaciones list: `/api/cotizaciones` (used by Finanzas/Operaciones UI).
- **Env:** VITE_GOOGLE_CLIENT_ID, VITE_API_URL (Vite); backend uses same BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS for /api/cotizaciones.
- **Google Drive:** Save/load presupuestos via GoogleDrivePanel (Vite client + backend scope).

## Tech

- **Entry:** http://localhost:5173 (Vite dev); production build could be served from same host as API or 3849.
- **Stack:** React (Vite), PanelinCalculadoraV3_backup, GoogleDrivePanel, Budget Log, PDFPreviewModal; constants.js (PANELS_TECHO, PANELS_PARED), calculations.js, helpers.js, googleDrive.js.
- **Key files:** `src/App.jsx`, `src/components/PanelinCalculadoraV3_backup.jsx`, `src/components/GoogleDrivePanel.jsx`, `server/routes/calc.js`, `server/routes/legacyQuote.js`.

## Users / personas

- **Inferred:** Sales or technical staff building quotes for clients; need to save/load and export PDF. Not stated in docs.

## Current pain points

- **Observed:** Component naming drift (PanelinCalculadoraV3 vs _backup); App.jsx uses _backup (DASHBOARD-VISUAL-MAP.html says PanelinCalculadoraV3).
- **From IA report:** “Cotizaciones” overloaded (data vs section); no documented link from Shell/nav to open Calculadora; transition Calculadora ↔ Finanzas unclear.
- **From evaluation:** Calculadora (5173) not running during evaluation; /calc/cotizar and /calc/catalogo work when API is up.

## Dependencies

- **On Shell/Infra:** Needs a stable entry (e.g. “Cotizaciones” in nav) that opens either 5173 or a route in a unified app; needs VITE_API_URL pointing to API.
- **On Operaciones/Finanzas:** Same Sheets (Master_Cotizaciones, CRM) feed list/entregas; marcar-entregado moves rows to “Ventas realizadas y entregadas.”
- **On Invoque Panelin (future):** Contextual help in quote builder; possible “suggest quote” or validation.

## Uncertainties

- Whether “Administrador de Cotizaciones 2.0” is a separate UI or just Calculadora + list in Finanzas. Whether list of quotes should live inside Vite app or only in Operaciones/Finanzas. Canonical component name (V3 vs V3_backup).
