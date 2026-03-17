# BMC Dashboard — Full Improvement Plan (Step by Step)

**Input:** Phase 1 universe briefs, Phase 2 investigation and discussion, BMC-DASHBOARD-IA-REVIEW-REPORT.  
**Output:** Single ordered improvement plan with steps, owners, dependencies, acceptance criteria, and waves.

---

## Goals

1. **BMC Dashboard as single main business frontend** — one primary entry URL and one conceptual product.
2. **Clear IA and navigation** — Inicio | Cotizaciones | Operaciones | Finanzas | Ventas | Invoque Panelin; KPI under Finanzas.
3. **One primary entry URL** — no naming overload; “Dashboard” = whole product.
4. **Invoque Panelin hybrid** — standalone section + transversal entry points in other modules.

---

## How to use this plan

- **Execute steps in numerical order** within each wave; complete a wave before starting the next unless a step explicitly allows parallel work.
- **Dependencies** are listed per step; do not start a step until its dependencies are done.
- **Owner** is the universe (or “Shell + X”) responsible for the deliverable; implementation may be code, config, or docs as specified.
- **Acceptance** must be verifiable (doc exists, route works, nav shows, etc.).

---

## Wave 1 — Foundation

### Step 1.1 — Define and document BMC Dashboard IA

- **Owner:** Shell & Infra (with input from all modules)
- **Description:** Add a single source of truth for sections and hierarchy. Include: Inicio, Cotizaciones, Operaciones, Finanzas (with KPI as sub-area), Ventas, Invoque Panelin. Document in repo (e.g. `docs/bmc-dashboard-modernization/IA.md` or extend DASHBOARD-VISUAL-MAP).
- **Depends on:** —
- **Acceptance:** IA doc in repo; agreed section names and hierarchy; referenced in README or map.
- **Impact:** H | **Complexity:** M

### Step 1.2 — Resolve naming conventions in docs and code comments

- **Owner:** Shell & Infra (docs), Cotizaciones (component naming)
- **Description:** (1) Use “BMC Dashboard” only for the whole product; “Finanzas” and “Operaciones” for sections/content at 3001/finanzas. (2) Use “Cotizaciones” for the section (builder + list), not for “data only.” Update DASHBOARD-VISUAL-MAP, IA doc, and any README that says “dashboard” ambiguously.
- **Depends on:** 1.1
- **Acceptance:** No ambiguous “dashboard” in new/updated docs; Cotizaciones section definition written in IA.
- **Impact:** M | **Complexity:** L

### Step 1.3 — Confirm single primary entry URL and document

