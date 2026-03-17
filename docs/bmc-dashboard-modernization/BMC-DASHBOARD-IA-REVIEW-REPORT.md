# BMC Dashboard — IA Review Report

**Date:** 2026-03-14  
**Reviewer:** bmc-dashboard-ia-reviewer (subagent)  
**Sources:** DASHBOARD-VISUAL-MAP.html, DASHBOARD-VISUAL-MAP.md, DASHBOARD-EVALUATION-REPORT.md, ngrok traffic report (JSON).  
**PDF:** `~/Desktop/Shopify/BMC Dashboard — Mapa Visual.pdf` — **not read** (file not found at given path). Analysis based on repo docs only where PDF would have added context.

---

## 1. Executive summary

The BMC dashboard today is documented as a multi-entry system (Vite :5173, Finanzas at :3001/finanzas, standalone at :3849) with a single Express API (:3001) and Sheets/Drive as data sources. The **user-facing information architecture** (sections like Ventas 2.0, Cotizaciones, KPI, Finanzas, Invoque Panelin) is **not** explicitly described in the visual map or evaluation report; the docs focus on technical architecture, ports, and API↔Sheets flows. Duplications and naming ambiguities appear at the **technical** level (e.g. “Dashboard” used for both the Finanzas HTML app and the standalone app; “Cotizaciones” as data vs potential section). The dashboard can function as the main business frontend only if a clear, documented IA and navigation model are added and entry points are unified. **Invoque Panelin** is not present in the current docs; a **hybrid** role (dedicated section + transversal assistant) is recommended so the GPT-powered agent is both discoverable and usable inside other modules. The provided ngrok report shows the public URL returning 200 and 404 for `GET /` and 404 for `/favicon.ico`, which hurts first-load and polish when the dashboard is exposed via ngrok.

---

## 2. Current structure (from files)

### 2.1 Directly observed

- **Architecture (DASHBOARD-VISUAL-MAP.md §1, .html §1)**  
  - Client: Vite React (localhost:5173), “Dashboard /finanzas” (localhost:3001/finanzas), API (localhost:3001).  
  - Backend: Express, bmcDashboard router, calcRouter; .md also shows legacyQuoteRouter and shopify router.  
  - Data: Google Sheets API, Google Drive API; .md also shows MercadoLibre API.  
  - .md shows ngrok as infra tunneling to Express.

- **Ports (DASHBOARD-VISUAL-MAP.md §2, .html §2)**  
  - 5173: Vite (React SPA).  
  - 3001: Express API; 3001/finanzas: “Dashboard Finanzas” (static HTML).  
  - 3849: “Dashboard standalone” (`npm run bmc-dashboard`).  
  - 4040: ngrok inspector.

- **Data flow (DASHBOARD-VISUAL-MAP.md §3, .html §3)**  
  - Sheets (CRM_Operativo, Master_Cotizaciones, Pagos_Pendientes, AUDIT_LOG, Metas_Ventas) → API endpoints → UI blocks: “Próximas entregas”, “Coordinación logística”, “KPIs financieros”, “Audit log”.  
  - .html shows a subset (entregas, KPIs); .md adds coordinación logística and audit.

- **Sheets schemas (both §4)**  
  - BMC (Master_Cotizaciones, Pagos_Pendientes, AUDIT_LOG; .md adds Ventas realizadas, Metas_Ventas).  
  - CRM (CRM_Operativo; .md adds Manual, Parametros, Dashboard, Automatismos).  
  - Config-driven via BMC_SHEET_SCHEMA.

- **React components (DASHBOARD-VISUAL-MAP.md §5, .html §5)**  
  - App → PanelinCalculadoraV3 (or PanelinCalculadoraV3_backup in .md) → GoogleDrivePanel, Budget Log, and in .md PDFPreviewModal.  
  - These are the **Calculadora** (Vite) app, not the Finanzas dashboard UI.

