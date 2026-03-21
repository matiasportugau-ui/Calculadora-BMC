# Roadmap de runs — hacia adelante (2026)

**Propósito:** Tener **todos los runs pendientes planificados** de forma secuencia lógica, con un **candado de revisión** antes de cada uno. El plan **no es contrato rígido**: ante hallazgos o cambios de prioridad en el run actual, el Orquestador + MATPROMT **revisan y reordenan** antes de lanzar el siguiente.

**Documentos hermanos:**
- Autopilot numeración histórica: [`AUTOPILOT-FULL-TEAM-RUNS-24-30.md`](./AUTOPILOT-FULL-TEAM-RUNS-24-30.md)
- Pistas técnicas: [`../plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md`](../plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md)
- Input cada “Invoque full team”: [`../PROMPT-FOR-EQUIPO-COMPLETO.md`](../PROMPT-FOR-EQUIPO-COMPLETO.md)
- Estado vivo: [`../PROJECT-STATE.md`](../PROJECT-STATE.md)

---

## 0. Reglas de ejecución (obligatorias)

### 0.1 Revisión pre-run (antes de cada número de run)

| Paso | Quién | Acción |
|------|--------|--------|
| R1 | Orchestrator | Leer `PROJECT-STATE.md`, este roadmap, sección del run que sigue. |
| R2 | Todos los roles afectados | ¿Sigue vigente el objetivo? ¿Hay **bloqueo** nuevo (prod caído, Sheets roto, prioridad negocio)? |
| R3 | MATPROMT | Emitir bundle del run en `MATPROMT-FULL-RUN-PROMPTS.md` **o** `matprompt/MATPROMT-RUN-YYYY-MM-DD-runN.md`. Si el contexto cambió → **DELTA** (solo roles tocados). |
| R4 | Parallel/Serial | Confirmar orden **serie/paralelo** para este run (plan archivo `parallel-serial/PARALLEL-SERIAL-PLAN-*.md`). |
| R5 | Judge (post-run) | Registrar score orientativo + honestidad de pendientes (`judge/JUDGE-REPORT-RUN-*.md`). |

**Si R2 detecta cambio fuerte:** no incrementar “run completado” en tablas; **insertar** un run intermedio (ej. **32b**) o **re-etiquetar** en PROJECT-STATE bajo “DELTA roadmap”.

### 0.2 Artefactos mínimos por run (full team)

`REPORT-SOLUTION-CODING-*` **o** sección equivalente en PROJECT-STATE + actualización `PROMPT` “Próximos prompts” + entrada “Cambios recientes”.

---

## 1. Estado consolidado (al 2026-03-20)

| Bloque | Contenido | Estado |
|--------|-----------|--------|
| **Run 31** | Full team post-autopilot + CI + docs | ✓ (ver PROMPT, Judge run31) |
| **Git / main** | PR #33 merge; `main` con capabilities + presupuesto libre + equipo | ✓ |
| **Pista 1–2** (SOLUCIONES) | Git baseline + smoke prod documentado | ✓ (ver E2E checklist, SOLUCIONES) |
| **Autopilot 24–25** | Git + smoke | ✓ **de facto** alineado a Pista 1–2 + merge (marcar en tabla AUTOPILOT) |
| **Autopilot 26–30** | Sheets → calc opc → audit → SKUs/billing → síntesis | ⬜ **pendiente ejecución real** |
| **Pista 3** | Tabs + triggers Sheets | ⬜ Manual (Matias) |

---

## 2. Secuencia propuesta: Run 32 → Run 39

> **Numeración:** continúa el **full team** después del **run 31**. Si preferís renombrar a “olas” en vez de número, mantener la **columna Autopilot** como referencia.

