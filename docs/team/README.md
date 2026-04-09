# Equipo Completo BMC/Panelin — Índice

Estructura de documentación del equipo, organizada según decisión del equipo.

---

## Estructura

```
docs/team/
├── README.md                    ← Este índice
├── orientation/                 Hub de programa: arquitectura, cronograma, JSON maestro, npm run program:status
│   ├── README.md
│   ├── PROGRAM-ARCHITECTURE.md
│   ├── CHRONOGRAM-TEMPLATE.md
│   ├── ASYNC-RUNBOOK-UNATTENDED.md   Runbook asíncrono (H0/A/H)
│   ├── EXECUTION-PLAN-MASTER.md      Plan maestro paso a paso + dónde encontrar cada recurso
│   └── programs/bmc-panelin-master.json
├── SESSION-WORKSPACE-CRM.md     Cockpit por sesión: foco, logros recientes, próximos pasos, auto-start agente
├── PROJECT-SCHEDULE.md          Cronograma + rutina: npm run project:compass; enlaces al JSON maestro y follow-ups
├── PROCEDIMIENTO-CANALES-WA-ML-CORREO.md  Checklist WhatsApp → ML → Correo; npm run channels:onboarding
├── HUMAN-GATES-ONE-BY-ONE.md        Intervención humana: URL + menú + “listo cuando” (cm-0, cm-1, cm-2)
├── RUN55-OPERATOR-CHECKLIST.md   Run 55: WA / ML / correo — pasos operador + enlaces a gates y CLI ingest
├── GCLOUD-SHEETS-CREDENTIALS-SIMPLE.md  Sheets en Cloud Run: service account → Secret Manager → mount → GOOGLE_APPLICATION_CREDENTIALS (pasos simples)
├── PROJECT-STATE.md             Fuente única de estado; cambios recientes, pendientes
├── CHAT-EQUIPO-INTERACTIVO.md   Chat/diálogo interactivo con el equipo completo
├── FULL-PROJECT-STATUS-AND-TASK-PLAN.md  Plan task-by-task; evaluación equipo
├── PROJECT-TEAM-FULL-COVERAGE.md Equipo, áreas, propagación, protocolo
├── popular-known-ai-teams/     KB: arquitecturas multi-agente reconocidas (CrewAI, AutoGen, LangGraph, ADK, …) + informe vs BMC
├── panelsim/                    SIM / PANELSIM + SIM-REV: canónico, invocación §5.1 (panelsim:env + start:api), knowledge, matprompt, reports
├── AGENT-SIMULATOR-SIM.md       Stub → panelsim/AGENT-SIMULATOR-SIM.md
├── AGENTS.md                    Lista de agentes y skills
├── plans/                       Planes vigentes
│   ├── PLAN-EQUIPO-3-PASOS-SIGUIENTES.md
│   ├── NEXT-STEPS-RUN-23-2026-03-20.md
│   └── SOLUCIONES-UNO-POR-UNO-2026-03-20.md   ← pistas 1–8, una activa
├── fiscal/                      Supervisión y ranking de criticidad
│   └── FISCAL-PROTOCOL-STATE-RANKING.md
├── knowledge/                   KB por rol (Orchestrator, Mapping, …, DocsOrganizer)
├── judge/                       Evaluación y ranqueo
│   ├── JUDGE-CRITERIA-POR-AGENTE.md
│   └── JUDGE-REPORT-HISTORICO.md
├── parallel-serial/             Planes de ejecución paralelo/serie
│   └── (PARALLEL-SERIAL-PLAN-*.md)
├── interactions/                Instancias documentadas de intercambio cross-learn entre roles §2
│   └── (TEAM-INTERACTION-*.md)
├── ux-feedback/               Informes de navegación usuario → backlog (transcripción + capturas; skill navigation-user-feedback)
│   ├── README.md
│   ├── TEMPLATE-USER-NAV-REPORT.md
│   └── USER-NAV-REPORT-*.md   (generados por sesión)
└── meta/                        Meta-evaluación del equipo
    └── EQUIPO-META-EVALUACION.md
```

---

## Google Sheets — mapeo y sync (canónico)

| Documento | Descripción |
|-----------|-------------|
| [google-sheets-module/README.md](../google-sheets-module/README.md) | **Índice del módulo:** inventario, mapeo código, variables 1:1, sync full team |
| [SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md](../google-sheets-module/SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md) | Quién accede a qué datos (dashboard, API, calculadora, GPT, OmniCRM) |
| [MAPPER-PRECISO-PLANILLAS-CODIGO.md](../google-sheets-module/MAPPER-PRECISO-PLANILLAS-CODIGO.md) | Pestañas/columnas según `bmcDashboard.js` |

---

## Documentos principales

