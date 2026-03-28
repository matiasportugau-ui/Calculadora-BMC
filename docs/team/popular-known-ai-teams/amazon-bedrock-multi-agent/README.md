# Amazon Bedrock — colaboración multi-agente (cloud)

## Resumen

**Amazon Bedrock** ofrece **multi-agent collaboration**: varios agentes especializados coordinados (documentación AWS describe arquitecturas tipo **supervisor–collaborators**, límites de colaboradores, plantillas IaC, observabilidad).

En el ecosistema AWS también aparece **Strands Agents** como marco para construir soluciones multi-agente sobre modelos en Bedrock (blogs AWS sobre Strands + colaboración).

Patrones mencionados en literatura AWS:

- **Supervisor:** orquesta delegación asíncrona.
- **Arbiter / enrutamiento semántico:** variantes más adaptativas (según artículos de blog; verificar nombres exactos en docs AWS).

## Conceptos útiles para comparar con BMC

| Bedrock multi-agent | Analogía BMC |
|---------------------|--------------|
| Supervisor agent | Orquestador |
| Collaborator agents | Filas §2 (Mapping, Networks, …) |
| Observability | Judge + reportes + smoke/gate en AGENTS.md |
| Enterprise guardrails | Security reviewer + human gates + sin secretos en repo |

## Enlaces oficiales

- [Multi-agent collaboration (Bedrock)](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-multi-agent-collaboration.html)
- [Create multi-agent collaboration](https://docs.aws.amazon.com/bedrock/latest/userguide/create-multi-agent-collaboration.html)
- Blog (ejemplo): [Multi-agent collaboration with Strands](https://aws.amazon.com/blogs/devops/multi-agent-collaboration-with-strands/)

## Notas

- Aquí el runtime es **managed cloud**; BMC es **human-in-the-loop fuerte** y **estado en Git**. La comparación es de **patrones**, no de reemplazo 1:1.
