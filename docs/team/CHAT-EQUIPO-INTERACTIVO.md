# Chat de Equipo Interactivo — Guía de uso

**Propósito:** Mantener un diálogo conversacional con el equipo completo BMC/Panelin. En lugar de solo ejecutar "Invoque full team" en batch, podés hacer preguntas, recibir respuestas de los agentes apropiados y seguir la conversación.

---

## Cómo activar el chat

Decí cualquiera de estas frases en el chat de Cursor:

| Frase | Activa |
|-------|--------|
| **Chat con el equipo** | Modo chat interactivo |
| Diálogo interactivo | Modo chat interactivo |
| Quiero hablar con el equipo | Modo chat interactivo |
| Conversar con el equipo completo | Modo chat interactivo |
| Interactive team chat | Modo chat interactivo |

---

## Qué podés preguntar

El coordinador routea tu pregunta al agente o skill apropiado:

| Tema | Quién responde |
|------|----------------|
| Estado del proyecto, pendientes | Orchestrator, PROJECT-STATE |
| Planillas, tabs, columnas | Mapping |
| Dashboard, UX, secciones | Design |
| Hosting, migración, endpoints | Networks |
| Shopify, MercadoLibre, OAuth | Integrations |
| GPT, OpenAPI, Cloud Run | GPT/Cloud |
| Facturación, errores, cierre | Billing |
| Auditoría, logs | Audit/Debug |
| Calculadora, cotizaciones | Calc |
| Seguridad, tokens | Security |
| Dependencias | Dependencies |
| Planes Solution/Coding | Reporter |
| Evaluación del equipo | Judge |

---

## Ejemplos de uso

**Usuario:** "Chat con el equipo"

**Agente:** "Entré en modo chat con el equipo. Podés preguntarme sobre estado del proyecto, planillas, dashboard, infra, integraciones, facturación, etc. Los 19 miembros están disponibles. ¿Qué te gustaría saber?"

**Usuario:** "¿Qué estado tiene el dashboard?"

**Agente:** [Lee PROJECT-STATE, resume estado del dashboard, puertos, secciones, pendientes]

**Usuario:** "¿Y las planillas? ¿Hay tabs nuevas?"

**Agente:** [Consulta planilla-inventory o Mapping, responde sobre tabs y estructura]

**Usuario:** "Invoque full team"

**Agente:** [Cambia a full team run, ejecuta pasos 0–9]

---

## Diferencia con "Invoque full team"

| Modo | Comportamiento |
|------|----------------|
| **Chat interactivo** | Diálogo continuo. Preguntás, recibís respuestas, podés seguir preguntando. El agente coordina y routea a los agentes según la pregunta. |
| **Invoque full team** | Ejecución batch completa. Pasos 0–9, todos los 19 miembros. Ideal para sincronizar estado, ciclo de mejoras, actualizar todo. |

Podés combinar ambos: empezar con chat interactivo para explorar, y cuando quieras actualizar todo, decir "Invoque full team".

---

## Referencias

- **Skill:** `.cursor/skills/chat-equipo-interactivo/SKILL.md`
- **Rule:** `.cursor/rules/chat-equipo-interactivo.mdc`
- **Equipo completo:** [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md) §2
- **Full team:** [INVOQUE-FULL-TEAM.md](./INVOQUE-FULL-TEAM.md)
