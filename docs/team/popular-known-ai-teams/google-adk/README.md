# Google ADK (Agent Development Kit) — multi-agente jerárquico

## Resumen

El **Agent Development Kit (ADK)** de Google soporta sistemas **multi-agente** con:

- **Jerarquía** padre-hijo (árbol de agentes; un padre, muchos hijos).
- Tipos de agente: **LLM agents**, **workflow agents** (p. ej. secuencial, paralelo, loop), **custom agents**.
- Despliegue posible en **Vertex AI Agent Engine** o ejecución local; SDK en varios lenguajes (p. ej. Python, TypeScript, Go, Java según documentación vigente).

Ventajas citadas por Google: modularidad, especialización, reuso, flujos de control estructurados.

## Conceptos útiles para comparar con BMC

| ADK | Analogía BMC |
|-----|--------------|
| Workflow Sequential | Pasos lineales 1→2→3… del Orquestador |
| Workflow Parallel | Parallel/Serial + clones §2 |
| Workflow Loop | Paso 9 → siguiente run → de nuevo 0 (iteración) |
| Parent orchestrator | Orquestador + definición `FULL-TEAM-RUN-DEFINITION.md` |

## Enlaces oficiales

- [ADK documentation](https://google.github.io/adk-docs/)
- [Multi-agent systems](https://google.github.io/adk-docs/agents/multi-agents/)
- [Agent team tutorial](https://google.github.io/adk-docs/tutorials/agent-team/)
- [Vertex AI Agent Builder overview](https://cloud.google.com/agent-builder/agent-development-kit/overview)

## Notas

- ADK está acoplado al ecosistema **Google Cloud / Gemini**; BMC está acoplado a **repo + Sheets + Cloud Run + Cursor**: la lección es la **jerarquía + workflow primitives**, no el vendor.
