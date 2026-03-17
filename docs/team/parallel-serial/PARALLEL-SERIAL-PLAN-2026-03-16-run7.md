# Parallel/Serial Plan — Full Team Run 2026-03-16 (Run 7)

**Fecha:** 2026-03-16
**Run ID:** run7
**Objetivo:** Full team run post-go-live — agenda: kpi-report verify, npm audit analysis, guía vendedores, E2E checklist, deploy guidance, Repo Sync attempt.

---

## Contexto

- **Run tipo:** Full team run (19 miembros).
- **Agenda activa (PROMPT-FOR-EQUIPO-COMPLETO §Próximos prompts):**
  1. [Matias] Crear tabs y configurar triggers — pendiente Matias.
  2. [Coding] Verificar kpi-report runtime — ejecutable via análisis código.
  3. [Networks + Matias] Deploy productivo — orientación equipo.
  4. [Reporter] Crear GUIA-RAPIDA-VENDEDORES.md — ejecutable este run.
  5. [Audit/Debug] E2E validation checklist — ejecutable.
  6. [Coding + Matias] npm audit fix — análisis ya disponible.
  7. [Matias] Configurar Repo Sync — repos en .env ✓; verificar repos remotos.

- **Estado JUDGE-HISTORICO:** Promedio run 6 = 4.78/5. Sheets Structure (4.0), GPT/Cloud (4.3), Billing (4.3) áreas de atención.
- **kpi-report:** Ruta en línea 1130 de bmcDashboard.js → montada bajo /api; debe resolverse con restart.
- **Repo Sync:** URLs en .env; repos remotos no verificados aún.

---

## Plan de ejecución

| Paso | Rol | Serie/Paralelo | Justificación |
|------|-----|----------------|---------------|
| 0 | Orchestrator | Serie | Leer PROJECT-STATE, PROMPT, BACKLOG |
| 0b | Parallel/Serial | Serie | Este plan |
| 1 | Orchestrator | Serie | Plan & proposal confirm |
| 2 | Mapping | Serie | Verificar planilla-inventory, DASHBOARD-INTERFACE-MAP vigente |
| 3–3c | Dependencies, Contract, Networks | Serie | Dependencies → Contract → Networks |
| 4–4b | Design, Integrations | Paralelo | Status briefs independientes |
| 5–5g | Reporter, Security, GPT, Fiscal, Billing, Audit, Calc | Paralelo | Status briefs; Audit ejecuta E2E checklist |
| 6 | Judge | Serie | Evaluación formal 19/19 |
| 7 | Repo Sync | Serie | Intento sync; documentar resultado |
| 8 | Orchestrator | Serie | PROJECT-STATE update |
| 9 | Orchestrator + roles | Serie | Ciclo mejoras: guía vendedores, agenda siguiente run |

---

## Prioridad de agenda este run

| # | Ítem | Owner | Ejecutable ahora |
|---|------|-------|-----------------|
| 1 | Crear tabs + triggers | Matias | No — documentar recordatorio |
| 2 | Verificar kpi-report | Coding/Contract | Sí — análisis código |
| 3 | Deploy productivo | Networks + Matias | Orientación sí, ejecución Matias |
| 4 | Guía vendedores | Reporter | Sí — crear doc |
| 5 | E2E validation checklist | Audit | Sí — crear/actualizar checklist |
| 6 | npm audit fix | Audit | Análisis vigente; acción Matias |
| 7 | Repo Sync | Repo Sync | Verificar repos remotos |

---

## Recomendación de clones

**Sin clones este run.** 19 miembros estándar. Paralelismo en pasos 4–5g por ser status briefs.

---

## Referencias

- JUDGE-REPORT-HISTORICO: Mapping 5.0, Design 5.0, Audit 5.0, Reporter 5.0, Security 5.0 — priorizar para tareas complejas.
- Sheets Structure 4.0, GPT/Cloud 4.3, Billing 4.3 — área de mejora continua.
- dependencies.md + service-map.md vigentes (2025-03-15; actualizar fecha este run).
