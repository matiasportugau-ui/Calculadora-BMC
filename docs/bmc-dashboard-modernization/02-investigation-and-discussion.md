# Phase 2 — Investigation and Discussion

**Input:** All Phase 1 universe briefs (01–06), BMC-DASHBOARD-IA-REVIEW-REPORT.md, DASHBOARD-VISUAL-MAP, DASHBOARD-EVALUATION-REPORT.  
**Output:** Investigation summary (gaps, dependencies, conflicts) and discussion summary (resolutions, ownership, priorities).

---

## 1. Investigation summary

### 1.1 Gaps (missing flows, duplicate concepts, naming collisions)

| Gap | Source briefs | Description |
|-----|----------------|-------------|
| **No single nav or shell** | 06, 01, 02, 03 | No shared top-level navigation linking Cotizaciones, Operaciones, Finanzas, Ventas, Invoque Panelin. Users must know 5173 vs 3001/finanzas. |
| **Cotizaciones: builder vs list** | 01, 02 | Quote **builder** is Vite (5173); quote **list** is inside Finanzas UI (3001/finanzas) via /api/cotizaciones. No single “Cotizaciones” view that combines both; no link from dashboard to Calculadora. |
| **“Dashboard” overloaded** | 06, 02, 03 | Term used for: (a) whole product “BMC Dashboard,” (b) Finanzas static app at /finanzas, (c) “Dashboard standalone” (3849). Naming collision. |
| **KPI vs Finanzas** | 03, IA report | Finanzas UI already has “KPIs financieros.” Planned “KPI” section duplicates; scope not split (KPI as sub-area of Finanzas vs separate). |
| **Operaciones vs Finanzas same URL** | 02, 03 | Single app at /finanzas contains both Operaciones blocks (entregas, logística, audit) and Finanzas blocks (KPI, pagos, metas). No URL or nav distinction. |
| **Ventas: no UI** | 04 | “Ventas 2.0” is placeholder; only backend (Ventas realizadas sheet, ML/Shopify). No Ventas route or view. |
| **Invoque Panelin: no implementation** | 05 | No route, no component, no doc in map. Only IA recommendation (hybrid). |
| **Component naming** | 01 | PanelinCalculadoraV3 vs PanelinCalculadoraV3; App.jsx uses _backup; map inconsistent. |
| **3849 vs 3001/finanzas** | 06, 02 | Two “dashboard” servers: main Express serves /finanzas; bmc-dashboard script runs sheets-api-server.js on 3849. Relationship (same app? different?) unclear. |

### 1.2 Dependencies

| Dependency | From → To | Notes |
|------------|-----------|--------|
| **Shell exposes nav** | All modules → Shell | Every section (Cotizaciones, Operaciones, Finanzas, Ventas, Invoque Panelin) needs a nav item and route. Shell owns the contract for “one entry + nav.” |
| **Operaciones & Finanzas share app** | 02, 03 → Shell | Same static app; Shell could expose “Operaciones” and “Finanzas” as tabs or sub-routes of one “Dashboard” view, or split later. |
| **Operaciones & Finanzas share Sheets** | 02, 03 → bmcDashboard | Same credentials, same BMC_SHEET_ID; bmcDashboard owns Sheets API. |
| **Cotizaciones list data** | 01 → bmcDashboard | /api/cotizaciones feeds Operaciones/Finanzas UI; Calculadora (Vite) does not call it for list. Cotizaciones “section” may need to embed or link to both builder and list. |
| **Marcar entregado → Ventas** | 02 → 04 | Operaciones writes “Ventas realizadas y entregadas”; Ventas universe will consume that data when UI exists. |
| **Invoque Panelin transversal** | 05 → 01, 02, 03 | Assistant needs entry points in Cotizaciones, Operaciones, Finanzas (and later Ventas). Those modules must expose a hook (e.g. “Ask Panelin” button). |
| **VITE_API_URL** | 01 → Shell/Infra | Calculadora (Vite) needs API base URL; in unified app, same origin or config. |

### 1.3 Conflicts

