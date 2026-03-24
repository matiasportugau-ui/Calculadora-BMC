# Google Sheets Module — BMC Dashboard

Single entry point for all **Google Sheets–related** functionality: mapping, structure editing, API usage, automation, and workflow.

**Stack canónico (2026):** no duplicar reglas de mapeo fuera de aquí salvo skills; el **código fuente** de columnas/pestañas está en [MAPPER-PRECISO-PLANILLAS-CODIGO.md](MAPPER-PRECISO-PLANILLAS-CODIGO.md); el **acceso por producto** (dashboard, GPT, OmniCRM) en [SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md](SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md).

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
| **Variables extraíbles + mapeo 1:1** | [VARIABLES-Y-MAPEO-UNO-A-UNO.md](VARIABLES-Y-MAPEO-UNO-A-UNO.md) | Lista por workbook/tab, campo canónico, consumidor API/UI/OmniCRM; plantilla de verificación fila a fila. |
| **Mapeo preciso (código)** | [MAPPER-PRECISO-PLANILLAS-CODIGO.md](MAPPER-PRECISO-PLANILLAS-CODIGO.md) | Fuente única desde `server/config.js` + `bmcDashboard.js`: env, pestaña, fila de header, columnas y sinónimos `findKey`. |
| **Sync full team (quién accede a qué)** | [SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md](SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md) | Dashboard, API, Calculadora, GPT, OmniCRM: rutas y planillas para mantener todo alineado. |

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
├── README.md                         ← module index (you are here)
├── MAPPER-PRECISO-PLANILLAS-CODIGO.md   ← columnas/pestañas según server (fuente runtime)
├── SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md  ← dashboard / API / Calc / GPT / OmniCRM
├── VARIABLES-Y-MAPEO-UNO-A-UNO.md       ← variables extraíbles + checklist 1:1
├── planilla-inventory.md
├── planilla-map.md
├── SHEETS-MAPPING-5-WORKBOOKS.md
├── (otros: MAPPING-VALIDATION*, MATRIZ*, …)
├── reference/
│   └── README.md                     ← skills reference + enlaces a los docs de arriba
└── …
```

Skills and backend stay in `.cursor/skills/` and `server/`; this folder is the **documentation hub** for the Google Sheets module.
