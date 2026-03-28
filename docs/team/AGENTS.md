# Agentes del Proyecto BMC/Panelin

Documentación de agentes especializados disponibles en el repositorio.

---

## SIM / PANELSIM y SIM-REV (Agente Simulador en Cursor)

**Doc:** [panelsim/AGENT-SIMULATOR-SIM.md](./panelsim/AGENT-SIMULATOR-SIM.md) — **PANELSIM** = alias con visión **cotizaciones + administración BMC**, ML pendientes (`/ml/questions`), modo **aprobación vs automático**.  
**KB índice de todo el proyecto:** [panelsim/knowledge/PANELSIM-FULL-PROJECT-KB.md](./panelsim/knowledge/PANELSIM-FULL-PROJECT-KB.md). **Hub:** [panelsim/README.md](./panelsim/README.md).  
**Roles §2:** SIM/PANELSIM (checklist de conexiones); SIM-REV (revisor vs backlog).  
**Agente Cursor (revisor):** `.cursor/agents/sim-reviewer-agent.md`  
**Plantilla MATPROMT (objetivo SIM):** [panelsim/matprompt/MATPROMT-RUN-THEME-SIM-2026-03-23.md](./panelsim/matprompt/MATPROMT-RUN-THEME-SIM-2026-03-23.md)

---

## BMC Project Team Sync

**Skill:** `.cursor/skills/bmc-project-team-sync/`

**Rol:** Sincronizar estado del proyecto entre todas las áreas. Lee y actualiza PROJECT-STATE.md; ejecuta propagación cuando un cambio afecta a varios agentes.

**Cuándo usar:**

- **Invoque full team** (invocación unificada del equipo completo)
- Sync project state, actualizar estado del proyecto
- Full team run, equipo completo
- Mantener a todos actualizados después de un cambio
- Antes de deploy o revisión de sprint

**Referencias:**

- [SKILL.md](../.cursor/skills/bmc-project-team-sync/SKILL.md)
- [reference.md](../.cursor/skills/bmc-project-team-sync/reference.md)
- [PROJECT-STATE.md](./PROJECT-STATE.md)
- [SESSION-WORKSPACE-CRM.md](./SESSION-WORKSPACE-CRM.md) — foco por sesión y checklist para agentes
- [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md)
- [INVOQUE-FULL-TEAM.md](./INVOQUE-FULL-TEAM.md) — invocación unificada
- [JUDGE-CRITERIA-POR-AGENTE.md](./judge/JUDGE-CRITERIA-POR-AGENTE.md)

**Cursor Rule:** `.cursor/rules/bmc-project-team-sync.mdc`

---

## Google Sheets — documentación canónica

Ver [../google-sheets-module/README.md](../google-sheets-module/README.md) (mapper código, sync full team, variables 1:1). El informe de capacidades del equipo enlaza al mapa de acceso en ese módulo.

---

## Networks & Development Agent

**Skill:** `.cursor/skills/networks-development-agent/`

**Rol:** Analista y planificador de infraestructura, integraciones y expansión de servicios.

**Contexto:** Dashboard BMC, endpoints, Sheets, Cloud Run, MercadoLibre, Shopify, ngrok, hosting.

**Capacidades:**

- Web browsing (documentación de proveedores, límites, SLA)
- OpenAI GPT en modo agente (extracción, propuestas, validación)
- Análisis de código y configuración

**Cuándo usar:**

- Análisis de hosting (VPS, Netuy, Cloud Run)
- Evaluación de almacenamiento (logs, cache, backups)
- Email como canal inbound (Gmail API, IMAP)
- Planificación de migración (procedimientos, riesgos)
- Descubrimiento de servicios no utilizados

**Estructura de prompt:** Ver `SKILL.md` sección "Estructura de Prompt (Guía Mejorada)".

**Referencias:**

- [SKILL.md](../.cursor/skills/networks-development-agent/SKILL.md)
- [reference.md](../.cursor/skills/networks-development-agent/reference.md)
- [examples.md](../.cursor/skills/networks-development-agent/examples.md)
- [agents/atlas-agent.md](../.cursor/skills/networks-development-agent/agents/atlas-agent.md) — instrucciones para modo agente Atlas
- [scripts/](../.cursor/skills/networks-development-agent/scripts/) — export-server-state.sh, validate-config.sh

