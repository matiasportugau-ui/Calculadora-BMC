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
| **33** | Pista 3 Sheets (coordinación) | Checklist tabs/triggers; handoff Matias; preparar verificación Mapping/Dependencies cuando cierren tabs | Planilla accesible | Sheets Structure*, Mapping, Dependencies, Integrations | Log en PROJECT-STATE; planilla-inventory sin drift nombres | ⬜ |
| **34** | Smoke post-Sheets | Re-validar Cloud Run/Vercel; anotar si 503→200 en rutas clave; OAuth/CORS si aplica | Run **33** hecho o documentado “parcial” | Networks, Contract, Audit | E2E checklist actualizado | ⬜ |
| **35** | Presupuesto libre / canónico | Run **27** autopilot: paridad o ADR `backup` vs `V3`; opcional `PRESUPUESTO_LIBRE_IDS` | Ninguno bloqueante | Calc, Design, Mapping | Código o ADR + tests verdes | ⬜ |
| **36** | Audit `--force` | Run **28**: Rama dedicada; `npm audit fix --force`; lint/test/build; PR merge **o** abort documentado | Aprobación Matias | Security, Audit, Networks | CHANGELOG + decisión | ⬜ |
| **37** | MATRIZ SKUs + billing | Run **29**: col.D vs `matrizPreciosMapping.js`; sanity billing/cierre | Datos negocio | Mapping, Fiscal, Billing, Reporter | Lista SKUs OK/pendiente | ⬜ |
| **38** | Repos hermanos + GPT drift | Repo Sync externo si aplica; revisar GPT Builder vs `openapi-calc` / `gpt-entry-point` | Red/credenciales | Repo Sync, GPT/Cloud, Security | REPO-SYNC report; nota drift | ⬜ |
| **39** | Síntesis ciclo (run **30++**) | Cerrar narrativa: pendientes honestos, riesgos, **roadmap siguiente trimestre** | Runs **32–38** mayormente abordados | Orchestrator, Reporter, Judge, MATPROMT | PROMPT “post–39”; opcional Judge formal | ⬜ |

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

1. Ejecutar **§0.1 Revisión pre-run** para **Run 32**.  
2. Tras Run 32, **no** asumir Run 33 hasta confirmar si Pista 3 está desbloqueada (tiempo Matias).

---

*Última actualización del documento: 2026-03-20. Mantener fecha al pie tras cada revisión significativa.*
