# Agentes del Proyecto BMC/Panelin

Documentación de agentes especializados disponibles en el repositorio.

---

## CEO AI Agent

**Skill:** `.cursor/skills/ceo-ai-agent/`

**Rol:** Liderar el proyecto con un solo objetivo: **project working by end of week**. Invoca full team run repetidamente hasta alcanzar la meta.

**Cuándo usar:**
- CEO run, CEO agent, CEO AI Agent
- project working by end of week, make it work
- Invoque full team until ready, lead until it works

**Referencias:**
- [SKILL.md](../.cursor/skills/ceo-ai-agent/SKILL.md)
- [CEO-RUN-LOG.md](./team/CEO-RUN-LOG.md) — historial de runs
- [GO-LIVE-DASHBOARD-CHECKLIST.md](./bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md) — criterios de éxito

**Cursor Rule:** `.cursor/rules/ceo-ai-agent.mdc`

---

## BMC Project Team Sync

**Skill:** `.cursor/skills/bmc-project-team-sync/`

**Rol:** Sincronizar estado del proyecto entre todas las áreas. Lee y actualiza PROJECT-STATE.md; ejecuta propagación cuando un cambio afecta a varios agentes.

**Cuándo usar:**
- Sync project state, actualizar estado del proyecto
- Full team run, equipo completo
- Mantener a todos actualizados después de un cambio
- Antes de deploy o revisión de sprint

**Referencias:**
- [SKILL.md](../.cursor/skills/bmc-project-team-sync/SKILL.md)
- [reference.md](../.cursor/skills/bmc-project-team-sync/reference.md)
- [PROJECT-STATE.md](./team/PROJECT-STATE.md)
- [PROJECT-TEAM-FULL-COVERAGE.md](./team/PROJECT-TEAM-FULL-COVERAGE.md)
- Ver [docs/team/README.md](./team/README.md) para índice completo.

**Cursor Rule:** `.cursor/rules/bmc-project-team-sync.mdc`

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
- [JUDGE-CRITERIA-POR-AGENTE.md](./team/judge/JUDGE-CRITERIA-POR-AGENTE.md)

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
