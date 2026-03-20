# Parallel / Serial Execution Plan

**Run:** 2026-03-17 run 1
**Target:** Invoque full team (orchestrator default order)

## Contexto del run
- Los 19 agentes están `Desarrollados` (ver IMPROVEMENT-BACKLOG-BY-AGENT.md).
- Paso 9 (prompts activos): sin entregables automatizables en este run. Todo depende de acciones manuales de Matias (tabs, deploy, E2E).

## Plan de ejecución

| Fase | Modalidad | Agentes invocados | Dependencias | Justificación |
|------|-----------|-------------------|--------------|---------------|
| 1 | **Serie** | Orchestrator (Paso 0) | Ninguna | Sincronización base |
| 2 | **Paralelo** | Mapping, Dependencies, Contract, Networks, Design, Integrations, Reporter, Security, GPT/Cloud, Fiscal, Billing, Audit/Debug, Calc | Orchestrator | Ejecución transversal rutinaria y validaciones asíncronas |
| 3 | **Serie** | Judge, Repo Sync | Fase 2 | Evaluación global final requiere todos los reportes de Fase 2 completados |
| 4 | **Serie** | Orchestrator (Paso 8 y 9) | Fase 3 | Actualización de PROJECT-STATE y promt final |
