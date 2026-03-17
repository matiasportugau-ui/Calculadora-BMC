# Knowledge — Parallel/Serial (Paralelo)

Rol: Parallel/Serial Agent. Skill: `bmc-parallel-serial-agent`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — objetivo, pendientes, plan vigente.
- `docs/team/judge/JUDGE-REPORT-HISTORICO.md` — scores por agente.
- `docs/bmc-dashboard-modernization/dependencies.md`, `service-map.md` — dependencias.

---

## Salidas (qué produce)

- **PARALLEL-SERIAL-PLAN** — qué en paralelo, qué en serie.
- **Combinación recomendada** de agentes (incluyendo clones si aplica).
- **Handoff al Orquestador** — plan de ejecución.

---

## Convenciones

- **Paralelo:** Tareas sin dependencias; pueden correr Mapping+1 y Design+1 a la vez.
- **Serie:** Una depende de la otra; Mapping → Dependencies → Design.
- **Orientado a objetivos** — scores y contexto para mejor combinación.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Plan listo | Orquestador | PARALLEL-SERIAL-PLAN.md o handoff directo. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Parallel/Serial)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skill: `.cursor/skills/bmc-parallel-serial-agent/SKILL.md`
