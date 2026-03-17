# Plan & Proposal — Planilla + Dashboard Mapping

Structure for the plan-and-proposal document. The live doc lives at `docs/bmc-dashboard-modernization/PLAN-PROPOSAL-PLANILLA-DASHBOARD-MAPPING.md`.

## 1. Objective

- Map **planillas** (Google Sheets/templates) and **dashboard interface** so we know where each element lives.
- Single source of truth: which sheet/tab feeds which UI block and which API route.

## 2. What We Are Mapping

| Layer | Contents | Sources |
|-------|----------|--------|
| **Planillas** | Sheet names, tabs, columns, types, validation, GET/PUSH | bmcDashboard.js, env (BMC_SHEET_ID, BMC_SHEET_SCHEMA), google-sheets-mapping-agent reference |
| **Dashboard interface** | Sections (nav), UI blocks (tables, cards, forms), entry URLs | DASHBOARD-VISUAL-MAP.md, IA.md, dashboard/index.html, Finanzas/Operaciones UI |

## 3. How We Will Map Each

- **Planillas:** Per-sheet doc: inventory, columns/types, relationships, API routes that read/write. Output: planilla map (one doc or per-schema).
- **Dashboard:** Per-section doc: section name, UI blocks, data source (API route or sheet). Output: dashboard interface map (extend DASHBOARD-VISUAL-MAP or new file).
- **Cross-reference:** Matrix or table: Planilla/tab ↔ Dashboard section/block ↔ API route.

## 4. Where Artifacts Live

| Artifact | Location |
|----------|----------|
| Plan & proposal (this process) | `docs/bmc-dashboard-modernization/PLAN-PROPOSAL-PLANILLA-DASHBOARD-MAPPING.md` |
| Planilla map(s) | `docs/google-sheets-module/` or mapping output |
| Dashboard interface map | `docs/bmc-dashboard-modernization/` (or extend DASHBOARD-VISUAL-MAP.md) |
| Cross-reference (planilla ↔ dashboard ↔ API) | Same folder as plan; single table or appendix |

## 5. Order and Dependencies

1. Agree plan and proposal (this doc).
2. Map planillas (sheets/templates) first; list which API routes consume each.
3. Map dashboard interface (sections and blocks); link each block to API route or sheet.
4. Write cross-reference from planilla ↔ dashboard ↔ API.

## 6. User-Provided Information

When the user provides information about each planilla or dashboard section, record it here (or in the live plan doc) and then apply it in the mapping step. Example table:

| Item | Type (planilla / dashboard) | Info provided | Mapped to |
|------|-----------------------------|---------------|-----------|
| (example) CRM_Operativo | planilla | Tabs: CRM_Operativo, Parametros, Dashboard | Planilla map § CRM schema |
| (example) Finanzas section | dashboard | Blocks: KPI cards, pagos table | Dashboard map § Finanzas |
