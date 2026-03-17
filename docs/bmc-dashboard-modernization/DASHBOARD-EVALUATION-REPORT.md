# Dashboard Full Evaluation Report

**Date:** 2026-03-14  
**Method:** browser-agent-orchestration skill + curl API verification  
**Scope:** API endpoints, Finanzas dashboard UI, Panelin Evolution, Calc API, ML OAuth

---

## 1. Executive Summary

| Component | Status | Notes |
|-----------|--------|-------|
| API (port 3001) | ✅ Running | Health OK, calc OK |
| /finanzas dashboard | ✅ Loads | UI renders; Sheets data missing (service account) |
| Panelin Evolution (3847) | ❌ Not running | chrome-error |
| Calculadora Vite (5173) | ❌ Not running | chrome-error |
| Sheets API (cotizaciones, etc.) | ⚠️ Partial | Fails without service account; pagos/kpi return empty |
| ML OAuth | ⚠️ Pending | redirect_uri localhost on Cloud Run; tokens not stored |

---

## 2. API Endpoint Logs

### Health
```json
{"ok":true,"appEnv":"development","hasTokens":false,"hasSheets":false,"missingConfig":[]}
```

### /api/cotizaciones
```json
{"ok":false,"error":"The file at .../service-account.json does not exist, or it is not a file. ENOENT"}
```

### /api/proximas-entregas
```json
{"ok":false,"error":"...service-account.json does not exist..."}
```

### /api/pagos-pendientes
```json
{"ok":true,"data":[]}
```

### /api/kpi-financiero
Sin service account: **503**. Con Sheets OK: 200 con estructura completa.

### /calc/cotizar (POST)
- Valid payload (ISODEC_EPS 100mm, 6×5m): **OK** — returns BOM, resumen, total_usd
- Invalid espesor (50, 75): `{"ok":false,"error":"Espesor Xmm no disponible"}`

### /calc/catalogo
- **OK** — returns paneles_techo, paneles_pared, escenarios, borders, etc.

---

## 3. Dashboard UI Findings (Finanzas)

**URL:** http://localhost:3001/finanzas/

**Sections present:**
- Próximas entregas (table empty — API fails)
- Coordinación logística (WhatsApp buttons **disabled** — no data)
- KPIs financieros (Calendario, Pagos pendientes, Metas de ventas)
- Audit log
- Exportar CSV, Filtrar

**Variables / data flows:**
- `Master_Cotizaciones` → /api/cotizaciones, /api/proximas-entregas
- `Pagos_Pendientes` → /api/pagos-pendientes, /api/kpi-financiero
- `Metas_Ventas` → /api/metas-ventas, /api/kpi-financiero
- `AUDIT_LOG` → /api/audit
- `Ventas realizadas y entregadas` → target for marcar-entregado

---

## 4. Critical Issues

### 4.1 Service Account Missing
- **Impact:** cotizaciones, proximas-entregas, audit fail with 500
- **Fix:** Download service account JSON from Google Cloud (Sheets API), save to `docs/bmc-dashboard-modernization/service-account.json`
- **Verify:** Share spreadsheet with service account email as Editor

### 4.2 Inconsistent Error Handling (RESOLVED)
- **Implemented:** All Sheets endpoints now return **503** when backend unavailable (credentials missing, ENOENT, API error).
- **200 + empty:** Returned only when sheet exists but has no data (`data: []`).
- **Semantics:** 503 = Sheets backend not available; 200 + empty = no data in sheet.

### 4.3 PUBLIC_BASE_URL on Cloud Run
- Cloud Run `/auth/ml/start` returns `redirect_uri=localhost:3001` instead of `.run.app`
- **Cause:** PUBLIC_BASE_URL not set or overwritten by deploy
- **Fix:** Add to Cloud Run env vars; ensure GitHub Actions deploy preserves it

### 4.4 Panelin Evolution / Calculadora Not Running
- localhost:3847, 5173 → chrome-error (connection refused)
- **Fix:** Start Panelin Evolution collector/viewer and Vite dev server when evaluating dashboard

---

## 5. Architectural Improvements

### 5.1 Service Layer
- **Sheets client singleton:** Avoid re-auth per request; cache `google.auth` client
- **Health check granularity:** `/health` could report `sheetsOk`, `mlTokensOk` separately
- **Circuit breaker:** If Sheets API fails N times, return cached empty or 503 instead of retrying every request

### 5.2 API Consistency
- **Error format:** Standardize `{ ok, error?, errorCode?, details? }`
- **Empty vs error:** Decide: empty data = 200 + `data: []` vs 503 when backend unavailable

