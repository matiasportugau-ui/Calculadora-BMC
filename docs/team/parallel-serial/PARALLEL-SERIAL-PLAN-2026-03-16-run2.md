# Parallel/Serial Plan — Full Team Run 2026-03-16 (Run 6)

**Fecha:** 2026-03-16
**Objetivo:** Full team run completo (steps 0–9) — Go-live & hardening. Ejecutar 7 ítems de la agenda activa de PROMPT-FOR-EQUIPO-COMPLETO.

---

## Contexto

- **Run tipo:** Full team run (19 miembros).
- **Agenda activa (paso 9):** 7 ítems go-live & hardening.
- **Scores JUDGE histórico:** Todos los agentes evaluados ≥ N/A; 8 agentes con score 5/5; 11 pendientes de evaluación formal.
- **Pendientes críticos:** Repo Sync no configurado; kpi-report 404 en runtime (verificar mount); npm audit 7 vulns; tabs manuales pendientes.

---

## Plan de ejecución

| Paso | Rol | Serie/Paralelo | Justificación |
|------|-----|----------------|---------------|
| 0 | Orchestrator | Serie | Leer PROJECT-STATE, PROMPT, BACKLOG |
| 0b | Parallel/Serial | Serie | Este plan |
| 1 | Orchestrator | Serie | Plan confirmado |
| 2 | Mapping | Serie | Verificar planilla-inventory vigente |
| 3–3c | Dependencies, Contract, Networks | Serie | Dependencies → Contract → Networks (dependencias en cadena) |
| 4–4b | Design, Integrations | Paralelo | Status briefs independientes |
| 5–5g | Reporter, Security, GPT, Fiscal, Billing, Audit, Calc | Paralelo | Status briefs sin dependencias entre sí |
| 6 | Judge | Serie | Evaluación tras run completo — evaluar 19 agentes |
| 7 | Repo Sync | Serie | Check .env → repos no configurados; documentar skip |
| 8 | Orchestrator | Serie | Actualizar PROJECT-STATE |
| 9 | Orquestador + roles asignados | Serie | 7 ítems agenda activa |

---

## Agenda paso 9 — asignación por rol

| Ítem | Rol asignado | Prioridad |
|------|-------------|-----------|
| 1. Repo Sync — documentar skip + instrucciones | Repo Sync | Alta |
| 2. npm audit — análisis vulns y plan fix | Audit/Debug | Media |
| 3. Tabs manuales — instrucciones detalladas | Sheets Structure / Mapping | Alta |
| 4. Triggers Apps Script — instrucciones configuración | Networks / Audit | Alta |
| 5. kpi-report runtime — verificación y service-map | Contract | Alta |
| 6. Judge — evaluar 19 agentes con criterios formales | Judge | Alta |
| 7. Reporter — IMPLEMENTATION-PLAN post-go-live | Reporter | Media |

---

## Recomendación

**Serie para pasos con dependencias:** 0 → 0b → 1 → 2 → 3 → 3b → 3c → 4 → 5 → 6 → 7 → 8 → 9.
**Paralelo para status briefs:** Design + Integrations (paso 4/4b); Reporter + Security + GPT + Fiscal + Billing + Audit + Calc (paso 5–5g).
**Sin clones:** Run estándar.

---

## Referencias

- JUDGE-REPORT-HISTORICO: 8 agentes 5/5; 11 N/A.
- dependencies.md: bmcDashboard.js → Sheets, config.
- Agenda activa: `docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md` §"Próximos prompts".
