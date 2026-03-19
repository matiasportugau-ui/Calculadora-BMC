# Chat de Equipo Interactivo — Diálogo con el equipo completo

**Propósito:** Permitir un **diálogo interactivo** con el equipo BMC/Panelin: hacer preguntas, recibir respuestas de distintos agentes, seguir el hilo de la conversación y escalar cuando haga falta. A diferencia del "Invoque full team" (que ejecuta el pipeline completo 0→9 de forma autónoma), el chat interactivo es **conversacional** y se adapta a lo que preguntes.

---

## Cuándo usar el Chat Interactivo

| Situación | Chat Interactivo | Invoque full team |
|-----------|------------------|-------------------|
| Pregunta puntual ("¿Qué estado tiene el deploy?") | ✓ | — |
| Seguimiento de una decisión anterior | ✓ | — |
| Consultar a varios agentes en la misma conversación | ✓ | — |
| Ejecutar el pipeline completo (Mapping→Design→…→Judge→Repo Sync) | — | ✓ |
| Sincronizar estado y propagar cambios | — | ✓ |

---

## Cómo activar el Chat

**Frases que activan el modo chat:**

- **Chat con el equipo** / **Diálogo con el equipo**
- **Chat interactivo equipo completo**
- **Quiero hablar con el equipo**
- **Pregunta al equipo** / **Consulta al equipo**
- **Equipo en modo chat** / **Modo diálogo equipo**

---

## Flujo del Chat Interactivo

1. **Usuario** escribe una pregunta o tema (ej: "¿Qué pendientes hay para el deploy?").
2. **Orquestador** (o agente actual) lee `PROJECT-STATE.md` y decide qué roles involucrar.
3. **Agentes relevantes** responden según su dominio (Networks para deploy, Mapping para planillas, etc.).
4. **Usuario** puede hacer preguntas de seguimiento; la conversación continúa.
5. **Escalación:** Si hace falta aprobación unánime o decisión de usuario, se aplica el protocolo [AI Interactive Team](.cursor/skills/ai-interactive-team/SKILL.md).

---

## Roles disponibles para el diálogo

| Rol | Dominio | Ejemplo de pregunta |
|-----|---------|---------------------|
| **Mapping** | Planillas, tabs, API contracts | "¿Qué tabs faltan mapear?" |
| **Design** | UX/UI, dashboard | "¿Cómo mejorar la vista de Ventas?" |
| **Networks** | Hosting, deploy, endpoints | "¿Qué falta para deploy en Netuy?" |
| **Dependencies** | Grafo, service map | "¿Qué servicios dependen del API?" |
| **Integrations** | Shopify, ML, OAuth | "¿Estado de la integración Shopify?" |
| **GPT/Cloud** | OpenAPI, GPT Builder | "¿Hay drift entre GPT y Cloud?" |
| **Fiscal** | Protocolo, alternativas | "¿Hay incumplimientos pendientes?" |
| **Billing** | Facturación, cierre | "¿Errores en el cierre de marzo?" |
| **Audit/Debug** | Logs, diagnóstico | "¿Anomalías en los logs?" |
| **Reporter** | Planes, handoffs | "¿Plan para Solution/Coding?" |
| **Contract** | API vs planilla | "¿El contrato API está al día?" |
| **Calc** | Calculadora, 5173 | "¿Estado del cotizador?" |
| **Security** | OAuth, tokens, CORS | "¿Revisión de seguridad pendiente?" |
| **Judge** | Ranqueo, evolución | "¿Cómo va el equipo según el Judge?" |
| **Repo Sync** | bmc-dashboard-2.0, bmc-development-team | "¿Repos sincronizados?" |

---

## Instrucciones para el agente en modo Chat

1. **Leer** `docs/team/PROJECT-STATE.md` (Cambios recientes, Pendientes) al iniciar el diálogo.
2. **Identificar** qué roles son relevantes para la pregunta del usuario.
3. **Responder** en nombre de esos roles (o invocar sus skills si hace falta).
4. **Mantener contexto:** Si el usuario hace seguimiento, usar el historial de la conversación.
5. **Escalar** al usuario cuando:
   - No hay acuerdo unánime entre agentes (protocolo AI Interactive Team).
   - Se necesita decisión manual (ej: tabs, triggers, deploy).
   - Hay conflicto que requiere input humano.

---

## Ejemplo de diálogo

```
Usuario: Chat con el equipo. ¿Qué pendientes hay para el deploy?

Agente: Revisando PROJECT-STATE y artefactos...

Estado actual:
- Go-live: Pendientes 1.4 (compartir workbook), 2.x (tabs manuales), 3.x (triggers), 5.x (deploy Cloud Run/VPS), 6.x (E2E).
- Networks: Deploy productivo pendiente (Cloud Run o VPS Netuy).
- Audit: E2E checklist creado; falta ejecutar con datos reales.

¿Querés que profundice en alguno (tabs, triggers, deploy, E2E)?

Usuario: ¿Qué hay que hacer para los tabs?

Agente: [Mapping/Sheets Structure] Según AUTOMATIONS-BY-WORKBOOK y planilla-inventory, los tabs pendientes son: CONTACTOS, Ventas_Consolidado, SHOPIFY_SYNC_AT, PAGADO. Son manuales (Matias). Instrucciones detalladas en IMPLEMENTATION-PLAN-POST-GO-LIVE §A1.
```

---

## Referencias

- **Full team run:** [INVOQUE-FULL-TEAM.md](./INVOQUE-FULL-TEAM.md)
- **AI Interactive Team:** `.cursor/skills/ai-interactive-team/SKILL.md`
- **Orquestador:** `.cursor/agents/bmc-dashboard-team-orchestrator.md`
- **PROJECT-STATE:** [PROJECT-STATE.md](./PROJECT-STATE.md)
- **Equipo completo:** [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md)
