---
name: chat-equipo-interactivo
description: >
  Enables interactive chat/dialogue with the complete BMC team. User asks
  questions, agents respond conversationally; follow-ups, clarifications,
  and multi-turn dialogue supported. Use when user wants chat con el equipo,
  diálogo interactivo, or conversational team interaction.
---

# Chat de Equipo Interactivo — Diálogo con el equipo completo

Este skill habilita un **diálogo interactivo** con el equipo BMC/Panelin. A diferencia del "Invoque full team" (run secuencial 0–9), aquí el usuario mantiene una **conversación** con el equipo: hace preguntas, recibe respuestas, puede hacer seguimiento y profundizar.

---

## Cuándo usar

- User dice: **"Chat con el equipo"**, **"Diálogo interactivo con el equipo"**, **"Quiero hablar con el equipo"**, **"Conversar con el equipo completo"**
- User quiere hacer preguntas y recibir respuestas en formato conversacional
- User necesita aclaraciones, seguimiento o profundizar en un tema
- User prefiere un intercambio iterativo en lugar de un run completo

---

## Modo de operación

### Principio: conversación, no run único

1. **Usuario escribe** — Pregunta, solicitud o tema.
2. **Agente responde** — Actúa como Orquestador + equipo: lee contexto, invoca los roles relevantes según la pregunta, y responde en formato conversacional.
3. **Usuario puede seguir** — "¿Y qué pasa con X?", "Explícame más", "¿Qué opina Design?", etc.
4. **Ciclo continúa** — Hasta que el usuario esté satisfecho o cambie de tema.

### Routing por tema

| Tema / Pregunta | Roles a consultar |
|-----------------|-------------------|
| Planillas, tabs, mapeo | Mapping, Sheets Structure |
| Dashboard, UX/UI | Design |
| Infra, hosting, endpoints | Networks |
| Dependencias, service map | Dependencies |
| API, contrato | Contract |
| Integraciones (Shopify, ML) | Integrations |
| GPT, OpenAPI, Cloud | GPT/Cloud |
| Fiscal, IVA, CFE | Fiscal |
| Facturación, cierre | Billing |
| Auditoría, logs | Audit/Debug |
| Calculadora, BOM, PDF | Calc |
| Seguridad | Security |
| Estado del proyecto, pendientes | Orchestrator, PROJECT-STATE |
| Evaluación del equipo | Judge |
| Paralelo vs serie | Parallel/Serial |

---

## Formato de respuesta

- **Conversacional** — Respuestas en prosa, no solo listas.
- **Identificar rol(es)** — "Mapping indica que…", "Design propone…", "Según Networks…".
- **Invitar seguimiento** — "¿Querés que profundice en X?" o "¿Alguna otra duda?"
- **Contexto compartido** — Leer PROJECT-STATE si la pregunta toca estado o pendientes.

---

## Input inicial

Al iniciar el chat:

1. **Leer** `docs/team/PROJECT-STATE.md` (cambios recientes, pendientes).
2. **Saludar** y ofrecer temas: "Podés preguntar sobre planillas, dashboard, infra, integraciones, fiscal, facturación, auditoría, estado del proyecto, etc."
3. **Esperar** la primera pregunta del usuario.

---

## Ejemplos de flujo

**Usuario:** "¿Cómo está el estado del proyecto?"

**Agente:** [Lee PROJECT-STATE] "El estado actual es… [resumen]. Pendientes: [lista]. ¿Querés que profundice en alguno?"

**Usuario:** "¿Qué opina Design sobre la sección de entregas?"

**Agente:** [Invoca bmc-dashboard-design-best-practices con contexto] "Design indica que… [propuesta]. ¿Querés que lo bajemos a cambios concretos?"

**Usuario:** "Chat con el equipo — quiero saber si estamos listos para deploy"

**Agente:** [Consulta Networks, Security, Audit, Contract] "Según el equipo: Networks… Security… Audit… Contract… Resumen: [listo / pendientes]. ¿Algo más?"

---

## Referencias

| Doc | Path | Uso |
|-----|------|-----|
| Project state | `docs/team/PROJECT-STATE.md` | Estado, pendientes, contexto |
| Full coverage | `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` | Roles, skills, áreas |
| Orchestrator | `bmc-dashboard-team-orchestrator` | Orden de pasos si se pide run completo |
| AI Interactive Team | `ai-interactive-team` | Diálogo entre agentes cuando hay desacuerdo |

---

## Diferencia con "Invoque full team"

| Aspecto | Chat interactivo | Invoque full team |
|---------|------------------|-------------------|
| **Modo** | Conversacional, multi-turn | Run secuencial 0–9 |
| **Objetivo** | Preguntas, aclaraciones, diálogo | Ejecución completa, actualización estado |
| **Roles** | Solo los relevantes a la pregunta | Todos los 19 miembros |
| **Output** | Respuesta en prosa, seguimiento | Artefactos, PROJECT-STATE actualizado |

Si el usuario dice "Invoque full team" o "Equipo completo" (run), usar `bmc-project-team-sync`. Si dice "chat", "diálogo", "conversar", usar este skill.
