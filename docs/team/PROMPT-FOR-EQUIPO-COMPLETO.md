# Prompt para invocar al Equipo completo (input de cada run)

**Uso:** Al decir **"Equipo completo"** o **"Invoque full team"**, usa este documento como **input del run**. Ejecuta la secuencia normal (pasos 0 → **0a MATPROMT** → 0b–8) y además el **ciclo de mejoras** (paso 9) con los prompts abajo. Al terminar, actualiza el backlog y la sección "Próximos prompts" para el siguiente run, hasta que todos los agentes estén completamente desarrollados.

---

## Instrucción para el Orquestador (cada run)

1. **Leer** `docs/team/PROJECT-STATE.md`, `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md`, este archivo y (cuando aplique) `docs/team/reports/REPORT-STUDY-IMPROVEMENTS-2026-03-18.md`.
2. **MATPROMT (paso 0a):** Invocar rol **MATPROMT** / skill `matprompt` para generar el **bundle de prompts orientadores** por cada miembro §2 (objetivo, lecturas, entregables, criterios, anti-patrones, handoff). Salida: `docs/team/MATPROMT-FULL-RUN-PROMPTS.md` o `docs/team/matprompt/MATPROMT-RUN-YYYY-MM-DD-runN.md`. **Durante el run:** si aparece tarea nueva o cambio de prioridad, MATPROMT emite **DELTA** solo para roles afectados.
3. **Ejecutar** pasos 0 → **0a** → 0b → 1 → 2 → … → 8 como siempre (full team run).
4. **Paso 9 — Ciclo de mejoras:** Ejecutar en este run los **Próximos prompts** listados abajo. Cada prompt se asigna al rol correspondiente; ese rol ejecuta la tarea y entrega el artefacto. El Orquestador verifica y actualiza `IMPROVEMENT-BACKLOG-BY-AGENT.md` (marcar ✓). Opcional: MATPROMT puede sintetizar **prompts mejorados** para el siguiente ciclo a partir de gaps detectados.
5. **Al final del run:** Actualizar la sección **"Próximos prompts"** de este mismo archivo con los siguientes prompts pendientes (según backlog), para que el próximo "Equipo completo" continúe. Si ya todos los agentes están desarrollados, escribir: "Todos los agentes están completamente desarrollados. Solo mantenimiento (actualizar knowledge cuando cambie el dominio)."

---

## Próximos prompts (ejecutar en este run)

**Run 2026-03-19 / run 31 (Invoque full team — post-autopilot + paso 9):** ✓ Ejecutado. **MATPROMT:** [matprompt/MATPROMT-RUN-2026-03-19-run31.md](./matprompt/MATPROMT-RUN-2026-03-19-run31.md). **Parallel/Serial:** [parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-19-run31.md](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-19-run31.md). **Reporter:** [reports/REPORT-SOLUTION-CODING-2026-03-19-run31.md](./reports/REPORT-SOLUTION-CODING-2026-03-19-run31.md). **Judge:** [judge/JUDGE-REPORT-RUN-2026-03-19-run31.md](./judge/JUDGE-REPORT-RUN-2026-03-19-run31.md). **Repo Sync:** [reports/REPO-SYNC-REPORT-2026-03-19-run31.md](./reports/REPO-SYNC-REPORT-2026-03-19-run31.md). **CI:** `npm run lint` 0 errores (11 warnings); `npm test` **119 passed**. **Guía canónica:** [MATPROMT-FULL-RUN-PROMPTS.md](./MATPROMT-FULL-RUN-PROMPTS.md) — «Bundle — RUN 2026-03-19 / run31».

**Autopilot Runs 24–30 (2026-03-20):** Plan **documental** para encadenar full team sin perder el hilo. **Leer primero:** [reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md](./reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md). **MATPROMT:** [matprompt/MATPROMT-RUN-AUTOPILOT-24-30.md](./matprompt/MATPROMT-RUN-AUTOPILOT-24-30.md). **Parallel/Serial:** [parallel-serial/PARALLEL-SERIAL-AUTOPILOT-24-30.md](./parallel-serial/PARALLEL-SERIAL-AUTOPILOT-24-30.md). **Judge (scores plan):** [judge/JUDGE-REPORT-AUTOPILOT-RUN24-30.md](./judge/JUDGE-REPORT-AUTOPILOT-RUN24-30.md). **Guía canónica:** [MATPROMT-FULL-RUN-PROMPTS.md](./MATPROMT-FULL-RUN-PROMPTS.md) — sección «Bundle — AUTOPILOT Runs 24–30». Marcar en el REPORT la tabla de estado cuando cada run se **ejecute** (no sustituye evidencia). Tras **Run 30**, definir aquí «Próximos prompts run31+» según PROJECT-STATE.

