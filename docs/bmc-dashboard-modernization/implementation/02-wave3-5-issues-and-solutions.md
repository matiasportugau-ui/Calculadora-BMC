# Phase 1 (continued) — Issues and solutions: Wave 3–5

**Input:** Context briefs, FULL-IMPROVEMENT-PLAN, EXECUTION-LOG (Wave 1–2 done).  
**Purpose:** Expand context for Steps 3.1–3.3, 4.2, 5.1–5.3 before implementation.

---

## Wave 3 — Module alignment

### Step 3.1 — Document user flow: Cotizaciones ↔ Operaciones / Finanzas

| Field | Content |
|-------|--------|
| **Issue** | No single doc describing how a quote flows from builder to entregas/KPI and how “marcar entregado” feeds Ventas. (Context: 01-universe-cotizaciones, 02-universe-operaciones.) |
| **Solution** | Write a short user-flow doc: build quote (Cotizaciones) → data in Master/CRM → Operaciones (próximas entregas) and Finanzas (KPI); marcar entregado → row moves to “Ventas realizadas y entregadas.” |
| **Touchpoints** | **Create:** `docs/bmc-dashboard-modernization/USER-FLOW.md` (or extend IA with a “User flow (detailed)” section). |
| **Risks** | None. |
| **Acceptance** | Doc exists; flow is clear for a reader. |
| **Dependencies** | 1.1, 2.2 (done). |

### Step 3.2 — Align component naming (PanelinCalculadoraV3)

| Field | Content |
|-------|--------|
| **Issue** | PanelinCalculadoraV3.jsx and PanelinCalculadoraV3_backup.jsx both exist; App.jsx uses _backup; DASHBOARD-VISUAL-MAP inconsistent. (Context: 01-universe-cotizaciones.) |
| **Solution** | Decide canonical name and document: “Canonical Calculadora component in use: PanelinCalculadoraV3_backup (Drive + Budget Log). PanelinCalculadoraV3.jsx = alternate single-file build.” Update IA and map; add comment in App.jsx. No file rename this pass to avoid breakage. |
| **Touchpoints** | **Edit:** `docs/bmc-dashboard-modernization/IA.md` (add “Calculadora component” line). **Edit:** `DASHBOARD-VISUAL-MAP.md` §5 (component name). **Edit:** `src/App.jsx` (one-line comment). |
| **Risks** | Low; doc-only. File rename deferred. |
| **Acceptance** | Single canonical name documented; no _backup ambiguity in docs. |
| **Dependencies** | None. |

### Step 3.3 — Clarify KPI under Finanzas in UI and docs

| Field | Content |
|-------|--------|
| **Issue** | KPI must be clearly a sub-area of Finanzas, not a top-level section. (Context: 03-universe-finanzas, already done in nav/section in Task C.) |
| **Solution** | Ensure Finanzas view and docs state “KPI = sub-area of Finanzas.” Nav and section kicker already updated in Wave 2; add explicit sentence in IA if missing. |
| **Touchpoints** | **Edit:** `IA.md` (already has “KPI = sub-area of Finanzas”; verify). **Edit:** dashboard section kicker already “Finanzas (KPI)”. |
| **Risks** | None. |
| **Acceptance** | Finanzas view and docs present KPI as part of Finanzas. |
| **Dependencies** | 1.1, 2.3 (done). |

---

## Wave 4 — Invoque Panelin (4.2 only; 4.1 done)

### Step 4.2 — Define transversal entry points for Invoque Panelin

| Field | Content |
|-------|--------|
| **Issue** | Where “Ask Panelin” or equivalent will appear (header vs per-section) not specified. (Context: 05-universe-invoque-panelin.) |
| **Solution** | Document in IA: which modules get transversal entry (Cotizaciones, Operaciones, Finanzas) and where (e.g. “Floating button in shell header” or “Per-section button”). No implementation. |
| **Touchpoints** | **Edit:** `docs/bmc-dashboard-modernization/IA.md` — add “Transversal entry points” under Invoque Panelin. |
| **Risks** | None. |
| **Acceptance** | Doc lists modules and suggested placement. |
| **Dependencies** | 4.1 (done). |

---

## Wave 5 — Polish & operations

### Step 5.1 — Dashboard error UI and loading states (verify)

| Field | Content |
|-------|--------|
| **Issue** | Confirm error banner, “Reintentar,” lastRefresh, and loading state exist when /api/* fails. (Context: DASHBOARD-EVALUATION-REPORT §5.3.) |
| **Solution** | Verify in dashboard app.js: setStateBanner(loading|empty|error), btnRetry, lastRefresh, renderLoadingShell. Document finding. |
| **Touchpoints** | **Read:** `docs/bmc-dashboard-modernization/dashboard/app.js`. **Edit:** `implementation/EXECUTION-LOG.md` or add “Dashboard UX” note in IA/docs. |
| **Risks** | None. |
| **Acceptance** | Verified and documented; if something missing, add minimal loading/error handling. |
| **Dependencies** | None. |

### Step 5.2 — Health and deploy config (verify)

| Field | Content |
|-------|--------|
| **Issue** | /health should report hasSheets; deploy should preserve PUBLIC_BASE_URL and critical env. (Context: evaluation report §5.4, §7.) |
| **Solution** | Verify /health includes hasSheets (and hasTokens); document deploy env preservation in ML-OAUTH-SETUP or equivalent. |
| **Touchpoints** | **Read:** `server/index.js` (health handler). **Edit:** `docs/ML-OAUTH-SETUP.md` or `IA.md` or README — add “Deploy: preserve PUBLIC_BASE_URL, BMC_*, GOOGLE_APPLICATION_CREDENTIALS.” |
| **Risks** | None. |
| **Acceptance** | /health response includes hasSheets; deploy docs mention env preservation. |
| **Dependencies** | None. |

### Step 5.3 — Decide and document 3849 vs 3001/finanzas

| Field | Content |
|-------|--------|
| **Issue** | Relationship between npm run bmc-dashboard (3849) and 3001/finanzas unclear. (Context: 06-universe-shell-infra.) |
| **Solution** | Document: 3001/finanzas = canonical Operaciones/Finanzas view (served by main Express). 3849 = standalone server (sheets-api-server.js) for when API is not run; recommend 3001 as primary. |
| **Touchpoints** | **Edit:** `IA.md` or `DASHBOARD-VISUAL-MAP.md` — add “3849 vs 3001” subsection. |
| **Risks** | None. |
| **Acceptance** | Doc states relationship and which URL to use. |
| **Dependencies** | 1.1 (done). |
