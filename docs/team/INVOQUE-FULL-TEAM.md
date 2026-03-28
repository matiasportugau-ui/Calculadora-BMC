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
3. **Run Scope Gate (orientación y ahorro):** seguir [`RUN-SCOPE-GATE.md`](./RUN-SCOPE-GATE.md) — el Orquestador (paso 0), MATPROMT (0a) y Parallel/Serial (0b) fijan **objetivo** y **matriz Profundo / Ligero / N/A** por rol §2; no se “saltan” roles, se evita trabajo profundo innecesario.
4. **Invoca al Orquestador** (`.cursor/agents/bmc-dashboard-team-orchestrator.md`)
5. **Ejecuta** todos los pasos 0 → **0a (MATPROMT)** → 0b → 1 → … → 7 → **7b (Docs & Repos Organizer)** → 8 → **9** (ciclo de mejoras)
6. **Incluye** a **todos los roles** de la tabla canónica `PROJECT-TEAM-FULL-COVERAGE.md` §2 (N = número de filas vigentes) y **considera** las **skills transversales** §2.2 en paso 0
7. **Paso 9:** Ejecuta los "Próximos prompts" del PROMPT-FOR-EQUIPO-COMPLETO; actualiza el backlog y la sección "Próximos prompts" para que el **siguiente** "Equipo completo" continúe hasta que todos los agentes estén completamente desarrollados

**Secuencia autopilot (runs 24–30):** Para encadenar varios full team sin perder el hilo operativo, usar el paquete en [`reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md`](./reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md) + bundle [`MATPROMT-FULL-RUN-PROMPTS.md`](./MATPROMT-FULL-RUN-PROMPTS.md) («AUTOPILOT Runs 24–30»).

**Runs 32–39 (adelante) + revisión pre-run:** [`reports/RUN-ROADMAP-FORWARD-2026.md`](./reports/RUN-ROADMAP-FORWARD-2026.md) — plan abierto a **DELTA** si el run actual descubre prioridades nuevas.

---

## Flujo completo (pasos)

| Paso | Rol | Acción |
|------|-----|--------|
| 0 | Orchestrator | Leer PROJECT-STATE, PROMPT, BACKLOG; revisar **§2.2** (skills transversales); **Run Scope Gate** (objetivo + matriz Profundo/Ligero/N/A — `RUN-SCOPE-GATE.md`); resolver pendientes |
| 0a | **MATPROMT** | Bundle de prompts por rol §2 (`matprompt`); cabecera **Run Scope Matrix** (`RUN-SCOPE-GATE.md`); Handoff a SIM si aplica; delta prompts si hay tareas nuevas en el run |
| 0b | Parallel/Serial | Plan de ejecución (paralelo vs serie) **alineado a la matriz**; puede usar el bundle MATPROMT |
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
| 5h | SIM-REV | *Opcional si objetivo SIM:* `panelsim/reports/SIM-REV-REVIEW-*.md` — ver `panelsim/AGENT-SIMULATOR-SIM.md` |
| 6 | Judge | JUDGE-REPORT-RUN, JUDGE-REPORT-HISTORICO |
| 7 | Repo Sync | Sincroniza bmc-dashboard-2.0 y bmc-development-team |
| 7b | Docs & Repos Organizer | Índices, READMEs, enlaces; handoff a Repo Sync; N/A si no hubo delta documental |
| 8 | Orchestrator | Actualizar PROJECT-STATE |
| 9 | Orchestrator + roles | Ciclo de mejoras: ejecutar Próximos prompts; actualizar IMPROVEMENT-BACKLOG y PROMPT-FOR-EQUIPO-COMPLETO para el siguiente run |

---

## Miembros del equipo (N = §2 + §2.2)

Ver `docs/TEAM-MEMBERS.md` para personas y `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` **§2** (roles) y **§2.2** (skills transversales) para la lista canónica. **Alta de nuevos agentes:** §2.3 del mismo documento.

**SIM / PANELSIM:** figura en §2 pero **no** tiene número de paso 0–9 en la tabla de arriba: el full team lo cubre vía **Handoff a SIM** en el bundle MATPROMT (0a) y lecturas de estado; la ejecución operativa es el **chat Cursor** según [`panelsim/AGENT-SIMULATOR-SIM.md`](./panelsim/AGENT-SIMULATOR-SIM.md).

---

## Referencias

- **Orquestador:** `.cursor/agents/bmc-dashboard-team-orchestrator.md`
- **Skill sync:** `.cursor/skills/bmc-project-team-sync/SKILL.md`
- **Rule:** `.cursor/rules/bmc-project-team-sync.mdc` (triggers incl. "Invoque full team")
- **Mejoras del equipo:** `docs/team/FULL-TEAM-IMPROVEMENT-ANALYSIS.md` — knowledge base por miembro, skills por flujo.
- **Input por run / ciclo de mejoras:** `docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md` (prompts a ejecutar en este run), `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md` (estado por agente hasta desarrollado). Cada "Equipo completo" continúa la secuencia hasta que todos los agentes estén completamente desarrollados.
