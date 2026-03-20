# Autopilot Full Team — Runs 24 a 30

**Fecha generación:** 2026-03-20  
**Modo:** Secuencia **documental** (artefactos equipo + orden de trabajo). La ejecución humana (Git, Sheets, deploy) sigue siendo la fuente de verdad; este paquete evita “saltar” pasos entre full team runs.

**Índice cruzado:**
- **Judge formal (un archivo por run):** [run24](../judge/JUDGE-REPORT-RUN-2026-03-20-run24.md) · [run25](../judge/JUDGE-REPORT-RUN-2026-03-20-run25.md) · [run26](../judge/JUDGE-REPORT-RUN-2026-03-20-run26.md) · [run27](../judge/JUDGE-REPORT-RUN-2026-03-20-run27.md) · [run28](../judge/JUDGE-REPORT-RUN-2026-03-20-run28.md) · [run29](../judge/JUDGE-REPORT-RUN-2026-03-20-run29.md) · [run30](../judge/JUDGE-REPORT-RUN-2026-03-20-run30.md)
- Judge (resumen agregado): [`../judge/JUDGE-REPORT-AUTOPILOT-RUN24-30.md`](../judge/JUDGE-REPORT-AUTOPILOT-RUN24-30.md)
- MATPROMT (prompts): [`../matprompt/MATPROMT-RUN-AUTOPILOT-24-30.md`](../matprompt/MATPROMT-RUN-AUTOPILOT-24-30.md)
- Parallel/Serial: [`../parallel-serial/PARALLEL-SERIAL-AUTOPILOT-24-30.md`](../parallel-serial/PARALLEL-SERIAL-AUTOPILOT-24-30.md)

**Mapa a pistas:** [SOLUCIONES-UNO-POR-UNO-2026-03-20.md](../plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md)

---

## Run 24 — Línea base Git + Repo Sync cerrado

**Judge formal:** [JUDGE-REPORT-RUN-2026-03-20-run24.md](../judge/JUDGE-REPORT-RUN-2026-03-20-run24.md)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Pista **1** — commit/push trazable; cerrar gap “push no verificado” heredado de run22. |
| **Roles foco** | Repo Sync, Orchestrator, Calc (verificación CI), Security (sin secretos en diff). |
| **Serie** | `git status` → diff review → `npm run lint` + `npm test` → commit(s) → `git push`. |
| **Entregables** | Remoto al día; PROJECT-STATE “Pendientes” actualizado si repo es canónico. |
| **Riesgo** | Commits mezclados → preferir 2–3 commits temáticos. |

---

## Run 25 — Smoke producción (Cloud Run + Vercel)

**Judge formal:** [JUDGE-REPORT-RUN-2026-03-20-run25.md](../judge/JUDGE-REPORT-RUN-2026-03-20-run25.md)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Pista **2** — smoke API/UI antes de invertir en Sheets. |
| **Roles foco** | Networks, Contract, Audit/Debug, Reporter. |
| **Serie** | URL base → curl health/kpi → calculadora Vercel flujo mínimo → marcar [E2E-VALIDATION-CHECKLIST.md](../E2E-VALIDATION-CHECKLIST.md). |
| **Entregables** | Checklist parcial firmado; nota 503 vs 404 documentada. |
| **Riesgo** | 503 Sheets — OK si semántica 503 acordada en AGENTS. |

---

## Run 26 — Sheets: tabs + triggers (manual coordinado)

**Judge formal:** [JUDGE-REPORT-RUN-2026-03-20-run26.md](../judge/JUDGE-REPORT-RUN-2026-03-20-run26.md)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Pista **3** — desbloquear automatizaciones según AUTOMATIONS-BY-WORKBOOK. |
| **Roles foco** | Sheets Structure (Matias), Mapping, Dependencies, Integrations. |
| **Serie** | Leer checklist → crear tabs → triggers Apps Script → verificar → actualizar planilla-inventory si schema cambia. |
| **Entregables** | Log en PROJECT-STATE o IMPLEMENTATION-PLAN; sin drift de nombres de tabs. |
| **Riesgo** | Nombre de tab distinto → romper rutas API. |

---

## Run 27 — Calculadora: presupuesto libre en backup + catálogo (opcional)

