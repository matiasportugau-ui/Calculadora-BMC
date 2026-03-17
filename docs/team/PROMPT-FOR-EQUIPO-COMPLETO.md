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

**Run 2026-03-16:** Design, Dependencies, Reporter, Orchestrator, Mapping — ✓ completados.

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

**Agenda siguiente run (post-go-live, execution):**

1. **[Matias — manual] Crear tabs y configurar triggers** — CONTACTOS, Ventas_Consolidado, SHOPIFY_SYNC_AT, PAGADO, y 6 triggers Apps Script. Ver IMPLEMENTATION-PLAN-POST-GO-LIVE.md §A1, §A2 y AUTOMATIONS-BY-WORKBOOK.md.
2. **[Coding] Verificar kpi-report runtime** — Reiniciar servidor y confirmar /api/kpi-report retorna 200 o 503. Ver §A3.
3. **[Networks + Matias] Decidir y ejecutar deploy productivo** — Cloud Run (§B1) o VPS Netuy (§B2). Ver IMPLEMENTATION-PLAN-POST-GO-LIVE.md.
4. **[Reporter] Crear GUIA-RAPIDA-VENDEDORES.md** — Post-deploy; orientada a usuarios finales. Ver §C1.
5. **[Audit/Debug] E2E validation checklist** — Ver §D1. Verificar datos reales end-to-end.
6. **[Coding + Matias] npm audit fix** — `npm audit fix` sin --force primero; evaluar vite@8 upgrade.
7. **[Matias] Configurar Repo Sync** — Añadir vars en .env; crear repos externos. Ver REPO-SYNC-SETUP.md.

Al terminar el siguiente run, marcar ✓ en los completados y actualizar con los nuevos pendientes.

---

## Referencias

- Backlog: `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md`
- Criterio desarrollado: tabla en ese mismo doc
- Knowledge: `docs/team/knowledge/README.md`, plantilla `knowledge/Mapping.md`
- Análisis: `docs/team/FULL-TEAM-IMPROVEMENT-ANALYSIS.md`