- **Owner:** Shell & Infra
- **Description:** Decide and document the single primary URL for “BMC Dashboard” (e.g. ngrok URL or https://… that redirects to the main shell). Document in IA and in setup/run docs (e.g. SETUP DASHBOARD README). If root / and favicon are already correct (redirect + 204), confirm and document; if ngrok still sees 404, add explicit favicon asset and ensure root returns 200 for browser Accept: text/html.
- **Depends on:** 1.1
- **Acceptance:** Doc states primary URL; root and favicon behave correctly for browser requests (200 or redirect for /, 200/204 for favicon).
- **Impact:** H | **Complexity:** L

### Step 1.4 — Add favicon and fix root route (if not already done)

- **Owner:** Shell & Infra
- **Description:** Ensure GET / returns 200 (or redirect to /finanzas) for HTML requests; ensure /favicon.ico returns 200 or 204. Add favicon.ico to dashboard static or to Express if missing. Address ngrok report: no 404 on favicon or root for normal browser load.
- **Depends on:** —
- **Acceptance:** curl/wget or browser to primary URL: / gives redirect or 200; /favicon.ico gives 200/204.
- **Impact:** M | **Complexity:** L

---

## Wave 2 — Shell & navigation

### Step 2.1 — Implement or document dashboard shell with nav

- **Owner:** Shell & Infra
- **Description:** Either (a) implement a minimal shell (HTML/SPA) that shows top-level nav: Inicio | Cotizaciones | Operaciones | Finanzas | Ventas | Invoque Panelin, and mounts or links to each section, or (b) document the shell design and URL structure (e.g. /finanzas for Operaciones+Finanzas, link to 5173 for Cotizaciones until merged). Ensure one entry URL serves this shell.
- **Depends on:** 1.1, 1.3
- **Acceptance:** One URL shows a shell with nav; each nav item has a target (route or link). Doc updated if shell is “link-only” for now.
- **Impact:** H | **Complexity:** H (if full shell) / M (if link-only)

### Step 2.2 — Wire Cotizaciones into shell

- **Owner:** Shell & Infra, Cotizaciones
- **Description:** Nav item “Cotizaciones” leads to quote builder (and optionally list). If shell is link-only: link to Vite app (5173 or same-origin path). If unified SPA: add route to Calculadora view. Document user flow: “From dashboard, open Cotizaciones → builder (and list if in same app).”
- **Depends on:** 2.1
- **Acceptance:** From shell, user can reach Calculadora (and list if applicable). Flow documented in IA or user-flow doc.
- **Impact:** H | **Complexity:** M

### Step 2.3 — Label Operaciones and Finanzas in shell

- **Owner:** Shell & Infra, Operaciones, Finanzas
- **Description:** In shell nav, “Operaciones” and “Finanzas” are distinct items. If both live under same app at /finanzas, use tabs or hash routes (e.g. /finanzas#operaciones, /finanzas#finanzas) or sub-paths (e.g. /operaciones, /finanzas) and document. KPI is under Finanzas only.
- **Depends on:** 2.1, 1.1
- **Acceptance:** Nav shows “Operaciones” and “Finanzas”; user can reach each; KPI is not a top-level item.
- **Impact:** M | **Complexity:** M

---

## Wave 3 — Module alignment

### Step 3.1 — Document user flow: Cotizaciones ↔ Operaciones / Finanzas

- **Owner:** Cotizaciones, Operaciones, Shell
- **Description:** Write short user-flow doc: how a user moves from building a quote (Cotizaciones) to seeing it in próximas entregas (Operaciones) or KPI (Finanzas); how “marcar entregado” flows to Ventas realizadas. Include in IA or docs/bmc-dashboard-modernization.
- **Depends on:** 1.1, 2.2
- **Acceptance:** Doc exists; flow is clear for a reader.
- **Impact:** M | **Complexity:** M

### Step 3.2 — Align component naming (PanelinCalculadoraV3)

- **Owner:** Cotizaciones
- **Description:** Decide canonical name: PanelinCalculadoraV3 or PanelinCalculadoraV3_backup. Update App.jsx and any imports to use one name; rename file if needed. Update DASHBOARD-VISUAL-MAP and IA to reference the chosen name.
- **Depends on:** —
- **Acceptance:** Single canonical component name in code and docs; no _backup ambiguity.
- **Impact:** L | **Complexity:** L

### Step 3.3 — Clarify KPI under Finanzas in UI and docs

- **Owner:** Finanzas, Shell
- **Description:** In Finanzas section, ensure “KPI” or “KPIs financieros” is clearly a sub-area (tabs, sidebar, or section label). Update docs to state “KPI = sub-area of Finanzas.”
- **Depends on:** 1.1, 2.3
- **Acceptance:** Finanzas view and docs present KPI as part of Finanzas, not a separate section.
- **Impact:** M | **Complexity:** L

---

## Wave 4 — Invoque Panelin

### Step 4.1 — Add Invoque Panelin to IA and nav (placeholder)

- **Owner:** Shell & Infra, Invoque Panelin
- **Description:** Add “Invoque Panelin” to the IA doc and to shell nav as a top-level item. Target can be placeholder (e.g. “Coming soon” or minimal chat container). Document hybrid model: standalone section + future transversal entry points in Cotizaciones, Operaciones, Finanzas.
- **Depends on:** 1.1, 2.1
- **Acceptance:** IA and nav include Invoque Panelin; hybrid role documented; placeholder or minimal UI reachable from nav.
- **Impact:** H | **Complexity:** L

### Step 4.2 — Define transversal entry points for Invoque Panelin

- **Owner:** Invoque Panelin, Cotizaciones, Operaciones, Finanzas
- **Description:** Specify where “Ask Panelin” or equivalent appears: e.g. header of shell, or per-section (Cotizaciones, Operaciones, Finanzas). Document in IA or Invoque Panelin brief; no implementation required in this step.
- **Depends on:** 4.1
- **Acceptance:** Doc lists which modules get transversal entry and where (e.g. “Floating button in header” or “Per-section button”).
- **Impact:** H | **Complexity:** M (implementation later)

---

## Wave 5 — Polish & operations

### Step 5.1 — Dashboard error UI and loading states (verify)

- **Owner:** Operaciones, Finanzas (dashboard front)
- **Description:** Evaluation report notes error banner, “Reintentar,” lastRefresh. Verify these exist and work when /api/* returns 503 or error. Add loading states if missing.
- **Depends on:** —
- **Acceptance:** When API fails, user sees clear message and retry; loading indicated while fetching.
- **Impact:** M | **Complexity:** L

### Step 5.2 — Health and deploy config (verify)

- **Owner:** Shell & Infra
- **Description:** Verify /health reports hasSheets (and hasMlTokens if applicable); verify deploy/Cloud Run preserves PUBLIC_BASE_URL and critical env vars. Document in ML-OAUTH-SETUP or equivalent.
- **Depends on:** —
- **Acceptance:** /health response includes hasSheets; deploy docs mention env preservation.
- **Impact:** M | **Complexity:** L

### Step 5.3 — Decide and document 3849 vs 3001/finanzas

- **Owner:** Shell & Infra
- **Description:** Clarify whether `npm run bmc-dashboard` (3849) is the same app as 3001/finanzas or a different one. Document in IA or DASHBOARD-VISUAL-MAP; recommend one as canonical for “Operaciones/Finanzas” view if they duplicate.
- **Depends on:** 1.1
- **Acceptance:** Doc states relationship and which URL to use for dashboard content.
- **Impact:** M | **Complexity:** L

---

## Step list (ordered by dependency)

| ID    | Step                                      | Owner              | Depends | Impact | Complexity |
|-------|-------------------------------------------|--------------------|---------|--------|------------|
| 1.1   | Define and document BMC Dashboard IA      | Shell (+ all)      | —       | H      | M          |
| 1.2   | Resolve naming in docs                    | Shell, Cotizaciones| 1.1     | M      | L          |
| 1.3   | Confirm single primary entry URL         | Shell              | 1.1     | H      | L          |
| 1.4   | Add favicon and fix root route           | Shell              | —       | M      | L          |
| 2.1   | Implement or document shell with nav     | Shell              | 1.1, 1.3| H      | H/M        |
| 2.2   | Wire Cotizaciones into shell             | Shell, Cotizaciones| 2.1     | H      | M          |
| 2.3   | Label Operaciones and Finanzas in shell  | Shell, Op, Fin     | 2.1, 1.1| M     | M          |
| 3.1   | Document user flow Cotiz ↔ Op/Fin        | Cotiz, Op, Shell   | 1.1, 2.2| M     | M          |
| 3.2   | Align component naming (V3)              | Cotizaciones       | —       | L      | L          |
| 3.3   | Clarify KPI under Finanzas               | Finanzas, Shell    | 1.1, 2.3| M     | L          |
| 4.1   | Add Invoque Panelin to IA and nav        | Shell, Invoque     | 1.1, 2.1| H     | L          |
| 4.2   | Define transversal entry points           | Invoque, Op, Fin, Cotiz | 4.1  | H      | M          |
| 5.1   | Verify dashboard error UI and loading    | Op, Fin            | —       | M      | L          |
| 5.2   | Verify health and deploy config           | Shell              | —       | M      | L          |
| 5.3   | Decide 3849 vs 3001/finanzas             | Shell              | 1.1     | M      | L          |

---

## Summary

- **Wave 1** establishes IA, naming, and entry (and favicon/root).  
- **Wave 2** delivers the shell and nav and wires Cotizaciones, Operaciones, Finanzas.  
- **Wave 3** aligns modules (user flow, component name, KPI under Finanzas).  
- **Wave 4** adds Invoque Panelin to IA and nav and defines transversal entry points.  
- **Wave 5** verifies error UX, health/deploy, and 3849 vs 3001.

Execute in order; complete each wave before the next unless a step is explicitly marked parallel. Owners are by universe; implementation can be docs-only where specified.
