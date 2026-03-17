# Invoque full team — Invocación unificada del equipo BMC/Panelin

**Propósito:** Unificar la invocación del equipo completo en una sola frase: **"Invoque full team"**.

---

## Frases que activan el full team

| Frase | Activa |
|-------|--------|
| **Invoque full team** | Full team run |
| Equipo completo | Full team run |
| Full team run | Full team run |
| Run full BMC team | Full team run |
| Run the BMC Dashboard team | Full team run |
| Orchestrate the dashboard agent team | Full team run |

---

## Qué hace "Invoque full team"

1. **Carga el skill** `.cursor/skills/bmc-project-team-sync/SKILL.md`
2. **Lee** `docs/team/PROJECT-STATE.md`, `docs/team/PROJECT-TEAM-FULL-COVERAGE.md`, **`docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md`** y **`docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md`**
3. **Invoca al Orquestador** (`.cursor/agents/bmc-dashboard-team-orchestrator.md`)
4. **Ejecuta** todos los pasos 0 → 0b → 1 → … → 8 → **9** (ciclo de mejoras)
5. **Incluye** a todos los 19 miembros de `PROJECT-TEAM-FULL-COVERAGE.md` §2
6. **Paso 9:** Ejecuta los "Próximos prompts" del PROMPT-FOR-EQUIPO-COMPLETO; actualiza el backlog y la sección "Próximos prompts" para que el **siguiente** "Equipo completo" continúe hasta que todos los agentes estén completamente desarrollados

---

## Flujo completo (pasos)

| Paso | Rol | Acción |
|------|-----|--------|
| 0 | Orchestrator | Leer PROJECT-STATE; resolver pendientes |
| 0b | Parallel/Serial | Plan de ejecución (paralelo vs serie) |
| 1 | Orchestrator | Plan & proposal confirmado |
| 2 | Mapping | Planilla map, DASHBOARD-INTERFACE-MAP |
| 2b | Sheets Structure | *Condicional:* cambios estructurales (Matias only) |
| 3 | Dependencies | dependencies.md, service-map.md |
| 3b | Contract | Validación API vs planilla-inventory |
| 3c | Networks | Infra status |
| 4 | Design | Propuesta UX/UI |
| 4b | Integrations | Shopify, ML, OAuth |
| 5 | Reporter | REPORT-SOLUTION-CODING, IMPLEMENTATION-PLAN |
| 5b | Security | OAuth, tokens, env, CORS |
| 5c | GPT/Cloud | OpenAPI, GPT Builder, drift |
| 5d | Fiscal | Fiscal findings, protocolo PROJECT-STATE |
| 5e | Billing | Errores, duplicados, cierre |
| 5f | Audit/Debug | Auditoría, logs |
| 5g | Calc | 5173, BOM, Drive, PDF |
| 6 | Judge | JUDGE-REPORT-RUN, JUDGE-REPORT-HISTORICO |
| 7 | Repo Sync | Sincroniza bmc-dashboard-2.0 y bmc-development-team |
| 8 | Orchestrator | Actualizar PROJECT-STATE |
| 9 | Orchestrator + roles | Ciclo de mejoras: ejecutar Próximos prompts; actualizar IMPROVEMENT-BACKLOG y PROMPT-FOR-EQUIPO-COMPLETO para el siguiente run |

---

## Miembros del equipo (19)

Ver `docs/TEAM-MEMBERS.md` para personas y `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §2 para la tabla canónica.

---

## Referencias

- **Orquestador:** `.cursor/agents/bmc-dashboard-team-orchestrator.md`
- **Skill sync:** `.cursor/skills/bmc-project-team-sync/SKILL.md`
- **Rule:** `.cursor/rules/bmc-project-team-sync.mdc` (triggers incl. "Invoque full team")
- **Mejoras del equipo:** `docs/team/FULL-TEAM-IMPROVEMENT-ANALYSIS.md` — knowledge base por miembro, skills por flujo.
- **Input por run / ciclo de mejoras:** `docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md` (prompts a ejecutar en este run), `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md` (estado por agente hasta desarrollado). Cada "Equipo completo" continúa la secuencia hasta que todos los agentes estén completamente desarrollados.
