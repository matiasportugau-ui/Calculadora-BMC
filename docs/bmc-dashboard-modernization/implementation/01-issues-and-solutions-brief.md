# Phase 1 — Issues and solutions brief (Wave 1 & 2)

**Input:** Context briefs 01–06, FULL-IMPROVEMENT-PLAN, 02-investigation-and-discussion.  
**Purpose:** Expand context on what each step fixes, touchpoints, risks, and concrete acceptance before implementation.

---

## Wave 1 — Foundation

### Step 1.1 — Define and document BMC Dashboard IA

| Field | Content |
|-------|--------|
| **Issue** | No single source of truth for dashboard sections or hierarchy; naming overload (“dashboard” = product vs app vs 3849). (Context: 06-universe-shell-infra, IA report §3.) |
| **Solution** | Add one IA doc (e.g. `IA.md`) with sections: Inicio, Cotizaciones, Operaciones, Finanzas (KPI as sub-area), Ventas, Invoque Panelin; reference in map/README. |
| **Touchpoints** | **Create:** `docs/bmc-dashboard-modernization/IA.md`. **Optionally update:** DASHBOARD-VISUAL-MAP.md (link to IA), README (link to IA). |
| **Risks** | None; additive doc. |
| **Acceptance** | File `IA.md` exists; contains the six section names and “KPI = sub-area of Finanzas”; referenced from DASHBOARD-VISUAL-MAP or README. |
| **Dependencies** | None. |

### Step 1.2 — Resolve naming conventions in docs and code comments

| Field | Content |
|-------|--------|
| **Issue** | “Dashboard” used for whole product, for 3001/finanzas app, and for 3849; “Cotizaciones” used for data and section. (Context: 02-investigation §1.1, 01-universe-cotizaciones.) |
| **Solution** | In docs: “BMC Dashboard” = whole product only; “Finanzas” / “Operaciones” = sections; “Cotizaciones” = section (builder + list). Update DASHBOARD-VISUAL-MAP and any README. |
| **Touchpoints** | **Edit:** `docs/bmc-dashboard-modernization/DASHBOARD-VISUAL-MAP.md`, `docs/bmc-dashboard-modernization/DASHBOARD-VISUAL-MAP.html` (titles/legends). **Edit:** `.cursor/SETUP DASHBOARD /README.md` if it says “dashboard” ambiguously. **Edit:** `IA.md` (from 1.1) to state naming. |
| **Risks** | Low; doc-only. External links or bookmarks to “dashboard” may need a one-time clarification. |
| **Acceptance** | No ambiguous “dashboard” in updated docs; IA states Cotizaciones = section (builder + list). |
| **Dependencies** | 1.1 (IA exists so naming is written there). |

### Step 1.3 — Confirm single primary entry URL and document

| Field | Content |
|-------|--------|
| **Issue** | Multiple entry points (5173, 3001, 3001/finanzas, 3849); no documented “primary” URL for BMC Dashboard. (Context: 06-universe-shell-infra.) |
| **Solution** | Document primary URL: e.g. `http://localhost:3001` (and ngrok URL when used); root `/` redirects to `/finanzas`. Document in IA and in setup README. |
| **Touchpoints** | **Edit:** `IA.md` (add “Primary entry” section). **Edit:** `.cursor/SETUP DASHBOARD /README.md` or `docs/bmc-dashboard-modernization/` README if present (add “Primary URL” subsection). |
| **Risks** | None; documentation only. |
| **Acceptance** | IA (or linked doc) states primary entry URL; setup README mentions it. Root `/` and favicon behavior documented. |
| **Dependencies** | 1.1. |

### Step 1.4 — Add favicon and fix root route

