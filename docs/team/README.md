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
├── AGENTS.md                    Lista de agentes y skills
├── plans/                       Planes vigentes
│   ├── PLAN-EQUIPO-3-PASOS-SIGUIENTES.md
│   ├── NEXT-STEPS-RUN-23-2026-03-20.md
│   └── SOLUCIONES-UNO-POR-UNO-2026-03-20.md   ← pistas 1–8, una activa
├── fiscal/                      Supervisión y ranking de criticidad
│   └── FISCAL-PROTOCOL-STATE-RANKING.md
├── judge/                       Evaluación y ranqueo
│   ├── JUDGE-CRITERIA-POR-AGENTE.md
│   └── JUDGE-REPORT-HISTORICO.md
├── parallel-serial/             Planes de ejecución paralelo/serie
│   └── (PARALLEL-SERIAL-PLAN-*.md)
├── interactions/                Instancias documentadas de intercambio cross-learn entre roles §2
│   └── (TEAM-INTERACTION-*.md)
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
| [interactions/](./interactions/) | Instancias de interacción equipo (ej. análisis cruzado de documentos externos) |

---

## Por rol

| Rol | Documentos |
|-----|------------|
| **Fiscal** | [fiscal/FISCAL-PROTOCOL-STATE-RANKING.md](./fiscal/FISCAL-PROTOCOL-STATE-RANKING.md) |
| **Judge** | [judge/JUDGE-CRITERIA-POR-AGENTE.md](./judge/JUDGE-CRITERIA-POR-AGENTE.md), [judge/JUDGE-REPORT-HISTORICO.md](./judge/JUDGE-REPORT-HISTORICO.md) |
| **Parallel/Serial** | [parallel-serial/](./parallel-serial/) — planes de ejecución |
| **Orquestador** | PROJECT-TEAM-FULL-COVERAGE §5.4; bmc-dashboard-team-orchestrator |

---

## Planes y meta

| Documento | Descripción |
|-----------|-------------|
| [plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md](./plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md) | Plan por solución (8 pistas); avance **uno por uno**; empezar Pista 1 Git |
| [plans/NEXT-STEPS-RUN-23-2026-03-20.md](./plans/NEXT-STEPS-RUN-23-2026-03-20.md) | Run 23: lint, tests, npm audit sin --force |
| [plans/PLAN-EQUIPO-3-PASOS-SIGUIENTES.md](./plans/PLAN-EQUIPO-3-PASOS-SIGUIENTES.md) | Plan vigente: Paso 1 (C2,C6,C7), Paso 2 (S1+C1-C5), Paso 3 (hardening) |
| [meta/EQUIPO-META-EVALUACION.md](./meta/EQUIPO-META-EVALUACION.md) | Overlaps, gaps, mejoras orquestación, skills a configurar |