- **Endpoints (DASHBOARD-VISUAL-MAP.md §6)**  
  - GET /health, /api/cotizaciones, /api/proximas-entregas, /api/coordinacion-logistica, /api/kpi-financiero, /api/audit, /api/pagos-pendientes, /api/metas-ventas; POST /api/marcar-entregado.

- **Finanzas UI (DASHBOARD-EVALUATION-REPORT.md §3)**  
  - Sections: Próximas entregas, Coordinación logística, KPIs financieros (Calendario, Pagos pendientes, Metas de ventas), Audit log, Exportar CSV, Filtrar.

- **CRM → Dashboard mapping (DASHBOARD-VISUAL-MAP.md §9)**  
  - Column mapping from CRM_Operativo to normalized names (COTIZACION_ID, FECHA_CREACION, CLIENTE_NOMBRE, etc.).

### 2.2 Inferred

- **Two “dashboards”:** (1) Finanzas at 3001/finanzas (Sheets-backed, entregas/KPI/audit), (2) standalone at 3849. Same “dashboard” label for both → need to distinguish “Finanzas dashboard” vs “standalone dashboard” in IA/naming.
- **Vite app vs Finanzas:** Vite (5173) is the Calculadora (cotizaciones, Drive, Budget Log); Finanzas is a separate HTML app. So “dashboard” in product terms could mean either or both → inferred need for a single conceptual “BMC Dashboard” that groups these.
- **Planned sections (Ventas 2.0, Administrador de Cotizaciones 2.0, KPI, Finanzas, Cotizaciones, Invoque Panelin)** are not in the map or evaluation report; inferred from user/product context. No hierarchy or navigation between them is documented.

### 2.3 Uncertain / not in sources

- Content of **BMC Dashboard — Mapa Visual.pdf** (not read).  
- Whether **Ventas 2.0**, **Administrador de Cotizaciones 2.0**, **Invoque Panelin**, etc., exist as UI sections or routes in any build.  
- Exact relationship between the standalone app (3849) and the Finanzas app (3001/finanzas): same codebase or different.  
- Any top-level navigation or shell that links “Finanzas”, “Cotizaciones”, “KPI”, etc.

---

## 3. Issues

| Issue | Type | Evidence |
|-------|------|----------|
| **“Dashboard” overloaded** | Observed | DASHBOARD-VISUAL-MAP: “Dashboard /finanzas”, “Dashboard standalone” (3849), “Dashboard UI” in data flow. Same term for different entry points and UIs. |
| **Cotizaciones: data vs section** | Inferred | “Cotizaciones” = API/sheet (Master_Cotizaciones, /api/cotizaciones) and likely a product section (Administrador de Cotizaciones 2.0). Unclear if “Cotizaciones” in nav means “list of quotes” or “quote builder (Calculadora)”. |
| **No explicit IA or nav model** | Observed | Docs describe ports, flows, and API; no diagram or list of user-facing sections, menu, or hierarchy. |
| **KPI vs Finanzas overlap** | Inferred | Finanzas UI already includes “KPIs financieros”. “KPI” as a planned section may duplicate or conflict with “Finanzas” unless one subsumes the other or scope is defined. |
| **Multiple entry points, no single front door** | Observed | 5173 (Calculadora), 3001/finanzas (Finanzas), 3849 (standalone). User goal “main frontend” implies one primary URL and a nav that reaches modules. |
| **Component naming drift** | Observed | .html: “PanelinCalculadoraV3”; .md: “PanelinCalculadoraV3_backup”. Suggests two components; unclear which is canonical. |
| **Invoque Panelin not in docs** | Observed | Not mentioned in DASHBOARD-VISUAL-MAP or DASHBOARD-EVALUATION-REPORT. Role and placement are undefined in the repo. |
| **Weak grouping of capabilities** | Inferred | Entregas, logística, KPI, audit are listed as separate UI blocks; no documented grouping (e.g. “Operaciones”, “Finanzas”) for scalability. |
| **Unclear transition Calculadora ↔ Finanzas** | Inferred | No documented link or route from one to the other; user flow between “quote building” and “financial/operational” views is unclear. |

