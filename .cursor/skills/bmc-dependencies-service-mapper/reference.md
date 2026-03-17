# BMC Dependencies & Service Mapper — Reference

## Dependency graph (template)

| Module | Depends on (env) | Depends on (APIs/Sheets) | Depends on (other modules) | Gaps |
|--------|-------------------|---------------------------|----------------------------|------|
| Cotizaciones | VITE_API_URL, VITE_GOOGLE_CLIENT_ID | /api/cotizaciones, Sheets Master/CRM, Google Drive | Shell (nav link) | — |
| Operaciones | — | bmcDashboard routes, Sheets | Shell, Finanzas (UI) | — |
| Finanzas | — | bmcDashboard routes, Pagos_Pendientes, Metas_Ventas | Shell | — |
| Ventas | — | Sheets "Ventas realizadas y entregadas" | Shell, Operaciones (marcar-entregado) | — |
| Invoque Panelin | — | GPT/OpenAI, future hooks | All (transversal) | — |
| Shell & Infra | BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS, etc. | 3001, 5173, 3849, ngrok | All | — |

Fill from context briefs and `server/`, `src/`, env docs. Add a **Gaps** column for missing or inconsistent deps.

## Service map (template)

| Service | Type | Entry point | Contract (key) | Health / check | Owner |
|---------|------|-------------|---------------|----------------|-------|
| API (Express) | Backend | http://localhost:3001 | REST routes under /api, /calc | GET /health | Shell & Infra |
| Vite (Calculadora) | Frontend | http://localhost:5173 | Quote builder, Drive | — | Cotizaciones |
| Dashboard (Finanzas/Operaciones) | Frontend | http://localhost:3001/finanzas, 3849 | HTML + API calls | — | Finanzas, Operaciones |
| Sheets API | Integration | Via bmcDashboard.js | values.get, values.append, batchUpdate | Sheets configured | All |
| ngrok | Infra | Optional tunnel | — | — | Shell & Infra |

Add rows for legacyQuote, calc router, ML/Shopify if present. Ensure ports 5173, 3001, 3849 and primary entry (3001 → /finanzas) are consistent.

## Integration checklist (template)

| From | To | Integration | Status |
|------|-----|-------------|--------|
| Shell nav | Cotizaciones | Link to 5173 or route | OK / gap / needs config |
| Shell | Operaciones / Finanzas | Anchors #operaciones, #finanzas | OK |
| bmcDashboard | Sheets | BMC_SHEET_ID, credentials | OK / gap |
| Operaciones | Finanzas | Shared Sheets, UI blocks | OK |
| marcar-entregado | Ventas sheet | Append row, delete from Master | OK / gap |

Use to validate that all integration points are documented and working.
