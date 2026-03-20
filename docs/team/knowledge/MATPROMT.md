# Knowledge — MATPROMT

Rol: **MATPROMT**. Skill: `matprompt` (`.cursor/skills/matprompt/SKILL.md`).

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — objetivo del run, pendientes, cambios recientes.
- `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §2 y §2.2 — roles y skills transversales.
- `docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md` — ciclo de mejoras, paso 9.
- `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md` — estado por rol.
- Bundle previo: `docs/team/MATPROMT-FULL-RUN-PROMPTS.md` o `docs/team/matprompt/MATPROMT-RUN-*.md`.

---

## Salidas (qué produce)

- **Bundle de prompts orientadores** por cada fila §2: objetivo, lecturas, entregables, criterios, anti-patrones, handoff.
- **MATPROMT-DELTA** (durante el run) — solo para roles afectados si cambia prioridad o aparece tarea nueva.
- Coordinación con Orquestador y Parallel/Serial si el orden de ejecución cambia.

---

## Convenciones

- Paso **0a** del full team run; no sustituye pasos 1–8 ni el criterio del Judge.
- Los bundles deben ser **accionables** y enlazar a rutas reales del repo (sin narrativa no trazable).
- Tras runs de **propagación**, incluir tabla §4 explícita cuando el usuario pida sync entre repos.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Bundle listo | Todos los roles §2 vía archivo | `MATPROMT-FULL-RUN-PROMPTS.md` o `matprompt/MATPROMT-RUN-*.md` |
| Delta | Roles afectados | Sección DELTA en el mismo archivo o nota en PROJECT-STATE |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección MATPROMT)
- Orquestador: `.cursor/agents/bmc-dashboard-team-orchestrator.md`
- Invocación: `docs/team/INVOQUE-FULL-TEAM.md`