| Conflict | Resolution proposed (discussion below) |
|----------|----------------------------------------|
| **Two entry points for “dashboard”** | Use “BMC Dashboard” only for the whole product; one primary URL (e.g. 3001 or ngrok); “Finanzas” and “Operaciones” are sections, not “the dashboard.” |
| **KPI vs Finanzas scope** | KPI = sub-area of Finanzas (nav: “Finanzas” with sub “KPI” or single Finanzas view that includes KPI). No separate top-level “KPI.” |
| **Cotizaciones = data vs section** | “Cotizaciones” = section name for “quote builder + list/admin.” Data names: Master_Cotizaciones, /api/cotizaciones stay as-is. In nav: one “Cotizaciones” that leads to builder and/or list. |
| **Root / and favicon** | Code already has / → redirect to /finanzas for HTML, favicon 204. If ngrok still sees 404, confirm deploy and Accept header; add explicit favicon.ico file if needed. |

### 1.4 Mapping IA report improvements to universes and order

| IA report §7 improvement | Owner universe(s) | Implementation order |
|--------------------------|-------------------|------------------------|
| Define and document BMC Dashboard IA | Shell (with input all) | 1 |
| Unify entry point; one URL + shell with nav | Shell | 2 |
| Resolve naming (Dashboard, Finanzas, Cotizaciones) | Shell, docs | 3 |
| Add Invoque Panelin to IA (hybrid) | Shell, Invoque Panelin | 4 |
| Clarify KPI vs Finanzas | Finanzas, Shell | 5 |
| Document user flow (Calculadora ↔ Operaciones/Finanzas) | Cotizaciones, Operaciones, Shell | 6 |
| Align component naming (V3 vs _backup) | Cotizaciones | 7 |
| Favicon and root route | Shell | 8 |

---

## 2. Discussion summary

### 2.1 Resolutions (agreed)

- **“BMC Dashboard”** = the single product (one frontend). **“Finanzas”** = section (current 3001/finanzas content). **“Operaciones”** = section (entregas, logística, audit). **“Cotizaciones”** = section (Calculadora + list). No overload: “dashboard” in UI/docs = whole product only.
- **KPI:** Treated as **sub-area of Finanzas**. Nav: one “Finanzas” item; inside it, KPI (pagos, metas, calendar). No separate top-level “KPI.”
- **Invoque Panelin:** **Hybrid** confirmed: (1) Standalone section (top-level “Invoque Panelin”); (2) Transversal: first entry points in Cotizaciones, Operaciones, Finanzas (e.g. “Ask Panelin” in header or per-section).
- **Single entry:** One primary URL (e.g. ngrok or 3001) that serves or redirects to the main shell; shell provides nav to Cotizaciones, Operaciones, Finanzas, Ventas, Invoque Panelin. 5173 can remain as dev entry for Vite or be merged into shell later.
- **Ventas:** Kept as placeholder section in nav; scope (pipeline, channels, “Ventas realizadas” view) TBD. Ownership: Ventas universe when implemented.

### 2.2 Ownership (who owns which contract)

| Contract | Owner |
|----------|--------|
| Nav structure, entry URL, favicon, root route | Shell & Infra |
| Sheets API, CRM mapping, bmcDashboard routes | bmcDashboard (shared by Operaciones + Finanzas) |
| Calculadora UI, quote builder, Drive, list view placement | Cotizaciones |
| Finanzas UI blocks (KPI, pagos, metas), Finanzas “section” | Finanzas |
| Operaciones UI blocks (entregas, logística, audit), marcar-entregado | Operaciones |
| Ventas realizadas sheet (data), future Ventas UI | Ventas |
| Invoque Panelin placement in IA, standalone + transversal UX | Invoque Panelin |
| Component naming (PanelinCalculadoraV3) | Cotizaciones |

### 2.3 Priorities (order for improvement plan)

1. **Unblock and align:** Define IA doc (Shell + all); unify entry (Shell); resolve naming (Shell/docs).
2. **User impact:** Add Invoque Panelin to IA and nav (Shell, Invoque Panelin); clarify KPI under Finanzas (Finanzas, Shell).
3. **Flows and polish:** Document user flow Cotizaciones ↔ Operaciones/Finanzas (Cotizaciones, Operaciones); favicon/root (Shell); component naming (Cotizaciones).
4. **Later:** Ventas UI; 3849 vs 3001 decision; transversal Invoque Panelin implementation.

---

## 3. Handoff to Phase 3

- **Gaps** and **conflicts** above feed the “issues” addressed in the improvement plan steps.
- **Dependencies** define step order (e.g. “Define IA” before “Implement nav”).
- **Resolutions** and **ownership** are used to assign step owners and acceptance criteria.
- **Priorities** define wave grouping in the full improvement plan.
