# Plan & Proposal — Planilla + Dashboard Mapping

**Purpose:** Before implementing any mapping, this document defines *what* we map (planillas and dashboard interface), *how* we map each, and *where* the outputs live, so we understand where each element is.

**Skill:** `.cursor/skills/bmc-planilla-dashboard-mapper/` — use when mapping planillas and dashboard together; always follow this plan and proposal before implementation.

**Context:** Agent transcript [ea7af8e7] and PROMPT-AGENT-TEAM-FULL-IMPROVEMENT-PLAN.md document the evolution of this agent and its skills. **Orchestration:** The agent runs as a **Team** coordinated by [bmc-dashboard-team-orchestrator](../../.cursor/agents/bmc-dashboard-team-orchestrator.md); see [TEAM-ORCHESTRATION.md](TEAM-ORCHESTRATION.md) for how to run the full team or partial runs.

**Dato clave — Entorno actual:** Hoy el entorno apunta al **workbook** `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg` con esquema **CRM_Operativo**. Cualquier trabajo nuevo de **series financieras** debe contemplar esta realidad **antes** de asumir que hojas como **Pagos_Pendientes** o **Metas_Ventas** ya están listas; verificar disponibilidad y estructura en el planilla map antes de implementar.

---

## 0. Skills this agent uses (all)

The agent needs all of the following skills to map planillas, dashboard, dependencies, services, and to report. Use them as needed for each task.

| Skill | Path | Purpose |
|-------|------|--------|
| **Google Sheets mapping** | `.cursor/skills/google-sheets-mapping-agent/` | Map sheets: inventory, data types, relationships, GET/PUSH, automation. |
| **Sheets structure editor** | `.cursor/skills/bmc-sheets-structure-editor/` | Create tabs, dropdowns, rows/columns/charts; edit sheet structure (Matias only, Cursor). |
| **Dependencies & service mapper** | `.cursor/skills/bmc-dependencies-service-mapper/` | Connect dependencies, map all services so they work; dependency graph, service map, integration checklist. |
| **Implementation plan & reporter** | `.cursor/skills/bmc-implementation-plan-reporter/` | Reports and implementation plans for Solution team and Coding team workflow. |
| **Planilla & dashboard mapper** | `.cursor/skills/bmc-planilla-dashboard-mapper/` | Map planillas + dashboard interface; plan and proposal first; cross-reference where each element lives. |
| **Dashboard design (best practices, time-saving)** | `.cursor/skills/bmc-dashboard-design-best-practices/` | Research similar dashboards, review against BMC needs, implement suitable aesthetic and functional design; main task saving time. |

**Module hub:** `docs/google-sheets-module/README.md` — index of sheet-related assets (mapping, structure editor, API, setup). Use for sheet/planilla context.

---

## 1. Objective

- Map **planillas** (Google Sheets / templates) and **dashboard interface** in one coherent pass.
- Produce a single picture: which sheet/tab feeds which UI block and which API route.
- **No implementation of mapping until this plan is agreed** (or user explicitly approves execution).

---

## 2. What We Are Mapping

| Layer | Contents | Sources (repo) |
|-------|----------|----------------|
| **Planillas** | Sheet workbook(s), tabs, columns, data types, validation, GET/PUSH, which API uses each | `server/routes/bmcDashboard.js`, env (`BMC_SHEET_ID`, `BMC_SHEET_SCHEMA`), `.cursor/skills/google-sheets-mapping-agent/`, `.cursor/skills/bmc-sheets-structure-editor/reference.md` |
| **Dashboard interface** | Nav sections (Inicio, Cotizaciones, Operaciones, Finanzas, Ventas, Invoque Panelin), UI blocks (tables, cards, forms), entry URLs (3001/finanzas, 5173, 3849) | `docs/bmc-dashboard-modernization/DASHBOARD-VISUAL-MAP.md`, `IA.md`, `dashboard/index.html`, Finanzas/Operaciones static UI |

---

## 3. How We Will Map Each

### 3.1 Planillas (sheets / templates)

- **Input:** Sheet IDs, schema (Master_Cotizaciones vs CRM_Operativo), tab names, and (when provided) user-supplied info per planilla.
- **Process:** For each sheet/tab: inventory, columns and types, validation (e.g. Parametros), relationships, which API routes read/write (GET/PUSH).
- **Output:** One **planilla map** document: sheet inventory, per-sheet structure, GET/PUSH contract, and which dashboard section or API consumes it.
- **Format:** Same structure as google-sheets-mapping-agent (sheet inventory, data types, relationships, calculation logic, GET/PUSH). One doc per schema or one consolidated doc.

### 3.2 Dashboard interface

- **Input:** IA.md (sections), DASHBOARD-VISUAL-MAP.md (flows, ports), dashboard HTML and any section-specific blocks.
- **Process:** For each section (Inicio, Cotizaciones, Operaciones, Finanzas, Ventas, Invoque Panelin): list UI blocks (e.g. “Próximas entregas”, “KPI cards”, “Audit table”), and for each block: data source (API route or sheet).
- **Output:** **Dashboard interface map**: section → UI blocks → data source (API route, optional sheet name). Can extend DASHBOARD-VISUAL-MAP.md or live in a dedicated file.

### 3.3 Cross-reference

