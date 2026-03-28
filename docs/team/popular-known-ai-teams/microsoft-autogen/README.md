# Microsoft AutoGen — conversaciones multi-agente

## Resumen

**AutoGen** (Microsoft) abstrae **agentes conversables** que resuelven tareas mediante **diálogo** entre agentes.

Tipos habituales (familia 0.2 / evolución hacia núcleo estable):

- **ConversableAgent:** base que intercambia mensajes.
- **AssistantAgent:** asistente LLM (código, razonamiento).
- **UserProxyAgent:** representa al humano; puede ejecutar código y pedir input.

**Group chat:** más de dos participantes; **GroupChatManager** coordina. **Speaker selection:** round robin, aleatorio, manual, **auto** (LLM elige siguiente hablante), o función custom.

## Conceptos útiles para comparar con BMC

| AutoGen | Analogía BMC |
|---------|--------------|
| Group chat | “Equipo completo” con múltiples roles en un run |
| Speaker selection | Orquestador + Parallel/Serial (quién va en paralelo o en serie) |
| UserProxy | Matias + `HUMAN-GATES-ONE-BY-ONE.md` |
| Max rounds | Límites de pasos / anti-patrones “no alargar informes” en MATPROMT |

## Enlaces oficiales

- [AutoGen documentation](https://microsoft.github.io/autogen/)
- Patrones: [Group chat (stable user guide)](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html)
- [Conversation patterns](https://microsoft.github.io/autogen/0.2/docs/tutorial/conversation-patterns/) (0.2)

## Notas

- AutoGen automatiza **quién habla**; BMC usa **orden fijo canónico** con opciones condicionales (2b, 5h, 7b) + matriz de profundidad: más predecible para auditoría empresarial.