---

## 4. Assessment: Can the dashboard function as the main business frontend?

- **Today:** **Partially.**  
  - **Observed:** Finanzas at 3001/finanzas already centralizes operaciones (entregas, logística, KPI, audit). Calculadora (5173) centralizes quoting. So “main frontend” is split across two origins.  
  - **Inferred:** Without a single shell and navigation, the dashboard does not yet function as *one* main business frontend; it is two (or three with 3849) separate UIs.  
- **To function as main frontend:** Need (1) one primary entry (e.g. one port or one ngrok URL), (2) a clear IA with sections and hierarchy, (3) navigation that reaches Ventas, Cotizaciones, KPI/Finanzas, and Invoque Panelin without confusion.  
- **Uncertain:** What the standalone app (3849) provides vs Finanzas; whether 3849 is intended as that single entry.

---

## 5. Proposed IA and navigation

### 5.1 Principles

- One **primary entry** (single URL for “BMC Dashboard”).  
- **Sections** map to user goals, not only to technical apps.  
- **Naming** unique per section; avoid overloading “dashboard” and “cotizaciones”.  
- **Hierarchy** at most two levels for top nav (e.g. Operaciones, Finanzas, Ventas, Cotizaciones, Asistente).

### 5.2 Suggested top-level structure

| Section | Purpose | Notes |
|--------|---------|--------|
| **Inicio / Home** | Overview, shortcuts, alerts | Optional; can be first tab. |
| **Cotizaciones** | Create and manage quotes (Calculadora + list) | Unify “Administrador de Cotizaciones 2.0” and quote-building here. |
| **Operaciones** | Entregas, logística, audit | Current Finanzas content: próximas entregas, coordinación logística, audit log. |
| **Finanzas** | Pagos, metas, KPI financiero | Pagos pendientes, metas de ventas, KPI cards; “KPI” as sub-area of Finanzas to avoid duplication. |
| **Ventas** | Pipeline, ventas 2.0 | Placeholder for Ventas 2.0; scope TBD. |
| **Invoque Panelin** | GPT-powered assistant | See §6. |

### 5.3 Navigation model

- **Primary:** Horizontal top nav (or sidebar) with: Inicio | Cotizaciones | Operaciones | Finanzas | Ventas | Invoque Panelin.  
- **Secondary:** Within each section, sub-views (e.g. under Operaciones: Próximas entregas, Coordinación logística, Audit log).  
- **Technical:** Either (a) single SPA that mounts “Operaciones/Finanzas” and “Cotizaciones” as routes, or (b) one shell that embeds or links to 3001/finanzas and 5173 (or 3849) with clear labels.

### 5.4 Resolving “dashboard” and “cotizaciones”

- Use **“BMC Dashboard”** only for the whole product (the one frontend).  
- Use **“Finanzas”** or **“Operaciones”** for the current 3001/finanzas app in docs and UI.  
- Use **“Cotizaciones”** for the section that contains both the quote builder (Calculadora) and the list/admin of quotes; avoid using “Cotizaciones” to mean only the API or only the list.

---

## 6. Invoque Panelin — recommended role and placement

- **Recommendation: hybrid.**  
  - **Standalone section:** “Invoque Panelin” as a top-level nav item so users can open a dedicated chat/agent experience.  
  - **Transversal:** Same agent available inside other modules (e.g. “Ask Panelin” in Cotizaciones, Operaciones, Finanzas) for contextual help, suggestions, or actions.  
- **Rationale:**  
  - Standalone ensures discoverability and a clear place for heavy agent-only workflows.  
  - Transversal supports “help me with this quote” or “explain this KPI” without leaving the page.  
  - Hybrid is common for GPT-style assistants (e.g. Copilot: dedicated pane + inline).  
- **Uncertain:** Whether the tech stack (e.g. iframe, same SPA, separate backend) is already planned; placement in the IA is independent and can be implemented in more than one way.

