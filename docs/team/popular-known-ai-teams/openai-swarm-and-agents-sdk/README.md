# OpenAI — Swarm (educativo) y Agents SDK

## Resumen

**Swarm** fue un framework **experimental y educativo** de OpenAI para orquestación multi-agente **ligera**, centrado en:

- **Agents:** instrucciones + herramientas disponibles.
- **Handoffs:** transferir la conversación a otro agente **con contexto acumulado**.

Filosofía: poco código, control explícito, enfoque **client-side** (p. ej. Completions), útil para explorar patrones sin plataforma pesada.

**Estado:** En el ecosistema OpenAI, Swarm se considera **reemplazado o superado** por el **OpenAI Agents SDK** para usos de producción (verificar documentación actual del repositorio `openai/swarm` y el SDK oficial).

## Conceptos útiles para comparar con BMC

| Concepto Swarm/SDK | Analogía BMC |
|--------------------|--------------|
| Handoff entre agentes | Handoffs Orquestador → Mapping → Reporter; Handoff a SIM en MATPROMT |
| Instrucciones por agente | Prompts orientadores por rol §2 (MATPROMT) |
| Tools | Skills `.cursor/skills/*`, rutas API, scripts `npm run …` |

## Enlaces oficiales / upstream

- Repositorio histórico: [github.com/openai/swarm](https://github.com/openai/swarm)
- Agents SDK (Python): documentación en [OpenAI GitHub / openai-agents-python](https://github.com/openai/openai-agents-python) (URL de docs puede variar; usar la del README del repo).

## Limitaciones típicas (genéricas)

- Multi-agente puro LLM sin **fuente de verdad** externa puede alucinar; BMC mitiga con `PROJECT-STATE`, inventario de planillas y contrato API.
