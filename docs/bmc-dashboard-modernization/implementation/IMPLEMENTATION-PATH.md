# Refined implementation path (Phase 2)

**Input:** 01-issues-and-solutions-brief.md, FULL-IMPROVEMENT-PLAN.  
**Purpose:** Judged solutions, optional merges/reorder, concrete task list for execution.

---

## Judgment summary (per plan step)

| Step | Feasibility | Risk | Effort | Notes |
|------|-------------|------|--------|--------|
| 1.1 | Y | Low | S | Additive doc; no code. |
| 1.2 | Y | Low | S | Doc edits only; can merge with 1.1 (IA + naming in one pass). |
| 1.3 | Y | Low | S | Doc only; can merge with 1.1. |
| 1.4 | Y | Low | S | Root/favicon already in server; add favicon for /finanzas page. |
| 2.1 | Y | Medium | M | Single-page nav + anchors + placeholders; no new routes. |
| 2.2 | Y | Low | S | One link in nav + IA sentence; depends on 2.1. |
| 2.3 | Y | Low | S | Same nav/section ids as 2.1; can do with 2.1 in one edit. |

**Improvements applied:**

- **Merge 1.1 + 1.2 + 1.3** into one task: create IA.md with sections, naming rules, and primary URL. Then do 1.2 doc updates (DASHBOARD-VISUAL-MAP, README) in same wave.
- **Order 1.4** with 1.x: can run in parallel; do after IA so we can document “favicon and root” in IA.
- **Merge 2.1 + 2.2 + 2.3** into one task: add shell nav (with Cotizaciones link and Operaciones/Finanzas/Ventas/Invoque labels and targets) in a single dashboard edit; update IA with user flow and KPI-under-Finanzas.

---

## Task list (execution order)

### Task A — Wave 1: IA and naming (Steps 1.1, 1.2, 1.3)

| Field | Value |
|-------|--------|
| **ID** | A |
| **Title** | Create IA.md and resolve naming; document primary URL |
| **Touchpoints** | Create `docs/bmc-dashboard-modernization/IA.md`. Edit `DASHBOARD-VISUAL-MAP.md` (and .html if needed), `.cursor/SETUP DASHBOARD /README.md` to use “BMC Dashboard” / “Finanzas” / “Operaciones” / “Cotizaciones” consistently; add link to IA. |
| **Acceptance** | IA.md exists with 6 sections, KPI under Finanzas, naming rules, primary entry URL. Map/README reference IA and use consistent terms. |
| **Owner** | Shell & Infra |
| **Effort** | S |

### Task B — Wave 1: Favicon and root (Step 1.4)

| Field | Value |
|-------|--------|
| **ID** | B |
| **Title** | Ensure favicon and root route; add favicon for dashboard page |
| **Touchpoints** | Verify server/index.js (root redirect, /favicon.ico 204). Add favicon for /finanzas: e.g. `<link rel="icon">` in dashboard/index.html or favicon.ico in dashboard folder. Document in IA (one line). |
| **Acceptance** | GET / → 302 to /finanzas for HTML; GET /favicon.ico → 204; dashboard page has icon. |
| **Owner** | Shell & Infra |
| **Effort** | S |

### Task C — Wave 2: Shell with nav and Cotizaciones + labels (Steps 2.1, 2.2, 2.3)

| Field | Value |
|-------|--------|
| **ID** | C |
| **Title** | Add dashboard shell nav and wire Cotizaciones; label Operaciones/Finanzas |
| **Touchpoints** | Edit `docs/bmc-dashboard-modernization/dashboard/index.html`: add `<nav>` (Inicio, Cotizaciones→5173, Operaciones→#operaciones, Finanzas→#finanzas, Ventas→#ventas, Invoque Panelin→#invoque); add id="operaciones", id="finanzas" to sections; add placeholder sections for #ventas, #invoque. Edit dashboard/styles.css for nav. Edit IA.md: user flow (Cotizaciones → builder), KPI under Finanzas. |
| **Acceptance** | One URL shows shell with nav; each item has target; Cotizaciones links to 5173; Operaciones/Finanzas scroll to sections; Ventas/Invoque show placeholder. IA updated. |
| **Owner** | Shell & Infra, Cotizaciones (link target) |
| **Effort** | M |

---

## Execution order

1. **Task A** (IA + naming + primary URL)  
2. **Task B** (favicon + root verify)  
3. **Task C** (shell nav + Cotizaciones + labels)

**Assumptions:** Dashboard static lives in `docs/bmc-dashboard-modernization/dashboard/`; server serves it at `/finanzas`. Cotizaciones link uses `http://localhost:5173` for dev (can be made configurable later). No new Express routes in this pass.

**Deferred (done in Wave 3–5 pass):** Steps 3.x, 4.2, 5.x — see below.

---

## Task D — Wave 3: User flow doc (Step 3.1)

| Field | Value |
|-------|--------|
| **ID** | D |
| **Title** | Document user flow Cotizaciones ↔ Operaciones / Finanzas |
| **Touchpoints** | Create `docs/bmc-dashboard-modernization/USER-FLOW.md` with flow: builder → Master/CRM → entregas & KPI; marcar entregado → Ventas realizadas. |
| **Acceptance** | Doc exists; flow clear. |
| **Owner** | Cotizaciones, Operaciones, Shell |
| **Effort** | S |

## Task E — Wave 3: Component naming + KPI in docs (Steps 3.2, 3.3)

| Field | Value |
|-------|--------|
| **ID** | E |
| **Title** | Align component naming; clarify KPI under Finanzas in docs |
| **Touchpoints** | IA.md: add canonical Calculadora component (PanelinCalculadoraV3_backup). DASHBOARD-VISUAL-MAP.md §5: same. App.jsx: one-line comment. Verify IA “KPI = sub-area of Finanzas.” |
| **Acceptance** | Single canonical name in docs; KPI under Finanzas stated. |
| **Owner** | Cotizaciones, Finanzas, Shell |
| **Effort** | S |

## Task F — Wave 4: Transversal entry points (Step 4.2)

| Field | Value |
|-------|--------|
| **ID** | F |
| **Title** | Define transversal entry points for Invoque Panelin |
| **Touchpoints** | Edit IA.md: add “Transversal entry points” under Invoque Panelin (modules: Cotizaciones, Operaciones, Finanzas; placement: e.g. shell header or per-section). |
| **Acceptance** | Doc lists modules and suggested placement. |
| **Owner** | Invoque Panelin |
| **Effort** | S |

## Task G — Wave 5: Verify error/loading, health, 3849 vs 3001 (Steps 5.1, 5.2, 5.3)

| Field | Value |
|-------|--------|
| **ID** | G |
| **Title** | Verify dashboard error/loading; health and deploy docs; 3849 vs 3001 |
| **Touchpoints** | Verify app.js (stateBanner, Retry, lastRefresh, renderLoadingShell). Verify /health has hasSheets. Add deploy env note (ML-OAUTH-SETUP or IA). Document 3849 vs 3001 in IA or map. |
| **Acceptance** | Verified and documented. |
| **Owner** | Shell, Operaciones/Finanzas |
| **Effort** | S |
