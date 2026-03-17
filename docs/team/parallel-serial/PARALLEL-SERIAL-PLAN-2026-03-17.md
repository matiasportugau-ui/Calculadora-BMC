# Parallel/Serial Plan — Full Team Run 2026-03-17

**Fecha:** 2026-03-17  
**Objetivo:** Full team run completo (steps 0–9) con full project sync, Repo Sync setup, y git push.

---

## Contexto

- **Run tipo:** Full team run (19 miembros).
- **Pendientes:** Go-live, Phase 2 PUSH manual, Repo Sync (repos no configurados).
- **Estado:** KPI Report implementado; contract validation 3/3 (kpi-report 404 en runtime — verificar mount).

---

## Plan de ejecución

| Paso | Rol | Serie/Paralelo | Justificación |
|------|-----|----------------|---------------|
| 0 | Orchestrator | — | Leer PROJECT-STATE, PROMPT, BACKLOG |
| 0b | Parallel/Serial | — | Este plan |
| 1 | Orchestrator | Serie | Plan confirmado |
| 2 | Mapping | Serie | planilla-inventory, DASHBOARD-INTERFACE-MAP vigentes |
| 3–3c | Dependencies, Contract, Networks | Serie | Dependencies → Contract → Networks |
| 4–4b | Design, Integrations | Paralelo | Status briefs independientes |
| 5–5g | Reporter, Security, GPT, Fiscal, Billing, Audit, Calc | Paralelo | Status briefs |
| 6 | Judge | Serie | Evaluación tras run |
| 7 | Repo Sync | Serie | Setup doc (repos no config) |
| 8–9 | Orchestrator | Serie | PROJECT-STATE, improvement cycle |

---

## Recomendación

**Ejecución en serie** para pasos con dependencias; **paralelo** para status briefs (Design, Integrations, Reporter, Security, GPT, Fiscal, Billing, Audit, Calc) que no se bloquean entre sí.

**Sin clones:** Run estándar; todos los 19 miembros ejecutados en orden.

---

## Referencias

- JUDGE-REPORT-HISTORICO: todos los roles 5/5.
- dependencies.md: bmcDashboard.js → Sheets, config.
