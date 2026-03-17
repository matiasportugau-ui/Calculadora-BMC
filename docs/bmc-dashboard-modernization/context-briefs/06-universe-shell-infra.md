# Universe brief: Shell & Infra

**Source:** IA report, DASHBOARD-VISUAL-MAP, DASHBOARD-EVALUATION-REPORT, server/index.js, package.json, ngrok report.

---

## Scope

- **From docs/code:** (1) **Single entry URL** — today multiple: 5173 (Vite), 3001/finanzas (static), 3849 (standalone via sheets-api-server.js); (2) **Navigation** — no shared shell or nav in repo; (3) **Root and favicon** — server/index.js: GET / → redirect to /finanzas when Accept html, else 404 JSON; GET /favicon.ico → 204; (4) **ngrok** — tunnel to 3001; inspector 4040.
- **Directly observed:** Express serves /finanzas from `docs/bmc-dashboard-modernization/dashboard`; /api from bmcDashboard; /calc, legacyQuote, Shopify, ML routes. bmc-dashboard script runs a separate server (sheets-api-server.js) on 3849.

## Data

- **Env:** PORT, PUBLIC_BASE_URL, BMC_*, GOOGLE_APPLICATION_CREDENTIALS, VITE_*, ML_*, Shopify_*, LOG_LEVEL. config from server/config.js.
- **No persistent “nav config” in repo** — IA is proposed, not implemented.

## Tech

- **Entry points:** http://localhost:5173 (Vite), http://localhost:3001 (API), http://localhost:3001/finanzas (dashboard static), http://localhost:3849 (npm run bmc-dashboard = sheets-api-server.js), http://127.0.0.1:4040 (ngrok inspector).
- **Stack:** Express (index.js), static middleware for /finanzas, CORS, pino, security headers. Favicon and root implemented (redirect / to /finanzas for HTML).
- **Key files:** `server/index.js`, `server/config.js`, `package.json` (scripts), `docs/bmc-dashboard-modernization/sheets-api-server.js` (if exists for 3849).

## Users / personas

- **Inferred:** All users need one “front door”; ops need stable ngrok and health.

## Current pain points

- **From IA report:** Multiple entry points; no single “BMC Dashboard” shell; “Dashboard” naming overload (Finanzas vs standalone vs whole product). No nav linking Cotizaciones, Operaciones, Finanzas, Ventas, Invoque Panelin.
- **From ngrok report (user-provided):** GET / sometimes 200 sometimes 404; GET /favicon.ico 404. (Current code has / → redirect and favicon 204; report may be from before that fix.)
- **From evaluation:** Panelin Evolution (3847) and Calculadora (5173) not running during test; run_full_stack.sh / dev:full-stack exist.

## Dependencies

- **All modules** depend on Shell for entry and nav. Cotizaciones needs link to 5173 or unified app; Operaciones/Finanzas need /finanzas or sub-routes; Ventas and Invoque Panelin need future routes.

## Uncertainties

- Whether 3849 (sheets-api-server) is the intended “standalone” dashboard or a duplicate of 3001/finanzas. Exact cause of / 200 vs 404 in ngrok (Accept header, timing, or old deploy). Whether a single SPA will replace multiple origins or a shell will only link to them.
