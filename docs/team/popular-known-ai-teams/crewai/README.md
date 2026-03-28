# CrewAI — Crews, agents, tasks

## Resumen

**CrewAI** modela equipos como:

- **Agents:** unidad con **role**, **goal** y **backstory**; pueden usar herramientas y colaborar.
- **Tasks:** trabajo asignado con descripción, output esperado, agente responsable; orden **secuencial** o **jerárquico** según el `process` del crew.
- **Crew:** agrupa agentes y estrategia de ejecución (colaboración, memoria, callbacks, streaming, planificación opcional).

**Delegación:** con `allow_delegation`, los agentes pueden usar herramientas de colaboración (delegar trabajo o preguntar a otro agente).

## Conceptos útiles para comparar con BMC

| CrewAI | Analogía BMC |
|--------|--------------|
| Role / goal | Rol §2 + responsabilidad en `PROJECT-TEAM-FULL-COVERAGE.md` |
| Task | Ítems en `PROMPT-FOR-EQUIPO-COMPLETO` + paso 9 |
| Crew process | Orden del Orquestador 0→9 + `PARALLEL-SERIAL-PLAN` |
| Manager LLM (jerárquico) | Orquestador + MATPROMT decidiendo intensidad (Run Scope Matrix) |

## Enlaces oficiales

- [CrewAI documentation](https://docs.crewai.com/)
- Conceptos: [Agents](https://docs.crewai.com/concepts/agents), [Tasks](https://docs.crewai.com/concepts/tasks), [Crews](https://docs.crewai.com/en/concepts/crews), [Collaboration](https://docs.crewai.com/en/concepts/collaboration)

## Notas

- CrewAI suele ejecutarse en **runtime Python** con LLM; BMC ejecuta **agentes en Cursor** + docs + API real: la “herramienta” es el repo y los endpoints, no solo prompts.