- **Output:** A **cross-reference** table or matrix: **Planilla/tab** ↔ **Dashboard section/block** ↔ **API route**. So we can answer “where is X?” for any planilla or UI element.

---

## 4. Where Artifacts Live

| Artifact | Location |
|----------|----------|
| **This plan & proposal** | `docs/bmc-dashboard-modernization/PLAN-PROPOSAL-PLANILLA-DASHBOARD-MAPPING.md` |
| **Planilla inventory** (live) | `docs/google-sheets-module/planilla-inventory.md` |
| **Planilla map** (diff vs blueprint) | `docs/google-sheets-module/planilla-map.md` |
| **Dashboard interface map** | `docs/bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md` |
| **Cross-reference (planilla ↔ dashboard ↔ API)** | DASHBOARD-INTERFACE-MAP.md §5 |

---

## 5. First task (explicit)

**First task** the agent must perform:

1. **Map and review sheets available** — List all workbooks/tabs the system uses (e.g. CRM_Operativo, Master_Cotizaciones, Parametros, Pagos_Pendientes, etc.). Use google-sheets-mapping-agent; output: sheet inventory and which API uses each.
2. **All fields available** — For each sheet/tab: document all columns (fields), data types, validation (dropdowns), and GET/PUSH. Full field list per planilla so we know what is available.
3. **Dashboard mapping identification** — Identify which dashboard sections and UI blocks exist and which sheet/API feeds each. Name each section and block clearly.
4. **Per page and sub-page location** — For the dashboard: document **location** of every page and sub-page (URL, route, section id, anchor). E.g. Inicio (#), Cotizaciones (localhost:5173), Operaciones (#operaciones), Finanzas (#finanzas), Ventas (#ventas), Invoque Panelin (#invoque); and any sub-pages or sub-sections within them.
5. **Functionality and way of using it in localhost dashboards** — For each page/sub-page: describe **functionality** (what the user can do) and **how to use it** when running the dashboards on localhost (ports 3001, 5173, 3849). So we know how each part of the dashboard is used in practice.

**Outputs for first task:** Planilla map (sheets + all fields), dashboard interface map (page/sub-page location + functionality + localhost usage), and cross-reference. See §4 for artifact locations.

---

## 6. Order and Dependencies

1. **Agree this plan and proposal** (no mapping implementation before this is confirmed or user approves).
2. **Execute first task** (§5): map and review sheets (all fields), dashboard mapping (identification, per page/sub-page location, functionality and localhost usage).
3. **Map planillas** in detail: sheet inventory, per-sheet structure, API routes that consume each. Produces planilla map.
4. **Map dashboard interface**: sections and UI blocks, **per page and sub-page location**, **functionality and way of using it on localhost**. Link each block to API route (and optionally sheet). Produces dashboard interface map.
5. **Write cross-reference**: planilla/tab ↔ dashboard page/sub-page ↔ API route.

User can provide information about each planilla or dashboard section at any time; that information is recorded in §7 and then applied in the mapping steps.

---

## 7. User-Provided Information (to be filled when provided)

When you provide details about each planilla or dashboard section, they will be recorded here and then applied in the mapping step.

| Item | Type (planilla / dashboard) | Info provided | Mapped to (artifact §) |
|------|----------------------------|---------------|------------------------|
| *(example)* CRM_Operativo | planilla | Tabs: CRM_Operativo, Parametros, Dashboard | Planilla map § CRM schema |
| *(example)* Finanzas | dashboard | Blocks: KPI cards, pagos table | Dashboard interface map § Finanzas |
| **Entorno actual** | planilla | Workbook `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg`, esquema CRM_Operativo. Series financieras: no asumir que Pagos_Pendientes ni Metas_Ventas están listos; verificar en planilla map antes de implementar. | Planilla map § inventory; §2 Dato clave |
| | | | |

---

## 8. Status

- [x] Plan and proposal agreed (or approved by user).
- [x] **First task (§5) completed:** sheets reviewed (all fields), dashboard mapping (identification, per page/sub-page location, functionality and localhost usage).
- [x] Planilla map produced.
- [x] Planilla inventory produced (planilla-inventory.md).
- [x] Dashboard interface map produced.
- [x] Cross-reference table produced.

---

**Next step:** Once you share the information for each planilla and dashboard section, it will be added to §7 and the mapping will be executed according to this plan (§5 first task, then §6).

---

## 9. Target architecture for sheet improvement

To **improve the current sheet** ([BMC crm_automatizado](https://docs.google.com/spreadsheets/d/1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg/edit?gid=1427195280#gid=1427195280)) toward 10/10 quality, use the **implementation blueprint**: [SHEET-ARCHITECTURE-BLUEPRINT-V2.md](SHEET-ARCHITECTURE-BLUEPRINT-V2.md) and the **planilla map (diff actual vs blueprint)**: [docs/google-sheets-module/planilla-map.md](../google-sheets-module/planilla-map.md). The planilla map compares current tabs and CRM_Operativo columns with the blueprint, lists add/rename/validation actions, Parametros structure, dropdown values, and an implementation checklist (§8). Use skill `bmc-sheets-structure-editor` (Matias, Cursor) for structure changes. No mapping implementation is done until this plan is in place and (if required) agreed.