### 5.3 Dashboard Front
- **Loading states:** Show spinner/skeleton when API is loading; currently may show empty tables without feedback
- **Error display:** When /api/cotizaciones returns 500, show user-friendly message + retry
- **Offline / fallback:** Consider service worker or cached last-good data for resilience

### 5.4 Deployment
- **Env var persistence:** Cloud Run env vars set by `run_ml_cloud_run_setup.sh` may be overwritten by GitHub Actions deploy
- **Recommendation:** Add PUBLIC_BASE_URL, ML_*, TOKEN_* to deploy config (e.g. `cloudbuild.yaml`, GitHub Actions env)

### 5.5 Observability
- **Structured logs:** Already using pino; add `requestId` to all log lines for tracing
- **Metrics:** Consider `/metrics` (Prometheus) for request counts, latency, error rate
- **Dashboard health dashboard:** Single page that pings all endpoints and shows status

---

## 6. Service Improvements

| Service | Improvement |
|---------|-------------|
| **bmcDashboard.js** | Retry with backoff for Sheets API; cache sheet metadata (tab names) |
| **tokenStore (GCS)** | Already implemented; ensure TOKEN_ENCRYPTION_KEY in Cloud Run |
| **calc router** | Add request validation middleware; return 400 with field-level errors |
| **Finanzas UI** | Add "Reintentar" on API error; show last successful fetch time |

---

## 7. Proposed Solutions (Prioritized)

### P0 — Blocking
1. **Service account:** Create/download JSON, place in repo path, share sheet
2. **PUBLIC_BASE_URL:** Set in Cloud Run; verify with `?mode=json` on /auth/ml/start

### P1 — High
3. **Unified error handling:** 503 when Sheets unavailable; document behavior
4. **Dashboard error UI:** Show API error state with retry button

### P2 — Medium
5. **Health granularity:** `hasSheets`, `hasMlTokens` in /health
6. **Deploy env preservation:** Add critical vars to CI/CD config

### P3 — Nice to have
7. **Circuit breaker** for Sheets (pendiente)
8. **Metrics endpoint** (pendiente)
9. **Startup script** ✅ `./run_full_stack.sh` o `npm run dev:full-stack` — API + Vite + viewer (3847) si existe

---

## 8. Implementation Status (2026-03-14)

| Item | Status |
|------|--------|
| Phase 2.1 — Unified Sheets 503 | ✅ bmcDashboard.js |
| Phase 2.2 — Dashboard error UI | ✅ Banner, lastRefresh, Reintentar |
| Phase 3.1 — Health hasSheets | ✅ server/index.js |
| Phase 3.2 — Deploy env docs | ✅ ML-OAUTH-SETUP.md §8 |
| Phase 1.2 — PUBLIC_BASE_URL | ✅ run_ml_cloud_run_setup.sh, .env.example |
| Phase 4.1 — run_full_stack.sh | ✅ `npm run dev:full-stack` |

---

## 9. Verification Commands

```bash
# API health
curl -s http://localhost:3001/health | jq .

# Sheets-dependent (requires service account)
curl -s http://localhost:3001/api/cotizaciones | jq .ok
curl -s http://localhost:3001/api/proximas-entregas | jq .ok

# Calc (no Sheets)
curl -s "http://localhost:3001/calc/catalogo?lista=venta" | jq .ok
curl -s -X POST http://localhost:3001/calc/cotizar -H "Content-Type: application/json" \
  -d '{"escenario":"solo_techo","techo":{"familia":"ISODEC_EPS","espesor":100,"color":"Blanco","zonas":[{"largo":6,"ancho":5}]}}' | jq .ok

# ML OAuth (Cloud Run)
curl -s "https://panelin-calc-642127786762.us-central1.run.app/auth/ml/start?mode=json" | jq .authUrl
# Expect redirect_uri to contain .run.app, not localhost
```

---

## 10. Appendix: Dashboard Variables Reference

| Variable / Source | Endpoint | Purpose |
|-------------------|----------|---------|
| BMC_SHEET_ID | — | Spreadsheet ID for all Sheets API calls |
| GOOGLE_APPLICATION_CREDENTIALS | — | Path to service account JSON |
| Master_Cotizaciones | /api/cotizaciones | All cotizaciones |
| Master_Cotizaciones (filtered) | /api/proximas-entregas | Confirmados, FECHA_ENTREGA this week |
| Pagos_Pendientes | /api/pagos-pendientes | Pending payments |
| Metas_Ventas | /api/metas-ventas, /api/kpi-financiero | Sales targets |
| AUDIT_LOG | /api/audit | Change log |
| Ventas realizadas y entregadas | POST /api/marcar-entregado | Destination for delivered sales |
