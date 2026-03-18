# Parallel/Serial Plan — Full Team Run 2026-03-17 (Run 6)

**Fecha:** 2026-03-17
**Run ID:** run6
**Objetivo:** Full team run (Invoque full team) — maintenance mode; 19/19 agentes desarrollados. Verificar estado vigente, actualizar artefactos, ciclo de mejoras.

---

## Contexto

- **Run tipo:** Full team run (19 miembros).
- **Estado:** Maintenance mode. Todos los 19 agentes desarrollados. Pendientes: tabs/triggers (Matias), deploy, npm audit fix --force, kpi-report runtime verify, E2E validation.
- **Agenda PROMPT-FOR-EQUIPO-COMPLETO:** Sin prompts automatizables; pendientes 1, 3, 6, 7 requieren Matias manual.
- **JUDGE-HISTORICO:** Promedio run 7 = 4.93/5. Sheets Structure (4.0) área de atención.

---

## Plan de ejecución

| Paso | Rol | Serie/Paralelo | Justificación |
|------|-----|----------------|---------------|
| 0 | Orchestrator | Serie | Leer PROJECT-STATE, PROMPT, BACKLOG |
| 0b | Parallel/Serial | Serie | Este plan |
| 1 | Orchestrator | Serie | Plan & proposal confirm |
| 2 | Mapping | Serie | Verificar planilla-inventory, DASHBOARD-INTERFACE-MAP vigente |
| 2b | Sheets Structure | Skip | No cambios estructurales; Matias only |
| 3–3c | Dependencies, Contract, Networks | Serie | Dependencies → Contract → Networks |
| 4–4b | Design, Integrations | Paralelo | Status briefs independientes |
| 5–5g | Reporter, Security, GPT, Fiscal, Billing, Audit, Calc | Paralelo | Status briefs |
| 6 | Judge | Serie | Evaluación formal 19/19 |
| 7 | Repo Sync | Serie | Sync bmc-dashboard-2.0 y bmc-development-team |
| 8 | Orchestrator | Serie | PROJECT-STATE update |
| 9 | Orchestrator + roles | Serie | Ciclo mejoras; actualizar PROMPT y BACKLOG |

---

## Prioridad de agenda

| # | Ítem | Owner | Ejecutable ahora |
|---|------|-------|-----------------|
| 1 | Crear tabs + triggers | Matias | No — manual |
| 3 | Deploy productivo | Networks + Matias | Orientación sí |
| 6 | npm audit fix --force | Matias | No — requiere aprobación |
| 7 | Repo Sync | Repo Sync | Sí — verificar y sync |

---

## Recomendación de clones

**Sin clones.** 19 miembros estándar. Paralelismo en pasos 4–5g por ser status briefs.

---

## Referencias

- JUDGE-REPORT-HISTORICO: Promedio 4.93/5 run 7.
- dependencies.md, service-map.md vigentes.
- PROJECT-STATE: maintenance mode.
