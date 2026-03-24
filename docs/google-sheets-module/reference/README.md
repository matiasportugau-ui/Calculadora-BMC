# Google Sheets Module — Reference

Reference material for the Google Sheets module lives in the Cursor skills; **canonical repo docs** (mapper código, sync por producto) viven en el directorio padre.

## Documentación canónica en el repo (prioridad)

| Documento | Uso |
|-----------|-----|
| [../README.md](../README.md) | Índice del módulo |
| [../MAPPER-PRECISO-PLANILLAS-CODIGO.md](../MAPPER-PRECISO-PLANILLAS-CODIGO.md) | Pestañas, filas de header, columnas **según `server/routes/bmcDashboard.js`** |
| [../SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md](../SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md) | Dónde accede dashboard / calculadora / GPT / OmniCRM |
| [../VARIABLES-Y-MAPEO-UNO-A-UNO.md](../VARIABLES-Y-MAPEO-UNO-A-UNO.md) | Variables extraíbles y verificación 1:1 |
| [../planilla-inventory.md](../planilla-inventory.md) | Inventario workbooks y rutas API |

## Skills (Cursor)

| Topic | Full reference |
|-------|----------------|
| **Admin Sheet (CRM_Operativo)** — data types, relationships, calculation logic, GET/PUSH | [.cursor/skills/google-sheets-mapping-agent/reference.md](../../../.cursor/skills/google-sheets-mapping-agent/reference.md) |
| **Structure editor** — tabs, rows/columns, charts, **dropdowns (data validation)**, automation/workflow | [.cursor/skills/bmc-sheets-structure-editor/reference.md](../../../.cursor/skills/bmc-sheets-structure-editor/reference.md) |

Use the **mapping agent** to document sheets and workflow; use the **structure editor** (Matias only) to create tabs, set dropdowns, and customize the sheet workflow. **Actualizar siempre** los docs canónicos del repo cuando cambie el contrato real en `bmcDashboard.js`.