| Documento | Descripción |
|-----------|-------------|
| [PROJECT-STATE.md](./PROJECT-STATE.md) | Estado del proyecto; cambios recientes; pendientes; cómo usar |
| [CHAT-EQUIPO-INTERACTIVO.md](./CHAT-EQUIPO-INTERACTIVO.md) | Chat/diálogo interactivo con el equipo completo |
| [PROTOTIPO-V32-HTML-VS-CALCULADORA-BMC.md](./PROTOTIPO-V32-HTML-VS-CALCULADORA-BMC.md) | Comparativa demo HTML “V3.2 Pro” vs calculadora repo: matriz, auditoría wizard/visor, spec largo global/local, decisión Wolfboard, backlog, QA |
| [PROJECT-SCHEDULE.md](./PROJECT-SCHEDULE.md) | Seguimiento unificado: `npm run project:compass` (fase, tareas, follow-ups); rutina |
| [PROCEDIMIENTO-CANALES-WA-ML-CORREO.md](./PROCEDIMIENTO-CANALES-WA-ML-CORREO.md) | Orden fijo WA → ML → Correo: checklist, comandos, `npm run channels:onboarding` |
| [orientation/README.md](./orientation/README.md) | Programa maestro multi-área: JSON, fases, `npm run program:status` |
| [FULL-PROJECT-STATUS-AND-TASK-PLAN.md](./FULL-PROJECT-STATUS-AND-TASK-PLAN.md) | Plan task-by-task para full operacional; evaluación equipo |
| [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md) | Equipo completo; áreas; roles; propagación; full team run |
| [RUN-SCOPE-GATE.md](./RUN-SCOPE-GATE.md) | **Run Scope Gate:** objetivo del run + matriz Profundo/Ligero/N/A por rol (ahorro sin borrar §2) |
| [FULL-TEAM-RUN-DEFINITION.md](./FULL-TEAM-RUN-DEFINITION.md) | **Definición canónica:** Full Team Run = objetivo central + loop + evaluación autónoma + docs + próximas tareas pré-evaluadas |
| [popular-known-ai-teams/](./popular-known-ai-teams/) | KB industria + [cuadro comparativo 12×7](./popular-known-ai-teams/COMPARATIVE-MATRIX-BMC-VS-INDUSTRY.md) + [informe BMC](./popular-known-ai-teams/IMPLEMENTATION-REPORT-BMC-PANELIN.md) |
| [RUN-MODES-AND-TRIGGERS.md](./RUN-MODES-AND-TRIGGERS.md) | R1–R4, triggers, mejores prácticas §7, plantillas de comunicación |
| [panelsim/README.md](./panelsim/README.md) | SIM / PANELSIM: hub; proceso al invocar (`panelsim:env`, `start:api`) en canónico §5.1 |
| [AGENTS.md](./AGENTS.md) | Agentes documentados (Judge, Parallel/Serial, Networks, Sync, Docs Organizer) |
| [knowledge/DocsOrganizer.md](./knowledge/DocsOrganizer.md) | KB del rol §2 Docs & Repos Organizer (índices, READMEs, handoff Repo Sync) |
| [interactions/](./interactions/) | Instancias de interacción equipo (ej. análisis cruzado de documentos externos) |
| [ux-feedback/README.md](./ux-feedback/README.md) | **Feedback de navegación:** plantilla + informes `USER-NAV-REPORT-*`; skill `navigation-user-feedback` |
| [calculadora/CANONICAL-PRODUCTION.md](../calculadora/CANONICAL-PRODUCTION.md) | **Calculadora prod canónica:** Cloud Run unificado; [`RELEASE-CHECKLIST-CALCULADORA.md`](../calculadora/RELEASE-CHECKLIST-CALCULADORA.md), [`RELEASE-BRIEF-OFFICIAL.md`](../calculadora/RELEASE-BRIEF-OFFICIAL.md) |

---

## Por rol

| Rol | Documentos |
|-----|------------|
| **Fiscal** | [fiscal/FISCAL-PROTOCOL-STATE-RANKING.md](./fiscal/FISCAL-PROTOCOL-STATE-RANKING.md) |
| **Judge** | [judge/JUDGE-CRITERIA-POR-AGENTE.md](./judge/JUDGE-CRITERIA-POR-AGENTE.md), [judge/JUDGE-REPORT-HISTORICO.md](./judge/JUDGE-REPORT-HISTORICO.md) |
| **Parallel/Serial** | [parallel-serial/](./parallel-serial/) — planes de ejecución |
| **Docs & Repos Organizer** | [knowledge/DocsOrganizer.md](./knowledge/DocsOrganizer.md); skill `bmc-docs-and-repos-organizer` (paso 7b) |
| **Orquestador** | PROJECT-TEAM-FULL-COVERAGE §5.4; bmc-dashboard-team-orchestrator |

---

## Planes y meta

| Documento | Descripción |
|-----------|-------------|
| [reports/RUN-ROADMAP-FORWARD-2026.md](./reports/RUN-ROADMAP-FORWARD-2026.md) | **Runs 32–39** planificados; **revisión pre-run** §0.1; DELTA ante cambios de prioridad |
| [reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md](./reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md) | Pack documental autopilot **24–30**; tabla ⬜/✓ de ejecución real |
| [plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md](./plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md) | Plan por solución (8 pistas); avance **uno por uno**; empezar Pista 1 Git |
| [plans/NEXT-STEPS-RUN-23-2026-03-20.md](./plans/NEXT-STEPS-RUN-23-2026-03-20.md) | Run 23: lint, tests, npm audit sin --force |
| [plans/PLAN-EQUIPO-3-PASOS-SIGUIENTES.md](./plans/PLAN-EQUIPO-3-PASOS-SIGUIENTES.md) | Plan vigente: Paso 1 (C2,C6,C7), Paso 2 (S1+C1-C5), Paso 3 (hardening) |
| [meta/EQUIPO-META-EVALUACION.md](./meta/EQUIPO-META-EVALUACION.md) | Overlaps, gaps, mejoras orquestación, skills a configurar |
