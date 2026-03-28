# Popular Known AI Teams — knowledge base (arquitecturas multi-agente)

**Propósito:** Resumen **no oficial** de arquitecturas y frameworks **reconocidos** para equipos de agentes (autónomos u orquestados), con enlaces a documentación canónica. Sirve de **contraste** con el modelo BMC/Panelin (orquestador, §2, MATPROMT, Judge).

**Alcance:** Investigación web (2026) + síntesis; **no** sustituye leer la documentación de cada proveedor. No hay afiliación con los proyectos citados.

**Informe de alineación con este repo:** [`IMPLEMENTATION-REPORT-BMC-PANELIN.md`](./IMPLEMENTATION-REPORT-BMC-PANELIN.md)

**Cuadro comparativo preciso (12 dimensiones × 7 enfoques + veredicto “¿corremos ok?”):** [`COMPARATIVE-MATRIX-BMC-VS-INDUSTRY.md`](./COMPARATIVE-MATRIX-BMC-VS-INDUSTRY.md)

---

## Índice de equipos / frameworks documentados

| Carpeta | Enfoque | Idea clave |
|---------|---------|------------|
| [`openai-swarm-and-agents-sdk/`](./openai-swarm-and-agents-sdk/) | OpenAI | Agentes + **handoffs**; Swarm educativo → evolución hacia **Agents SDK** |
| [`crewai/`](./crewai/) | CrewAI | **Crew** = agentes con rol/goal + **tasks** + proceso secuencial/jerárquico |
| [`microsoft-autogen/`](./microsoft-autogen/) | Microsoft | **Group chat**, speaker selection, UserProxy / Assistant |
| [`langgraph-supervisor/`](./langgraph-supervisor/) | LangChain | **Supervisor** + subagentes, grafo de estado, ciclos y persistencia |
| [`google-adk/`](./google-adk/) | Google | **ADK**: jerarquía padre-hijo, workflow agents (sequential/parallel/loop) |
| [`amazon-bedrock-multi-agent/`](./amazon-bedrock-multi-agent/) | AWS | Colaboración multi-agente en Bedrock, Strands, supervisor/collaborator |

---

## Patrones transversales (vocabulario común)

| Patrón | Descripción breve | Pariente en BMC (ver informe) |
|--------|-------------------|-------------------------------|
| **Handoff** | Pasar contexto de un agente a otro | Tabla de handoffs del Orquestador, SIM handoff MATPROMT |
| **Supervisor / orchestrator** | Decide quién actúa | Orquestador pasos 0–9 |
| **Specialist pool** | Agentes por dominio | Tabla §2 `PROJECT-TEAM-FULL-COVERAGE.md` |
| **State / memory** | Historial o checkpoint | `PROJECT-STATE.md`, bundles MATPROMT, reportes por run |
| **Human-in-the-loop** | Aprobación o gates | `HUMAN-GATES-ONE-BY-ONE.md`, UserProxy en AutoGen (análogo conceptual) |
| **Planner / MATPROMT** | Descomponer objetivo en instrucciones por rol | MATPROMT paso 0a, Run Scope Matrix |

---

## Cómo mantener esta KB

- Tras cambios grandes en el ecosistema (nombres de producto, deprecaciones), actualizar el README de la carpeta afectada y una línea en **Referencias** con fecha.
- Para decisiones de producto BMC, preferir el informe [`IMPLEMENTATION-REPORT-BMC-PANELIN.md`](./IMPLEMENTATION-REPORT-BMC-PANELIN.md) y [`../FULL-TEAM-RUN-DEFINITION.md`](../FULL-TEAM-RUN-DEFINITION.md).

---

## Referencias externas útiles (lectura primaria)

- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) (evolución post-Swarm; verificar URL vigente en el repo upstream).
- [CrewAI docs](https://docs.crewai.com/)
- [AutoGen (Microsoft)](https://microsoft.github.io/autogen/)
- [LangGraph](https://langchain-ai.github.io/langgraph/)
- [Google ADK](https://google.github.io/adk-docs/)
- [Amazon Bedrock multi-agent collaboration](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-multi-agent-collaboration.html)