**Run 2026-03-20 run 23 (fusión — run22 + Presupuesto libre V3 + cierre Judge/MATPROMT):** ✓ Cierre documental unificado. **Judge:** [judge/JUDGE-REPORT-RUN-2026-03-20-run23.md](./judge/JUDGE-REPORT-RUN-2026-03-20-run23.md) (~4.7/5 orientativo). **MATPROMT:** [matprompt/MATPROMT-RUN-2026-03-20-run23.md](./matprompt/MATPROMT-RUN-2026-03-20-run23.md). **Parallel/Serial:** [parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run23.md](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run23.md). **Guía canónica:** sección «Bundle — RUN 2026-03-20 / run23» en [MATPROMT-FULL-RUN-PROMPTS.md](./MATPROMT-FULL-RUN-PROMPTS.md). **Código:** Presupuesto libre acordeones en `PanelinCalculadoraV3.jsx`; reporte [reports/REPORT-SOLUTION-CODING-2026-03-20-full-team-implement.md](./reports/REPORT-SOLUTION-CODING-2026-03-20-full-team-implement.md).

**Run 2026-03-20 run 23 (Next steps — plan + verificación repo):** ✓ Ejecutado. Plan [plans/NEXT-STEPS-RUN-23-2026-03-20.md](./plans/NEXT-STEPS-RUN-23-2026-03-20.md). **Hecho:** `npm run lint` (0 errores, 10 warnings); `npm test` **115 passed**; `npm audit fix` **sin --force** (4 packages actualizados); tests repasados OK. **Quedan 7 vulns** → `--force` pendiente aprobación. **E2E checklist** — tabla URLs producción añadida en `E2E-VALIDATION-CHECKLIST.md`. **Pendiente:** commit `package-lock.json`, E2E manual, tabs/triggers, Repo Sync push, billing, OAuth, SKUs MATRIZ.

**Run 2026-03-20 run 22 (Invoque full team — propagate & synchronize):** ✓ Ejecutado. Bundle `docs/team/matprompt/MATPROMT-RUN-PROPAGATE-SYNC-2026-03-20.md`. PLAN `parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run22.md`. REPORT `reports/REPORT-SOLUTION-CODING-2026-03-20-run22.md`, REPO-SYNC `reports/REPO-SYNC-REPORT-2026-03-20-run22.md`, Judge `judge/JUDGE-REPORT-RUN-2026-03-20-run22.md`. PROJECT-STATE y PROMPT actualizados. **Pendiente manual:** `git push` / copia a `bmc-dashboard-2.0` y `bmc-development-team` según REPO-SYNC run22.

**Run SYNC REVIEW (2026-03-19):** ~~Ejecutar full team con foco propagación~~ — alineación motor/UI vs `constants` **cerrada** 2026-03-20 (ver PROJECT-STATE). Seguir validando SKUs MATRIZ col.D y catálogo presupuesto libre si aplica.

**Run 2026-03-19 run 21 (Invoque full team + implementación):** Ejecutado con **MATPROMT bundle** en `MATPROMT-FULL-RUN-PROMPTS.md` (subsecciones §2). Implementación: fachada — **T2 por unidad**, **cinta butilo opcional** (default off), **silicona 300 ml neutra opcional**; `SIL300N` en `matrizPreciosMapping.js`; tests `npm test` 111 passed. Artefactos: `PARALLEL-SERIAL-PLAN-2026-03-19-run21.md`, `REPORT-SOLUTION-CODING-2026-03-19-run21.md`, `JUDGE-REPORT-RUN-2026-03-19-run21.md`. Pendientes: validar precios silicona 300 en MATRIZ; tabs/triggers, E2E, npm audit --force, billing, Repo Sync.

**Run 2026-03-19 run 20 (Invoque full team):** Full team run 0→9 ejecutado (síntesis). Contexto: sincronización explícita post–log análisis y protocolo N dinámico; sin cambios de código nuevos en esta corrida. PARALLEL-SERIAL-PLAN run20 (serie). REPORT-SOLUTION-CODING run20, JUDGE-REPORT run20 (~4.9/5). Refuerzo usuario: OAuth **origen JS** `https://calculadora-bmc.vercel.app` en Google Cloud si falla Drive desde Vercel. Pendientes: tabs/triggers, E2E, npm audit --force, billing, Repo Sync. PROMPT y PROJECT-STATE actualizados.

**Run 2026-03-19 run 19 (Invoque full team):** Full team run 0→9 ejecutado. Contexto: sync updates Calculadora — costos editables, fórmulas dimensionamiento download/upload, MATRIZ costo column. Deploy ya completado (Cloud Run + Vercel). Mapping actualizado (DASHBOARD-INTERFACE-MAP, planilla-inventory). Dependencies/service-map con ConfigPanel, DimensioningFormulasEditor. Contract 4/4 PASS (runtime). Reporter REPORT-SOLUTION-CODING run19. Judge, Repo Sync reportes generados. PROMPT y PROJECT-STATE actualizados.

