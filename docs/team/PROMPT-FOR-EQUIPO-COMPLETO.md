# Prompt para invocar al Equipo completo (input de cada run)

**Uso:** Al decir **"Equipo completo"** o **"Invoque full team"**, usa este documento como **input del run**. Ejecuta la secuencia normal (pasos 0–8) y además el **ciclo de mejoras** (paso 9) con los prompts abajo. Al terminar, actualiza el backlog y la sección "Próximos prompts" para el siguiente run, hasta que todos los agentes estén completamente desarrollados.

---

## Instrucción para el Orquestador (cada run)

1. **Leer** `docs/team/PROJECT-STATE.md`, `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md` y este archivo.
2. **Ejecutar** pasos 0 → 0b → 1 → 2 → … → 8 como siempre (full team run).
3. **Paso 9 — Ciclo de mejoras:** Ejecutar en este run los **Próximos prompts** listados abajo. Cada prompt se asigna al rol correspondiente; ese rol ejecuta la tarea y entrega el artefacto. El Orquestador verifica y actualiza `IMPROVEMENT-BACKLOG-BY-AGENT.md` (marcar ✓).
4. **Al final del run:** Actualizar la sección **"Próximos prompts"** de este mismo archivo con los siguientes prompts pendientes (según backlog), para que el próximo "Equipo completo" continúe. Si ya todos los agentes están desarrollados, escribir: "Todos los agentes están completamente desarrollados. Solo mantenimiento (actualizar knowledge cuando cambie el dominio)."

---

## Próximos prompts (ejecutar en este run)

**Run 2026-03-18 run 5:** Estado vigente; sin prompts automatizables. Pendientes: 1 (tabs/triggers), 3 (deploy), 6 (npm --force), 7 (Repo Sync opcional). PROJECT-STATE y PROMPT actualizados.

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

**Run 2026-03-16 run7:** ✓ Todos los ítems automatizables ejecutados. Ver sección "Próximos prompts (ejecutar en este run)" para detalle.

**Agenda siguiente run (post-go-live, execution — pendientes activos):**

1. **[Matias — manual] Crear tabs y configurar triggers** — CONTACTOS, Ventas_Consolidado, SHOPIFY_SYNC_AT, PAGADO, y 6 triggers Apps Script. BLOQUEANTE para automations. Ver IMPLEMENTATION-PLAN-POST-GO-LIVE.md §A1, §A2 y AUTOMATIONS-BY-WORKBOOK.md.
2. ~~**[Coding] Verificar kpi-report runtime**~~ — ✓ Verificado en código run7: bmcDashboard.js L1130, mount /api. Acción Matias: restart servidor → curl http://localhost:3001/api/kpi-report → debe ser 200 o 503.
3. **[Networks + Matias] Decidir y ejecutar deploy productivo** — Cloud Run (§B1) o VPS Netuy (§B2). Ver IMPLEMENTATION-PLAN-POST-GO-LIVE.md. Antes de deploy: CORS restriction en server/index.js.
4. ~~**[Reporter] Crear GUIA-RAPIDA-VENDEDORES.md**~~ — ✓ Hecho. Ver docs/GUIA-RAPIDA-VENDEDORES.md.
5. **[Matias + Audit] E2E validation** — Ejecutar checklist .cursor/bmc-audit/latest-report-2026-03-16-run7.md con datos reales post-deploy.
6. **[Coding + Matias] npm audit fix** — `npm audit fix --force` (vite@8, breaking). Evaluar con Matias en branch separado.
7. **[Matias] Billing cierre mensual 2026-03** — Verificar cierre en Pagos Pendientes 2026 workbook.

Al terminar el siguiente run, marcar ✓ en los completados y actualizar con los nuevos pendientes.

---

## Referencias

- Backlog: `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md`
- Criterio desarrollado: tabla en ese mismo doc
- Knowledge: `docs/team/knowledge/README.md`, plantilla `knowledge/Mapping.md`
- Análisis: `docs/team/FULL-TEAM-IMPROVEMENT-ANALYSIS.md`