---

## 7. Prioritized improvements

| # | Improvement | Impact | Complexity | Priority |
|---|-------------|--------|------------|----------|
| 1 | Define and document a single “BMC Dashboard” IA (sections + hierarchy) and add to repo (e.g. DASHBOARD-VISUAL-MAP or new IA.md) | H | M | P0 |
| 2 | Unify entry point: one URL (or one ngrok URL) that serves or redirects to the main dashboard shell with nav | H | H | P0 |
| 3 | Resolve naming: “Dashboard” only for the whole product; “Finanzas”/“Operaciones” for 3001/finanzas; “Cotizaciones” for section (builder + list) | M | L | P1 |
| 4 | Add “Invoque Panelin” to the IA as hybrid (section + transversal entry points) and document in map | H | L | P1 |
| 5 | Clarify KPI vs Finanzas: make “KPI” a sub-area of Finanzas (or one section) and document | M | L | P1 |
| 6 | Document user flow: how users move between Cotizaciones (Calculadora), Operaciones, Finanzas | M | M | P2 |
| 7 | Align component naming (PanelinCalculadoraV3 vs _backup) and reflect canonical name in docs | L | L | P2 |
| 8 | Add favicon and fix root route so ngrok URL returns 200 consistently (see §8) | M | L | P1 |

---

## 8. Operational / ngrok notes

### 8.1 Traffic summary (from provided JSON)

- **Host:** `freewill-kaleidoscopically-jacalyn.ngrok-free.dev`  
- **Events:** 5 total. Status: 200 (2), 404 (3). Paths: `/` (4), `/favicon.ico` (1).  
- **Observation:** Same path `/` returns sometimes **200** (HTML, 2945 bytes) and sometimes **404** (43 bytes, application/json). `/favicon.ico` always **404**.  
- **IPs:** 2 unique; 2 JA4 fingerprints.  
- **Capture:** Limited; request/response bodies not fully exported.

### 8.2 Relation to dashboard

- The ngrok host is the **public URL** for the app (tunnel to Express :3001). When users or OAuth callbacks hit this URL as the “main frontend”, inconsistent `GET /` behavior and missing favicon hurt reliability and polish.  
- **Directly observed:** 404 on `/favicon.ico` and mixed 200/404 on `/`.  
- **Inferred:** Difference may be due to routing (e.g. Accept headers, or static vs API handling for `/`). Favicon 404 is a direct fix.

### 8.3 Risks (from report)

- **Red:** IPs, JA4, request IDs are sensitive; treat as operational secrets.  
- **Yellow:** Limited capture may hide real causes of 404s (e.g. body/headers).  
- **Green:** Low volume and single host make triage easier.

### 8.4 Recommended next steps (from report, applied to dashboard)

1. **Favicon:** Add a favicon so `/favicon.ico` returns 200 (or serve it from the app).  
2. **Root route:** Investigate why `GET /` alternates 200/404 (routing, middleware, or static vs SPA); ensure root returns 200 for browser requests when dashboard is the main frontend.  
3. **Full capture:** Enable full capture in ngrok if needed to debug request/response bodies and headers.  
4. **Log exporting:** Configure log export/retention if operational audit is required.

---

## 9. Summary

- **Structure:** Current docs describe technical architecture and data flow well but do not define the **user-facing IA** or navigation for the planned sections (Ventas 2.0, Cotizaciones, KPI, Finanzas, Invoque Panelin).  
- **Issues:** “Dashboard” and “Cotizaciones” overloading, multiple entry points, no single nav model, Invoque Panelin absent from docs.  
- **Main frontend:** Achievable once a single entry, clear IA, and nav are in place.  
- **Invoque Panelin:** Recommended as **hybrid** (standalone section + transversal assistant).  
- **Ngrok:** Fix favicon and stable 200 for `GET /` so the public dashboard URL behaves consistently.

No code or file edits were made; this report is review and proposal only.