**Run 2026-03-19 run 18 (Invoque full team):** Full team run 0→9 ejecutado. Contexto: deploy completado (Cloud Run panelin-calc con /calculadora). Dockerfile fixes (easymidi --ignore-scripts), .dockerignore, cloudbuild.yaml, deploy script. Contract 4/4 PASS (runtime). Reporter REPORT-SOLUTION-CODING run18. Judge, Repo Sync reportes generados. Dependencies/service-map actualizados con deploy flow, Cloud Run URL, Vercel. PROMPT y PROJECT-STATE actualizados.

**Input para próximos runs:** Incluir `docs/team/reports/REPORT-STUDY-IMPROVEMENTS-2026-03-18.md` (Study improvements) como referencia. Ver §20 Fases de implementación para secuencia recomendada.

**Run 2026-03-18 run 15:** Estado vigente; Study improvements aplicadas.

**Run 2026-03-16 run7:** Ejecutados todos los ítems automatizables de la agenda:
- ✓ [Contract/Audit] kpi-report verificado en código: bmcDashboard.js L1130, montado en /api. 404 = restart servidor.
- ✓ [Reporter] REPORT-SOLUTION-CODING-run7.md generado.
- ✓ [Reporter] GUIA-RAPIDA-VENDEDORES.md creada (actualizada por linter).
- ✓ [Audit] E2E checklist: .cursor/bmc-audit/latest-report-2026-03-16-run7.md.
- ✓ [Judge] JUDGE-REPORT-RUN-2026-03-16-run7.md; JUDGE-REPORT-HISTORICO actualizado; promedio 4.93/5.
- ✓ [Repo Sync] Repos verificados remotamente; artefactos sincronizados y pusheados.
- ✓ [Dependencies] service-map.md fecha corregida + PUSH routes documentadas.
- ✓ [Fiscal] Incumplimiento Medio detectado y corregido (service-map fecha).
- ✓ [Parallel/Serial] PARALLEL-SERIAL-PLAN-2026-03-16-run7.md creado.

---

## Próximos prompts para el siguiente run (actualizar al final)

**Run32+ (2026-03-19 — agenda tras run 31):**

1. ~~**[Repo / Security]**~~ — ✓ **2026-03-20:** `.gitignore` ignora `Calculadora-BMC/`, `OmniCRM-Sync/`.
2. ~~**[Repo Sync]**~~ — ✓ **2026-03-20:** rama fusionada — **PR #33** → `main` (`5f9855d`); seguir con deploy/repos hermanos si aplica.
3. **[Matias — manual] Pista 3** — tabs + triggers Sheets según AUTOMATIONS-BY-WORKBOOK / IMPLEMENTATION-PLAN-POST-GO-LIVE §A1–A2.
4. **[Audit]** Completar filas ⬜→✓ en [AUTOPILOT-FULL-TEAM-RUNS-24-30.md](./reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md) con evidencia real por run.
5. **[Contract]** Con API levantada: `npm run test:contracts`.
6. **[Calc / Mapping]** SKUs MATRIZ col.D + opcional acotar tornillería presupuesto libre (`PRESUPUESTO_LIBRE_IDS`).
7. **[Coding + Matias]** Rama `npm audit fix --force` si se aprueba (run28 autopilot).

**Run 2026-03-16 (go):** Contract, Calc, Security, Judge, Parallel/Serial, Repo Sync, Sheets Structure — ✓ completados.
**Todos los 19 agentes están completamente desarrollados.**

**Run 2026-03-16 (Go-live & Hardening — Run 6):** Todos los 7 ítems de la agenda activa ejecutados:
1. ✓ [Repo Sync] Skip documentado; recordatorio en PROJECT-STATE y REPO-SYNC-SETUP.md vigente.
2. ✓ [Audit/Debug] npm audit analizado: 7 vulns (5 low, 2 moderate). Plan: `npm audit fix` para low; `npm audit fix --force` (vite@8 breaking) con aprobación Matias.
3. ✓ [Sheets Structure / Mapping] Instrucciones tabs manuales documentadas en AUTOMATIONS-BY-WORKBOOK.md con checklists detallados. Pendiente ejecución por Matias.
4. ✓ [Networks / Audit] Instrucciones triggers documentadas en AUTOMATIONS-BY-WORKBOOK.md + IMPLEMENTATION-PLAN-POST-GO-LIVE.md §A2. Pendiente configuración por Matias.
5. ✓ [Contract] kpi-report 404 documentado (script encontró la ruta); requiere restart servidor. Recomendación documentada en IMPLEMENTATION-PLAN-POST-GO-LIVE.md §A3.
6. ✓ [Judge] JUDGE-REPORT-HISTORICO actualizado con scores formales de 19/19 agentes. Promedio run 6: 4.78/5.
7. ✓ [Reporter] IMPLEMENTATION-PLAN-POST-GO-LIVE.md generado con fases A–E (tabs, triggers, deploy, guía vendedores, E2E, Repo Sync).

