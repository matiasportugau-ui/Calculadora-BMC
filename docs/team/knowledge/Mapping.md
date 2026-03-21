# Knowledge — Mapping (Mapa)

Rol: Planilla & Dashboard Mapper. Skills: `bmc-planilla-dashboard-mapper`, `google-sheets-mapping-agent`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/bmc-dashboard-modernization/PLAN-PROPOSAL-PLANILLA-DASHBOARD-MAPPING.md` — plan y propuesta vigente.
- **Hub Sheets (canónico):** `docs/google-sheets-module/README.md` → `MAPPER-PRECISO-PLANILLAS-CODIGO.md`, `SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md`, `VARIABLES-Y-MAPEO-UNO-A-UNO.md`, `planilla-inventory.md`, `planilla-map.md`. No bifurcar mapeos en otros paths.
- Si existe: `DASHBOARD-VISUAL-MAP.md`, `IA.md` (secciones y fuentes de datos).

---

## Salidas (qué produce)

- **Planilla map:** Inventario de sheets/tabs, columnas, tipos, validaciones; GET/PUSH; qué API o UI consume cada uno.
- **Dashboard interface map:** Sección → bloques UI → fuente (ruta API, sheet). Alineado con DASHBOARD-VISUAL-MAP / IA.
- **Cross-reference:** Tabla Planilla ↔ Dashboard ↔ API.
- **Log for Design** (y opcionalmente Dependencies) cuando descubre cambios que afectan UI o dependencias.

---

## Convenciones

- **Siempre plan y propuesta antes de implementar.** No ejecutar mapping sin plan escrito o aprobado.
- Documentar estado live (planilla-inventory) y diff vs blueprint (planilla-map) cuando aplique.
- Consumir solo información acordada; si el usuario aporta nueva info de planilla o UI, actualizar el plan primero y luego el mapeo.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Cambios que afectan UI | Design | Log for Design (qué cambió, qué sección/componente afecta). |
| Cambios que afectan dependencias o servicios | Dependencies | Log for Dependencies o mención en PROJECT-STATE. |
| Cambios en Sheets o dashboard | PROJECT-STATE | Fila en "Cambios recientes"; si aplica, ítem en "Pendientes". |

---

## Referencias

- Hub Sheets: `docs/google-sheets-module/README.md`
- Skill: `.cursor/skills/bmc-planilla-dashboard-mapper/SKILL.md`
- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Mapping)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4 (si cambia nueva tab/columna → Design, Dependencies)
