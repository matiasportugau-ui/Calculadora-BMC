# Prompt para invocar al Equipo completo (input de cada run)

**Uso:** Al decir **"Equipo completo"** o **"Invoque full team"**, usa este documento como **input del run**. Ejecuta la secuencia normal (pasos 0–8) y además el **ciclo de mejoras** (paso 9) con los prompts abajo. Al terminar, actualiza el backlog y la sección "Próximos prompts" para el siguiente run, hasta que todos los agentes estén completamente desarrollados.

---

## Instrucción para el Orquestador (cada run)

1. **Leer** `docs/team/PROJECT-STATE.md`, `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md`, este archivo y (cuando aplique) `docs/team/reports/REPORT-STUDY-IMPROVEMENTS-2026-03-18.md`.
2. **Ejecutar** pasos 0 → 0b → 1 → 2 → … → 8 como siempre (full team run).
3. **Paso 9 — Ciclo de mejoras:** Ejecutar en este run los **Próximos prompts** listados abajo. Cada prompt se asigna al rol correspondiente; ese rol ejecuta la tarea y entrega el artefacto. El Orquestador verifica y actualiza `IMPROVEMENT-BACKLOG-BY-AGENT.md` (marcar ✓).
4. **Al final del run:** Actualizar la sección **"Próximos prompts"** de este mismo archivo con los siguientes prompts pendientes (según backlog), para que el próximo "Equipo completo" continúe. Si ya todos los agentes están desarrollados, escribir: "Todos los agentes están completamente desarrollados. Solo mantenimiento (actualizar knowledge cuando cambie el dominio)."

---

## Próximos prompts (ejecutar en este run)

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

**Agenda siguiente run (post-deploy — pendientes activos):**

1. **[Matias — manual] Crear tabs y configurar triggers** — CONTACTOS, Ventas_Consolidado, SHOPIFY_SYNC_AT, PAGADO, y 6 triggers Apps Script. BLOQUEANTE para automations. Ver IMPLEMENTATION-PLAN-POST-GO-LIVE.md §A1, §A2 y AUTOMATIONS-BY-WORKBOOK.md.
2. ~~**[Coding] Verificar kpi-report runtime**~~ — ✓ Verificado run17/run18: 4/4 PASS (runtime).
3. ~~**[Networks + Matias] Deploy Calculadora**~~ — ✓ Deploy completado run18. Cloud Run panelin-calc live. Ver service-map.md §5.
4. ~~**[Reporter] Crear GUIA-RAPIDA-VENDEDORES.md**~~ — ✓ Hecho. Ver docs/GUIA-RAPIDA-VENDEDORES.md.
5. **[Matias + Audit] E2E validation** — Ejecutar checklist docs/team/E2E-VALIDATION-CHECKLIST.md con URL Cloud Run (post-deploy).
6. **[Coding + Matias] npm audit fix** — `npm audit fix --force` (vite@8, breaking). Evaluar con Matias en branch separado.
7. **[Matias] Billing cierre mensual 2026-03** — Verificar cierre en Pagos Pendientes 2026 workbook.
8. **[Repo Sync] Sincronizar repos** — Tras run18: actualizar bmc-dashboard-2.0 y bmc-development-team. Ver docs/team/reports/REPO-SYNC-REPORT-2026-03-19-run18.md.

Al terminar el siguiente run, marcar ✓ en los completados y actualizar con los nuevos pendientes.

---

## Referencias

- Backlog: `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md`
- Criterio desarrollado: tabla en ese mismo doc
- Knowledge: `docs/team/knowledge/README.md`, plantilla `knowledge/Mapping.md`
- Análisis: `docs/team/FULL-TEAM-IMPROVEMENT-ANALYSIS.md`