---

## Próximos prompts para el siguiente run

**Run 2026-03-18 run6:** ✓ Full team run ejecutado; integración Admin Cotizaciones reflejada en Mapping, Dependencies, Reporter, Judge, Repo Sync. Sin nuevos ítems automatizables en este run.

**Run 2026-03-16 run7:** ✓ Todos los ítems automatizables ejecutados. Ver sección "Próximos prompts (ejecutar en este run)" para detalle.

**Input permanente:** `docs/team/reports/REPORT-STUDY-IMPROVEMENTS-2026-03-18.md` — Study improvements como referencia en cada full team run. Ver §20 Fases de implementación.

**Agenda siguiente run (post–run22 propagate & sync — pendientes activos):**

1. **[Matias — manual] Crear tabs y configurar triggers** — Bloqueante automations. Ver IMPLEMENTATION-PLAN-POST-GO-LIVE.md §A1–A2, AUTOMATIONS-BY-WORKBOOK.md.
2. ~~**[Coding] Verificar kpi-report runtime**~~ — ✓ Documentación; validar tras restart API.
3. ~~**[Networks] Deploy Calculadora**~~ — ✓ Cloud Run + Vercel.
4. ~~**[Reporter] GUIA-RAPIDA-VENDEDORES**~~ — ✓
5. **[Matias + Audit] E2E validation** — `docs/team/E2E-VALIDATION-CHECKLIST.md` con URL Cloud Run / Vercel.
6. **[Coding + Matias] npm audit fix --force** — Branch separado; aprobación Matias.
7. **[Matias] Billing cierre mensual** — Workbook Pagos Pendientes.
8. **[Repo Sync] Sincronizar repos** — Ejecutar push/copia según `reports/REPO-SYNC-REPORT-2026-03-20-run22.md` → bmc-dashboard-2.0, bmc-development-team.
9. **[Matias / Security] OAuth Vercel** — Origen JS `https://calculadora-bmc.vercel.app` si `redirect_uri_mismatch`.
10. **[Calc / Mapping] SKUs MATRIZ col.D** — Confirmar placeholders en `matrizPreciosMapping.js` (PROJECT-STATE).
11. **[Equipo §2 opcional]** — Leer `docs/team/interactions/TEAM-INTERACTION-QUANTUM-DOC-2026-03-20.md` §1–§5 en próximo full team (cross-learn ya documentado en run22).

---

**Agenda histórica (post-sync run19 — referencia):**

1. **[Matias — manual] Crear tabs y configurar triggers** — CONTACTOS, Ventas_Consolidado, SHOPIFY_SYNC_AT, PAGADO, y 6 triggers Apps Script. BLOQUEANTE para automations. Ver IMPLEMENTATION-PLAN-POST-GO-LIVE.md §A1, §A2 y AUTOMATIONS-BY-WORKBOOK.md.
2. ~~**[Coding] Verificar kpi-report runtime**~~ — ✓ Verificado run17/run18/run19: 4/4 PASS (runtime).
3. ~~**[Networks + Matias] Deploy Calculadora**~~ — ✓ Deploy completado run18. Cloud Run panelin-calc live. Ver service-map.md §5.
4. ~~**[Reporter] Crear GUIA-RAPIDA-VENDEDORES.md**~~ — ✓ Hecho. Ver docs/GUIA-RAPIDA-VENDEDORES.md.
5. **[Matias + Audit] E2E validation** — Ejecutar checklist docs/team/E2E-VALIDATION-CHECKLIST.md con URL Cloud Run (post-deploy).
6. **[Coding + Matias] npm audit fix** — `npm audit fix --force` (vite@8, breaking). Evaluar con Matias en branch separado.
7. **[Matias] Billing cierre mensual 2026-03** — Verificar cierre en Pagos Pendientes 2026 workbook.
8. **[Repo Sync] Sincronizar repos** — Tras run19: actualizar bmc-dashboard-2.0 y bmc-development-team. Ver docs/team/reports/REPO-SYNC-REPORT-2026-03-19-run19.md.

Al terminar el siguiente run, marcar ✓ en los completados y actualizar con los nuevos pendientes.

---

## Referencias

- Backlog: `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md`
- Criterio desarrollado: tabla en ese mismo doc
- Knowledge: `docs/team/knowledge/README.md`, plantilla `knowledge/Mapping.md`
- Análisis: `docs/team/FULL-TEAM-IMPROVEMENT-ANALYSIS.md`
