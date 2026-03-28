# LangGraph / LangChain — supervisor y grafos de estado

## Resumen

**LangGraph** modela flujos como **grafos** con **estado explícito**, ramas condicionales y **ciclos** (reintentos, re-ruteo, aprobación humana). Encaja en workflows largos y persistencia.

**Patrón supervisor:** un agente **supervisor** recibe la petición, **enruta** a subagentes especializados y **consolida** resultados. Existen utilidades como `create_supervisor` en el ecosistema `langgraph-supervisor`; la documentación de LangChain puede recomendar también implementar el patrón vía **tools** para mayor control de contexto (evolución del ecosistema: verificar referencia actual).

## Conceptos útiles para comparar con BMC

| LangGraph | Analogía BMC |
|-----------|--------------|
| Estado tipado del grafo | `PROJECT-STATE.md` + artefactos por run |
| Nodos = agentes / herramientas | Pasos 2–5g del Orquestador |
| Supervisor | Orquestador + MATPROMT (0a) |
| Human approval en el grafo | Human gates + paso 9 con prompts explícitos |
| Persistencia / checkpoint | Reportes `JUDGE-*`, `REPORT-*`, `MATPROMT-RUN-*` |

## Enlaces oficiales

- [LangGraph](https://langchain-ai.github.io/langgraph/)
- Referencia supervisor (ejemplo): [langgraph supervisor reference](https://reference.langchain.com/python/langgraph/supervisor/)
- Repo ejemplo: [langchain-ai/langgraph-supervisor-py](https://github.com/langchain-ai/langgraph-supervisor-py)

## Notas

- LangGraph brinda **motor de ejecución**; BMC hoy orquesta por **convención documental** (AGENTS.md, orquestador). Un motor gráfico podría mapearse a CI o a un runner futuro, no está implementado como librería en este repo.