| Run | Nombre corto | Objetivo | Depende de | Roles foco | Entregables | Estado |
|-----|----------------|----------|------------|------------|-------------|--------|
| **32** | Cierre honesto + contratos | Marcar ✓ real en [AUTOPILOT](./AUTOPILOT-FULL-TEAM-RUNS-24-30.md) 24–25; ejecutar `npm run test:contracts` con API arriba; ampliar E2E checklist si hubo cambios en `/capabilities` | `main` actual | Contract, Audit, Reporter | REPORT + checklist + PASS/FAIL documentado | ⬜ |
| **33** | Pista 3 Sheets (coordinación) | Checklist tabs/triggers; handoff Matias; preparar verificación Mapping/Dependencies cuando cierren tabs | Planilla accesible | Sheets Structure*, Mapping, Dependencies, Integrations | Log en PROJECT-STATE; planilla-inventory sin drift nombres | ✓ (2026-03-20) |
| **34** | Smoke post-Sheets | Re-validar Cloud Run/Vercel; anotar si 503→200 en rutas clave; OAuth/CORS si aplica | Run **33** hecho o documentado “parcial” | Networks, Contract, Audit | E2E checklist actualizado | ✓ (2026-03-20) |
| **35** | Presupuesto libre / canónico | Run **27** autopilot: paridad o ADR `backup` vs `V3`; opcional `PRESUPUESTO_LIBRE_IDS` | Ninguno bloqueante | Calc, Design, Mapping | Código o ADR + tests verdes | ✓ (2026-03-20) |
| **36** | Audit `--force` | Run **28**: Rama dedicada; `npm audit fix --force`; lint/test/build; PR merge **o** abort documentado | Aprobación Matias | Security, Audit, Networks | CHANGELOG + decisión | ✓ (2026-03-20, rama run36-audit-force) |
| **37** | MATRIZ SKUs + billing | Run **29**: col.D vs `matrizPreciosMapping.js`; sanity billing/cierre | Datos negocio | Mapping, Fiscal, Billing, Reporter | Lista SKUs OK/pendiente | ✓ (2026-03-20) |
| **38** | Repos hermanos + GPT drift | Repo Sync externo si aplica; revisar GPT Builder vs `openapi-calc` / `gpt-entry-point` | Red/credenciales | Repo Sync, GPT/Cloud, Security | REPO-SYNC report; nota drift | ✓ (2026-03-20) |
| **39** | Síntesis ciclo (run **30++**) | Cerrar narrativa: pendientes honestos, riesgos, **roadmap siguiente trimestre** | Runs **32–38** mayormente abordados | Orchestrator, Reporter, Judge, MATPROMT | PROMPT “post–39”; opcional Judge formal | ✓ (2026-03-20) |

### 2b. Secuencia Run 40 → Run 50 (extensión itinerante 2026-03-20)

| Run | Nombre corto | Objetivo | Estado |
|-----|----------------|----------|--------|
| **40** | Revisión post-39 | Confirmar pendientes; checklist siguiente ciclo | ✓ (2026-03-20) |
| **41** | Backlog E2E | Revisar E2E checklist; anotar ítems pendientes | ✓ (2026-03-20) |
| **42** | Pista 3 seguimiento | Documentar estado tabs/triggers; handoff Matias vigente | ✓ (2026-03-20) |
| **43** | Billing checklist | Nota cierre mensual; Pagos_Pendientes cuando haya datos | ✓ (2026-03-20) |
| **44** | Contract test | test:contracts con API up cuando corresponda | ✓ (2026-03-20) |
| **45** | Docs actualización | CHANGELOG / README si aplica; estado docs equipo | ✓ (2026-03-20) |
| **46** | Data version check | calculatorDataVersion en main; dev/build OK | ✓ (2026-03-20) |
| **47** | Security checklist | .env, CORS, tokens; sin cambios críticos | ✓ (2026-03-20) |
| **48** | Judge histórico | Promedios runs 32+ en JUDGE-REPORT-HISTORICO | ✓ (2026-03-20) |
| **49** | Preparación run 50 | Handoff y roadmap al día para síntesis | ✓ (2026-03-20) |
| **50** | Síntesis hasta run 50 | Cierre narrativa runs 32–50; siguiente ciclo run 51+ | ✓ (2026-03-20) |

\* *Sheets Structure: ejecución humana Matias; el “run” documenta y verifica.*

---

## 3. Cruzamiento Autopilot 24–30 ↔ Runs 32–39

| Autopilot | Aprox. Run forward | Nota |
|-----------|-------------------|------|
| 24 | ✓ + reflejado en **32** (tabla) | Git/push ya cubierto por `main` y PR #33 |
| 25 | ✓ + reflejado en **32** | Smoke ya en E2E; re-ejecutar si deploy cambia |
| 26 | **33** + **34** | Tabs/triggers + validación prod |
| 27 | **35** | Paridad presupuesto libre / catálogo |
| 28 | **36** | audit --force |
| 29 | **37** | SKUs + billing |
| 30 | **39** | Síntesis + siguiente ciclo |