| Field | Content |
|-------|--------|
| **Issue** | Ngrok report showed `/favicon.ico` 404 and `/` sometimes 404. (Context: IA report §8, 06-universe-shell-infra.) |
| **Solution** | Ensure GET `/` returns 302 to `/finanzas` for `Accept: text/html`; ensure `/favicon.ico` returns 200 or 204. Add favicon for dashboard page (e.g. in dashboard static or link in HTML). |
| **Touchpoints** | **Verify:** `server/index.js` already has `GET /favicon.ico` → 204 and `GET /` → redirect to `/finanzas` for HTML. **Add:** Favicon for `/finanzas` page: either `docs/bmc-dashboard-modernization/dashboard/favicon.ico` or `<link rel="icon">` in `dashboard/index.html`. |
| **Risks** | Low. If favicon.ico is binary, ensure it’s valid; else use inline SVG or data URI in HTML. |
| **Acceptance** | `curl -I http://localhost:3001/` with Accept: text/html → 302 Location /finanzas; `curl -I http://localhost:3001/favicon.ico` → 204 or 200. Dashboard page has favicon (link or file). |
| **Dependencies** | None. |

---

## Wave 2 — Shell & navigation

### Step 2.1 — Implement or document dashboard shell with nav

| Field | Content |
|-------|--------|
| **Issue** | No shared nav linking Cotizaciones, Operaciones, Finanzas, Ventas, Invoque Panelin. (Context: 02-investigation §1.1, 06-universe-shell-infra.) |
| **Solution** | Add top-level nav to the dashboard UI: Inicio | Cotizaciones | Operaciones | Finanzas | Ventas | Invoque Panelin. Each item has a target (route or link). Link-only for Cotizaciones (→ 5173) and placeholders for Ventas/Invoque is acceptable. |
| **Touchpoints** | **Edit:** `docs/bmc-dashboard-modernization/dashboard/index.html`: add `<nav>` with anchors/links; add `id="operaciones"`, `id="finanzas"` to existing sections; add placeholder blocks for Ventas and Invoque Panelin with `id="ventas"`, `id="invoque"`. **Edit:** `docs/bmc-dashboard-modernization/dashboard/styles.css`: styles for nav bar. **Optional:** `docs/bmc-dashboard-modernization/dashboard/app.js`: smooth scroll or highlight for hash. |
| **Risks** | Medium if we change URL structure (e.g. separate /operaciones, /finanzas); low if we keep single page and use #anchors. |
| **Acceptance** | One URL (e.g. 3001/finanzas) shows a shell with nav; each nav item has a target; Ventas and Invoque Panelin show placeholder content or anchor. |
| **Dependencies** | 1.1, 1.3. |

### Step 2.2 — Wire Cotizaciones into shell

| Field | Content |
|-------|--------|
| **Issue** | No link from dashboard to Calculadora (5173). (Context: 01-universe-cotizaciones, 02-investigation.) |
| **Solution** | Nav item “Cotizaciones” links to Vite app (e.g. `http://localhost:5173` in dev; configurable or same-origin in prod). Document in IA. |
| **Touchpoints** | **Edit:** `dashboard/index.html` (Cotizaciones link in nav). **Edit:** `IA.md` (user flow: “From dashboard, open Cotizaciones → builder”). |
| **Risks** | Link to 5173 in dev is fine; prod may need env-based URL or relative path if merged later. |
| **Acceptance** | From shell, user can open Cotizaciones and reach Calculadora (or placeholder); flow documented in IA. |
| **Dependencies** | 2.1. |

### Step 2.3 — Label Operaciones and Finanzas in shell

| Field | Content |
|-------|--------|
| **Issue** | Same page at /finanzas mixes Operaciones and Finanzas; no explicit labels in nav. (Context: 02-universe-operaciones, 03-universe-finanzas.) |
| **Solution** | Nav shows “Operaciones” and “Finanzas” as distinct items; scroll to #operaciones and #finanzas. KPI is not a top-level nav item (it’s under Finanzas). |
| **Touchpoints** | **Edit:** `dashboard/index.html` (nav labels, section ids already in 2.1). **Edit:** `IA.md` or dashboard doc: “KPI = sub-area of Finanzas.” |
| **Risks** | None. |
| **Acceptance** | Nav shows “Operaciones” and “Finanzas”; KPI is not a top-level item; docs state KPI under Finanzas. |
| **Dependencies** | 2.1, 1.1. |

---

## Handoff to Phase 2

- Use this brief to **judge** each step (feasibility, risk, effort) and to **refine** the implementation path (order, merges, splits).
- Touchpoints and acceptance are **concrete** for Phase 3 execution.
