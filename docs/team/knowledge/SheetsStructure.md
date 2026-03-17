# Knowledge — Sheets Structure (Estructura)

Rol: Sheets Structure Editor. Skill: `bmc-sheets-structure-editor`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/google-sheets-module/planilla-inventory.md` — estructura actual.
- Plan de Mapping — no implementar sin plan acordado.
- **Restricción:** Solo Matías puede ejecutar edits desde Cursor.

---

## Salidas (qué produce)

- **Tabs** — crear, renombrar, eliminar hojas.
- **Dropdowns** — data validation desde Parametros o lista estática.
- **Filas, columnas, gráficos** — insertar, eliminar, actualizar.
- **Automatismos y guías** — documentar triggers, fórmulas, flujo.

---

## Convenciones

- **Solo Matías** — ejecutar edits; solo desde Cursor.
- **Trabajar después de Mapping** — no implementar sin plan acordado.
- **No auto-run** — producir código; Matías ejecuta y verifica.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Cambios estructurales | Mapping | Actualizar planilla-inventory. |
| Nuevos tabs/columnas | Design, Dependencies | Log for [Agent]; PROJECT-STATE. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Sheets Structure)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skill: `.cursor/skills/bmc-sheets-structure-editor/SKILL.md`