**Cursor Rule:** `.cursor/rules/networks-development-agent.mdc` — aplica inteligentemente cuando se habla de hosting, storage, email, migración o discovery.

---

## BMC Team Judge

**Skill:** `.cursor/skills/bmc-team-judge/`

**Rol:** Evalúa la forma de trabajo y el desempeño del equipo. Define sistema de ranqueo por agente, genera reporte por run y reporte promedio histórico. Cada agente tiene entregable individual (JUDGE-CRITERIA-POR-AGENTE.md) para saber cómo juzgarlo. Objetivo: evolución continua.

**Cuándo usar:**

- Evaluar equipo, ranquear agentes, reporte del Juez
- Después de un full team run o sync
- Periódicamente para evolución continua

**Outputs:**

- `docs/team/judge/JUDGE-REPORT-RUN-YYYY-MM-DD.md` — ranking del run
- `docs/team/judge/JUDGE-REPORT-HISTORICO.md` — promedios por agente
- `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` — criterios por agente

**Referencias:**

- [SKILL.md](../.cursor/skills/bmc-team-judge/SKILL.md)
- [reference.md](../.cursor/skills/bmc-team-judge/reference.md)
- [JUDGE-CRITERIA-POR-AGENTE.md](./judge/JUDGE-CRITERIA-POR-AGENTE.md)

---

## BMC Parallel/Serial Agent

**Skill:** `.cursor/skills/bmc-parallel-serial-agent/`

**Rol:** Evalúa según mejores desempeños en distintas áreas y tareas. Sabe desde cero qué procesos conviene ejecutar en paralelo o en serie. Muy orientado a objetivos; prevé según scores y contexto la mejor combinación de agentes.

**Cuándo usar:**

- Decidir paralelo vs serie para un run
- Optimizar combinación de agentes
- Antes o durante full team run (Orquestador consulta)

**Outputs:**

- `docs/team/parallel-serial/PARALLEL-SERIAL-PLAN-YYYY-MM-DD.md` — plan de ejecución

**Referencias:**

- [SKILL.md](../.cursor/skills/bmc-parallel-serial-agent/SKILL.md)
- [reference.md](../.cursor/skills/bmc-parallel-serial-agent/reference.md)
- JUDGE-REPORT-HISTORICO.md (scores), dependencies.md (dependencias)

---

## BMC Repo Sync Agent

**Skill:** `.cursor/skills/bmc-repo-sync-agent/`

**Rol:** Mantiene actualizados bmc-dashboard-2.0 y bmc-development-team. Tras cada corrida evalúa qué actualizar y sincroniza.

**Cuándo usar:**

- Tras un full team run (paso 7 del Orquestador)
- Cuando se pide sincronizar repos del dashboard y del equipo de desarrollo

**Referencias:**

- [SKILL.md](../.cursor/skills/bmc-repo-sync-agent/SKILL.md)
- [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md) §2
- [INVOQUE-FULL-TEAM.md](./INVOQUE-FULL-TEAM.md)

---

## BMC Docs & Repos Organizer

**Skill:** `.cursor/skills/bmc-docs-and-repos-organizer/`  
**Agente Cursor:** `.cursor/agents/bmc-docs-and-repos-organizer.md`

**Rol:** Ordenar documentación y carpetas bajo `docs/`, detectar huecos u obsoletos, mantener READMEs e índices, y entregar handoff a Repo Sync. Paso **7b** del Orquestador (full team). No sustituye Mapping ni Contract.

**Cuándo usar:**

- Tras un full team run o un bloque grande de cambios en `docs/`
- Cuando se pide: índice, README faltante, enlaces rotos, PR solo-docs, higiene de rutas

**Referencias:**

- [SKILL.md](../.cursor/skills/bmc-docs-and-repos-organizer/SKILL.md)
- [knowledge/DocsOrganizer.md](./knowledge/DocsOrganizer.md)
- [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md) §2 y §4
- [INVOQUE-FULL-TEAM.md](./INVOQUE-FULL-TEAM.md)
