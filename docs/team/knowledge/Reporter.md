# Knowledge — Reporter (Reporte)

Rol: Implementation Plan & Reporter. Skill: `bmc-implementation-plan-reporter`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/bmc-dashboard-modernization/FULL-IMPROVEMENT-PLAN.md` — plan de mejoras.
- `docs/bmc-dashboard-modernization/FULL-IMPROVEMENT-PLAN-REVIEW-REPORT.md` — facts y datos.
- `docs/google-sheets-module/planilla-inventory.md` — planilla map.
- `docs/bmc-dashboard-modernization/dependencies.md` — grafo de dependencias.
- Decisiones de Design (DESIGN-PROPOSAL-TIME-SAVING, DASHBOARD-INTERFACE-MAP).

---

## Salidas (qué produce)

- **REPORT-SOLUTION-CODING.md:** Status por módulo, gaps, risks, handoff summary.
- **IMPLEMENTATION-PLAN-SOLUTION-CODING.md:** Tareas para Solution y Coding; orden; dependencias; criterios de aceptación.

---

## Convenciones

- **Handoffs por equipo:** Solution aprueba UX y planillas → Coding implementa.
- **Claridad:** Solution y Coding deben saber exactamente qué hacer; orden y dependencias respetados.
- **Citar fuentes:** Cada gap o risk debe referenciar documento origen (planilla-inventory, FULL-IMPROVEMENT-PLAN, etc.).

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Entrega a Solution | Solution team | REPORT-SOLUTION-CODING con items para aprobar. |
| Entrega a Coding | Coding team | IMPLEMENTATION-PLAN con tareas C1–Cn, S1–Sn. |
| Hallazgos críticos | Orchestrator | Actualizar PROJECT-STATE "Pendientes". |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Reporter).
- Skill: `.cursor/skills/bmc-implementation-plan-reporter/SKILL.md`.