---

## 4. Plantilla — “DELTA roadmap” (pegar en PROJECT-STATE si cambia el plan)

```markdown
**DELTA roadmap (YYYY-MM-DD):** El run **N** queda **pospuesto / reordenado** porque: …
**Nuevo orden propuesto:** …
**Responsable:** Orchestrator + MATPROMT → actualizar RUN-ROADMAP-FORWARD-2026.md §2 tabla.
```

---

## 5. Próximo paso inmediato

1. Los runs **32–39** y la extensión **40–50** están **cerrados en tabla** (✓ 2026-03-20) con informes / handoff en `PROJECT-STATE.md`; la ejecución humana pendiente sigue siendo **Pista 3** (tabs/triggers) y ítems en `PROMPT-FOR-EQUIPO-COMPLETO.md` (agenda manual).
2. **Run 51** (2026-03-21): **Invoque full team** ejecutado — hub Sheets unificado + síntesis itinerante; artefactos en `docs/team/matprompt/MATPROMT-RUN-2026-03-21-run51.md`, REPORT/Judge/REPO-SYNC run51; ver Cambios recientes en `PROJECT-STATE.md`.
3. **Run 52** (2026-03-22): **Invoque full team** con cierre **R3–R5** — [`matprompt/MATPROMT-RUN-2026-03-22-run52.md`](../matprompt/MATPROMT-RUN-2026-03-22-run52.md), [`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-22-run52.md`](../parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-22-run52.md), [`judge/JUDGE-REPORT-RUN-2026-03-22-run52.md`](../judge/JUDGE-REPORT-RUN-2026-03-22-run52.md); ver `PROJECT-STATE.md` Cambios recientes.
4. Antes del próximo **Invoque full team** numerado: ejecutar **§0.1 Revisión pre-run** para **run 53** (prioridad: **Pista 3**, **E2E**, **Repo Sync** — ver `PROMPT-FOR-EQUIPO-COMPLETO` agenda).

### 5.1 Pre-run 52 — checklist §0.1 (R1–R5) — 2026-03-21 / cerrado 2026-03-22

| Paso | Estado | Nota breve |
|------|--------|------------|
| **R1** Orchestrator | ✓ | `PROJECT-STATE` actualizado (merge run36 + **`git push origin main`**; `npm audit` 0 local). Roadmap §5–§5.1 leídos. |
| **R2** Roles afectados | ✓ | Objetivo run52: operativo/manual + docs; **Pista 3** (tabs/triggers) sigue manual; **E2E** y **Repo Sync** pendientes según agenda. |
| **R3** MATPROMT | ✓ | Bundle **run 52:** [`matprompt/MATPROMT-RUN-2026-03-22-run52.md`](../matprompt/MATPROMT-RUN-2026-03-22-run52.md) + sección en `MATPROMT-FULL-RUN-PROMPTS.md`. |
| **R4** Parallel/Serial | ✓ | [`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-22-run52.md`](../parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-22-run52.md) — **serie** documental. |
| **R5** Judge | ✓ | [`judge/JUDGE-REPORT-RUN-2026-03-22-run52.md`](../judge/JUDGE-REPORT-RUN-2026-03-22-run52.md) + pendientes (E2E, Repo Sync, Pista 3). |

### 5.2 Pre-run 53 — checklist §0.1 (R1–R5) — plantilla

| Paso | Estado | Nota breve |
|------|--------|------------|
| **R1** Orchestrator | ⬜ | Leer `PROJECT-STATE`, este roadmap, sección run 53. |
| **R2** Roles afectados | ⬜ | ¿Sigue vigente Pista 3 / E2E / Repo Sync como foco? |
| **R3** MATPROMT | ⬜ | Bundle run 53 al invocar «Equipo completo». |
| **R4** Parallel/Serial | ⬜ | Plan `PARALLEL-SERIAL-PLAN-*-run53.md`. |
| **R5** Judge | ⬜ | `JUDGE-REPORT-RUN-*-run53.md` post-run. |

---

*Última actualización del documento: 2026-03-22. Mantener fecha al pie tras cada revisión significativa.*
