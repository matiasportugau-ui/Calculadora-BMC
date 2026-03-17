# Knowledge — Judge (Juez)

Rol: Team Judge. Skill: `bmc-team-judge`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` — criterios por rol.
- Artefactos del run: handoffs, REPORT-SOLUTION-CODING, IMPLEMENTATION-PLAN.
- Si existe: `JUDGE-REPORT-HISTORICO.md` — promedios previos.

---

## Salidas (qué produce)

- **JUDGE-REPORT-RUN-YYYY-MM-DD.md** — ranking del run, puntajes por agente.
- **JUDGE-REPORT-HISTORICO.md** — promedios por agente, evolución.
- **Actualización PROJECT-STATE** si hay hallazgos que afecten a otros.

---

## Convenciones

- **Criterios por agente** en JUDGE-CRITERIA-POR-AGENTE.
- **Escala** definida en reference.md.
- **Objetivo:** evolución continua del equipo.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Hallazgos del Juez | Orquestador, agente afectado | Oportunidades de evolución. |
| Actualización estado | PROJECT-STATE | Tabla propagación §4. |

---

## Referencias

- Criterios: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md`
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skill: `.cursor/skills/bmc-team-judge/SKILL.md`