**Judge formal:** [JUDGE-REPORT-RUN-2026-03-20-run27.md](../judge/JUDGE-REPORT-RUN-2026-03-20-run27.md)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Paridad UX **Presupuesto libre** entre `PanelinCalculadoraV3.jsx` y `PanelinCalculadoraV3_backup.jsx` si backup sigue en uso; opcional acotar tornillería a `PRESUPUESTO_LIBRE_IDS`. |
| **Roles foco** | Calc, Design, Mapping (MATRIZ col.D). |
| **Serie** | Decisión “¿backup es canónico?” → port/UI o documentar deprecación → tests. |
| **Entregables** | Código o ADR corto en docs/team; tests verdes. |
| **Riesgo** | Duplicar lógica divergente — preferir una fuente de verdad. |

---

## Run 28 — Seguridad deps: rama `audit fix --force`

**Judge formal:** [JUDGE-REPORT-RUN-2026-03-20-run28.md](../judge/JUDGE-REPORT-RUN-2026-03-20-run28.md)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Pista **4** — reducir vulns con decisión explícita Matias (breaking Vite u otras). |
| **Roles foco** | Security, Audit/Debug, Networks (si deploy afectado). |
| **Serie** | Rama dedicada → `npm audit fix --force` → lint/test/build → PR o descarte documentado. |
| **Entregables** | CHANGELOG + PROJECT-STATE con decisión merge/no merge. |
| **Riesgo** | Romper Vite — **no** merge a main sin build OK. |

---

## Run 29 — MATRIZ SKUs + billing sanity

**Judge formal:** [JUDGE-REPORT-RUN-2026-03-20-run29.md](../judge/JUDGE-REPORT-RUN-2026-03-20-run29.md)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Pista **5–6** — validar `matrizPreciosMapping.js` vs col.D; revisión ligera billing/cierre (export/sample). |
| **Roles foco** | Mapping, Fiscal, Billing, Reporter. |
| **Serie** | Cruce SKUs → actualizar mapping → nota fiscal/billing en PROJECT-STATE. |
| **Entregables** | Lista “SKUs confirmados / pendientes”; sin hardcodear IDs de sheet en código. |
| **Riesgo** | Placeholders en mapping — marcar explícitamente hasta confirmar negocio. |

---

## Run 30 — Síntesis operativa + backlog siguiente ciclo

**Judge formal:** [JUDGE-REPORT-RUN-2026-03-20-run30.md](../judge/JUDGE-REPORT-RUN-2026-03-20-run30.md) (incluye tabla de índice 24–30)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Cierre **autopilot**: resumen de 24–29, riesgos abiertos, “próximos prompts” para run31+. |
| **Roles foco** | Orchestrator, Reporter, Judge, MATPROMT, Parallel/Serial. |
| **Serie** | Leer PROJECT-STATE → consolidar pendientes → actualizar PROMPT + MATPROMT histórico + Judge histórico. |
| **Entregables** | Este índice considerado **cerrado** salvo nueva agenda usuario; próxima invocación full team usa PROMPT “post run30”. |
| **Riesgo** | Asumir hecho lo que solo está planificado — marcar ⬜/✓ honestamente en PROJECT-STATE. |

---

## Estado honesto (plantilla para quien ejecute)

| Run | Estado ejecución real | Nota |
|-----|----------------------|------|
| 24 | ✓ **2026-03-20** | Alineado a Pista 1 SOLUCIONES + PR **#33** → `main`; ver [RUN-ROADMAP-FORWARD-2026.md](./RUN-ROADMAP-FORWARD-2026.md) §1. |
| 25 | ✓ **2026-03-20** | Smoke prod documentado en [E2E-VALIDATION-CHECKLIST.md](../E2E-VALIDATION-CHECKLIST.md) §Resultados smoke; 503 Sheets coherente. |
| 26 | ⬜ Pendiente | Pista 3 — tabs/triggers (Matias). |
| 27 | ⬜ Pendiente | Paridad presupuesto libre / `PRESUPUESTO_LIBRE_IDS` — plan **Run 35** en roadmap forward. |
| 28 | ⬜ Pendiente | Rama `npm audit fix --force` — plan **Run 36**. |
| 29 | ⬜ Pendiente | SKUs col.D + billing — plan **Run 37**. |
| 30 | ⬜ Pendiente | Síntesis ciclo — plan **Run 39**. |

**Runs siguientes (full team 32+):** ver [RUN-ROADMAP-FORWARD-2026.md](./RUN-ROADMAP-FORWARD-2026.md) (revisión pre-run obligatoria antes de cada uno).

*(Reemplazar ⬜ por ✓ y fecha cuando Matias/código cierren cada run.)*
