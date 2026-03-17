# Parallel/Serial Plan — KPI Report Implementation

**Fecha:** 2026-03-16  
**Objetivo:** Implementar KPI Report (inicio) con 5 KPIs + objetivo mensual para equilibrio.

---

## Contexto

- **Run tipo:** Implementation (no agent development).
- **Pendiente:** KPI Report (inicio) — endpoint `/api/kpi-report` + bloque UI "KPI Report — Inicio".
- **APIs existentes:** kpi-financiero, stock-kpi, proximas-entregas, metas-ventas, ventas.

---

## Plan de ejecución

| Paso | Rol | Serie/Paralelo | Justificación |
|------|-----|----------------|---------------|
| 0 | Orchestrator | — | Leer PROJECT-STATE, pendientes, contexto |
| 0b | Parallel/Serial | — | Este plan |
| 1 | Orchestrator | Serie | Plan confirmado |
| 2 | Mapping | Serie | Verificar Metas_Ventas en planilla-inventory y DASHBOARD-INTERFACE-MAP |
| 3 | Dependencies | Serie | Actualizar dependencias |
| 3b | Contract | Serie | Validar contrato futuro /api/kpi-report |
| 3c | Networks | Paralelo con 4 | Infra status (independiente) |
| 4 | Design | Serie | Propuesta UX tras Mapping |
| 4b | Integrations | Skip | No cambios ML/Shopify |
| 5 | Reporter | Serie | REPORT-SOLUTION-CODING.md, IMPLEMENTATION-PLAN-SOLUTION-CODING.md |
| 5b–5g | Security, GPT/Cloud, Fiscal, Billing, Audit, Calc | Paralelo | Status briefs |
| 6 | Judge | Serie | Evaluación tras implementación |
| 7 | Repo Sync | Skip | Repos no configurados |
| 8 | Orchestrator | Serie | Update PROJECT-STATE |
| 9 | Implement | Serie | Endpoint + UI bloque (Coding) |

---

## Recomendación

**Ejecución en serie** para Mapping → Design → Reporter → Contract → Implementation. Dependencias claras: Mapping define estructura, Design propone UX, Reporter produce plan, Coding implementa.

**Sin clones:** Tarea única y acotada; no requiere paralelización de agentes.

---

## Referencias

- JUDGE-REPORT-HISTORICO: todos los roles 5/5.
- dependencies.md: bmcDashboard.js → Sheets, config.
