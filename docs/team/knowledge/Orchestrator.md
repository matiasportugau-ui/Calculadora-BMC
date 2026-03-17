# Knowledge — Orchestrator (Orquestador)

Rol: BMC Dashboard Team Orchestrator. Skills: `bmc-dashboard-team-orchestrator`, `ai-interactive-team`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §2 — lista canónica de 19 miembros.
- `docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md` — próximos prompts, ciclo de mejoras.
- `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md` — estado por agente.

---

## Salidas (qué produce)

- **Orden de pasos:** 0 → 0b → 1 → 2 → … → 9.
- **Handoffs:** Entre roles según tabla de handoffs (orchestrator agent).
- **Actualización PROJECT-STATE:** Paso 8 — Cambios recientes, Pendientes.
- **Actualización backlog:** Paso 9 — marcar ✓ en IMPROVEMENT-BACKLOG-BY-AGENT.
- **Actualización "Próximos prompts":** Paso 9 — PROMPT-FOR-EQUIPO-COMPLETO para siguiente run.

---

## Convenciones

- **Todos los miembros §2 en full run:** Ningún rol queda fuera.
- **Paso 9 = ciclo de mejoras:** Ejecutar prompts de PROMPT-FOR-EQUIPO-COMPLETO; actualizar backlog.
- **Pasos opcionales:** 2b (Sheets Structure), 4b (Integrations), 5c (GPT/Cloud), 5e (Billing), 5g (Calc) según contexto.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Al finalizar run | PROJECT-STATE | Paso 8: Cambios recientes, Pendientes. |
| Al finalizar paso 9 | IMPROVEMENT-BACKLOG | Marcar ✓ en filas ejecutadas. |
| Al finalizar paso 9 | PROMPT-FOR-EQUIPO-COMPLETO | Actualizar "Próximos prompts" para siguiente run. |
| Conflicto o desacuerdo | AI Interactive Team | Escalación; Log for [Agent]. |

---

## Referencias

- Agent: `.cursor/agents/bmc-dashboard-team-orchestrator.md`.
- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Orchestrator).
