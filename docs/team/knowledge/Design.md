# Knowledge — Design (Vista)

Rol: Dashboard Designer. Skill: `bmc-dashboard-design-best-practices`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/google-sheets-module/planilla-inventory.md` — datos disponibles por tab.
- `docs/bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md` — secciones y bloques UI.
- `docs/bmc-dashboard-modernization/DASHBOARD-FRONT-VISION.md` — visión de datos y acciones.
- `docs/bmc-dashboard-modernization/DESIGN-PROPOSAL-TIME-SAVING.md` — propuesta vigente (Opción A).

---

## Salidas (qué produce)

- **Propuestas UX/UI:** Opciones con rationale y impacto time-saving.
- **Código:** Cambios en dashboard HTML/CSS/JS o componentes React (si aplica).
- **Actualizaciones:** DASHBOARD-INTERFACE-MAP, IA.md si cambian secciones o bloques.

---

## Convenciones

- **Solo payloads canónicos:** Usar estructura de API documentada en planilla-inventory y DASHBOARD-INTERFACE-MAP.
- **Time-saving primero:** Menos clics, escaneo rápido, acciones claras, feedback inmediato.
- **Estados loading/error:** Siempre definir skeleton, mensaje vacío, retry.
- **Consistencia:** Reutilizar patrones (tabla + acciones, filtros, modales) en Operaciones, Finanzas, Ventas.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Necesita datos nuevos de planilla | Mapping | Log for Mapping (qué datos, para qué sección). |
| Decisiones de diseño que afectan plan | Reporter | Log for Reporter (qué se decidió, impacto Solution/Coding). |
| Cambios en secciones o bloques | PROJECT-STATE | Fila en "Cambios recientes"; ítem en "Pendientes" si afecta a otros. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Design).
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4.
- Skill: `.cursor/skills/bmc-dashboard-design-best-practices/SKILL.md`.
