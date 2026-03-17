# Google Sheets Module — BMC Dashboard

Single entry point for all **Google Sheets–related** functionality: mapping, structure editing, API usage, automation, and workflow.

**Entorno actual:** El dashboard apunta al workbook `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg` con esquema **CRM_Operativo**. Para trabajo nuevo en series financieras: no asumir que **Pagos_Pendientes** ni **Metas_Ventas** están listos; verificar en el planilla map antes de implementar. Ver [PLAN-PROPOSAL-PLANILLA-DASHBOARD-MAPPING.md § Dato clave](../bmc-dashboard-modernization/PLAN-PROPOSAL-PLANILLA-DASHBOARD-MAPPING.md).

---

## Contents of this module

| Asset | Location | Purpose |
|-------|----------|---------|
| **Module index** | This folder: `docs/google-sheets-module/` | Hub for sheet-related docs and links. |
| **Mapping agent** | [.cursor/skills/google-sheets-mapping-agent/](../../.cursor/skills/google-sheets-mapping-agent/) | Map sheets (tabs, columns, types, relationships, GET/PUSH), read automation, document workflow. |
| **Structure editor** | [.cursor/skills/bmc-sheets-structure-editor/](../../.cursor/skills/bmc-sheets-structure-editor/) | Create tabs, dropdowns, rows/columns/charts; customize workflow. *Matias only, Cursor only.* |
| **Backend API** | [server/routes/bmcDashboard.js](../../server/routes/bmcDashboard.js) | Read/write Sheets: `/api/cotizaciones`, `/api/proximas-entregas`, `/api/pagos-pendientes`, `/api/marcar-entregado`, etc. |
| **Setup & config** | [.cursor/SETUP DASHBOARD /README.md](../../.cursor/SETUP%20DASHBOARD%20/README.md) | Dashboard setup, env (`BMC_SHEET_ID`, `GOOGLE_APPLICATION_CREDENTIALS`), scripts. |
| **Full editing access** | [FULL-IMPROVEMENT-PLAN-REVIEW-REPORT.md §10](../bmc-dashboard-modernization/FULL-IMPROVEMENT-PLAN-REVIEW-REPORT.md#10-access-to-full-sheet-editing-tabs-dropdowns-automation-workflow) | Table: tabs, dropdowns, automation/guides, workflow customization. |
| **Planilla + dashboard mapper** | [.cursor/skills/bmc-planilla-dashboard-mapper/](../../.cursor/skills/bmc-planilla-dashboard-mapper/) | Map planillas (sheets/templates) and dashboard interface together; plan and proposal first. |
| **Sheet architecture (10/10)** | [SHEET-ARCHITECTURE-BLUEPRINT-V2.md](../bmc-dashboard-modernization/SHEET-ARCHITECTURE-BLUEPRINT-V2.md) | Parametros, CRM_Operativo, Motor_IA, Dashboard, Data_Base; dropdowns; Apps Script; Panel Agente AI sidebar. |
| **Planilla inventory (live)** | [planilla-inventory.md](planilla-inventory.md) | Inventario runtime: tabs, estado (active/conditional), API por tab. |
| **Planilla map (actual vs blueprint)** | [planilla-map.md](planilla-map.md) | Diff: tabs, columnas CRM_Operativo, Parametros, dropdowns; checklist implementación §8. |

---

## Reference docs (in skills)

- **Mapping & Admin Sheet**: [google-sheets-mapping-agent/reference.md](../../.cursor/skills/google-sheets-mapping-agent/reference.md) — CRM_Operativo schema, data types, relationships, GET/PUSH, direct read/write.
- **Structure editor API**: [bmc-sheets-structure-editor/reference.md](../../.cursor/skills/bmc-sheets-structure-editor/reference.md) — Tabs, rows/columns, charts, **data validation (dropdowns)**, automation/workflow.

---

## Quick use

- **Map a sheet or document workflow** → Use the **mapping agent** skill; output goes to a mapping doc (sheet inventory, types, relationships, GET/PUSH).
- **Create tabs, dropdowns, edit structure** → Use the **structure editor** skill (Matias, from Cursor); agent generates code/scripts, you run them.
- **Read/write from the app** → Backend uses `bmcDashboard.js`; env: `BMC_SHEET_ID`, `GOOGLE_APPLICATION_CREDENTIALS`.

---

## Folder structure (this module)

```
docs/google-sheets-module/
├── README.md              ← you are here (module index)
└── reference/
    └── README.md          ← links to mapping + structure-editor reference docs
```

Skills and backend stay in `.cursor/skills/` and `server/`; this folder is the **documentation hub** for the Google Sheets module.
