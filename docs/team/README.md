# Equipo Completo BMC/Panelin — Índice

Estructura de documentación del equipo, organizada según decisión del equipo.

---

## Estructura

```
docs/team/
├── README.md                    ← Este índice
├── PROJECT-STATE.md             Fuente única de estado; cambios recientes, pendientes
├── FULL-PROJECT-STATUS-AND-TASK-PLAN.md  Plan task-by-task; evaluación equipo
├── PROJECT-TEAM-FULL-COVERAGE.md Equipo, áreas, propagación, protocolo
├── CHAT-EQUIPO-INTERACTIVO.md    Chat interactivo — diálogo con el equipo
├── INVOQUE-FULL-TEAM.md          Invocación unificada full team run
├── AGENTS.md                     Lista de agentes y skills
├── plans/                       Planes vigentes
│   └── PLAN-EQUIPO-3-PASOS-SIGUIENTES.md
├── fiscal/                      Supervisión y ranking de criticidad
│   └── FISCAL-PROTOCOL-STATE-RANKING.md
├── judge/                       Evaluación y ranqueo
│   ├── JUDGE-CRITERIA-POR-AGENTE.md
│   └── JUDGE-REPORT-HISTORICO.md
├── parallel-serial/             Planes de ejecución paralelo/serie
│   └── (PARALLEL-SERIAL-PLAN-*.md)
└── meta/                        Meta-evaluación del equipo
    └── EQUIPO-META-EVALUACION.md
```

---

## Documentos principales

| Documento | Descripción |
|-----------|-------------|
| [PROJECT-STATE.md](./PROJECT-STATE.md) | Estado del proyecto; cambios recientes; pendientes; cómo usar |
| [FULL-PROJECT-STATUS-AND-TASK-PLAN.md](./FULL-PROJECT-STATUS-AND-TASK-PLAN.md) | Plan task-by-task para full operacional; evaluación equipo |
| [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md) | Equipo completo; áreas; roles; propagación; full team run |
| [AGENTS.md](./AGENTS.md) | Agentes documentados (Judge, Parallel/Serial, Networks, Sync) |
| [CHAT-EQUIPO-INTERACTIVO.md](./CHAT-EQUIPO-INTERACTIVO.md) | **Chat interactivo** — diálogo conversacional con el equipo (vs full run batch) |
| [INVOQUE-FULL-TEAM.md](./INVOQUE-FULL-TEAM.md) | Invocación unificada del full team run |

---

## Por rol

| Rol | Documentos |
|-----|------------|
| **Fiscal** | [fiscal/FISCAL-PROTOCOL-STATE-RANKING.md](./fiscal/FISCAL-PROTOCOL-STATE-RANKING.md) |
| **Judge** | [judge/JUDGE-CRITERIA-POR-AGENTE.md](./judge/JUDGE-CRITERIA-POR-AGENTE.md), [judge/JUDGE-REPORT-HISTORICO.md](./judge/JUDGE-REPORT-HISTORICO.md) |
| **Parallel/Serial** | [parallel-serial/](./parallel-serial/) — planes de ejecución |
| **Orquestador** | PROJECT-TEAM-FULL-COVERAGE §5.4; bmc-dashboard-team-orchestrator |
| **Chat interactivo** | [CHAT-EQUIPO-INTERACTIVO.md](./CHAT-EQUIPO-INTERACTIVO.md) — "Chat con el equipo" para diálogo conversacional |

---

## Planes y meta

| Documento | Descripción |
|-----------|-------------|
| [plans/PLAN-EQUIPO-3-PASOS-SIGUIENTES.md](./plans/PLAN-EQUIPO-3-PASOS-SIGUIENTES.md) | Plan vigente: Paso 1 (C2,C6,C7), Paso 2 (S1+C1-C5), Paso 3 (hardening) |
| [meta/EQUIPO-META-EVALUACION.md](./meta/EQUIPO-META-EVALUACION.md) | Overlaps, gaps, mejoras orquestación, skills a configurar |
