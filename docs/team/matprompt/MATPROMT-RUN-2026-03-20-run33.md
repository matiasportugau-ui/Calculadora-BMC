# MATPROMT — RUN 2026-03-20 / run33 (Pista 3 — tabs/triggers + verificación Mapping)

**Objetivo:** Full team run **run33** con foco en **Pista 3 (Sheets)**: coordinación tabs/triggers (handoff Matias), checklist documentado, y **verificación Mapping/Dependencies** para que planilla-inventory y nombres no deriven cuando se cierren tabs.

**Artefactos enlazados:**  
`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run33.md` · `reports/REPORT-SOLUTION-CODING-2026-03-20-run33.md` · `judge/JUDGE-REPORT-RUN-2026-03-20-run33.md` · `reports/REPO-SYNC-REPORT-2026-03-20-run33.md` · `reports/RUN-ROADMAP-FORWARD-2026.md`

---

## Resumen ejecutivo (3–5 líneas)

1. **Run 33 (roadmap):** Pista 3 — checklist tabs/triggers Sheets; handoff explícito a Matias; preparar verificación Mapping/Dependencies cuando tabs estén creados.
2. **Full team:** Todos los roles §2 invocados; estado vigente; Mapping y Dependencies confirman alineación planilla-inventory ↔ DASHBOARD-INTERFACE-MAP y que no hay drift de nombres de tabs esperados.
3. **§2.2 transversales (paso 0):** ai-interactive-team (aplicable); bmc-project-team-sync (aplicable); chat-equipo (N/A).
4. **Pendientes post-run33:** Run 34 smoke post-Sheets; Pista 3 ejecución manual (Matias).

## Objetivos del usuario / agenda

- **Full team run 0→9** para run33.
- **Pista 3 coordinación:** Documentar checklist tabs/triggers; handoff Matias; Mapping verifica nombres de tabs en planilla-inventory vs documentación (AUTOMATIONS-BY-WORKBOOK, IMPLEMENTATION-PLAN-POST-GO-LIVE).
- **Salida:** REPORT, JUDGE, REPO-SYNC; PROJECT-STATE y "Próximos prompts" actualizados para run34.

## Roles N/A profundo este run

- **Sheets Structure:** ejecución humana (Matias); el run documenta y verifica, no edita Sheets.
- **GPT/Cloud:** sin cambio OpenAPI/GPT (Run 38).

## Orden (Parallel/Serial)

- **Serie:** 0 → 0a (MATPROMT) → 0b → 1–8 → Judge → Repo Sync → 8 (PROJECT-STATE) → 9 (Próximos prompts run34).
- **Paralelo:** no aplica (coordinación documental + verificación Mapping).

---

## Prompts orientadores breves por rol §2

### Orchestrator
- **Hacer:** Ejecutar 0→0a→0b→…→9; registrar run33 en PROJECT-STATE; enlazar artefactos; actualizar "Próximos prompts" para run34 (smoke post-Sheets).
- **No hacer:** No asumir que Pista 3 está ejecutada; documentar "pendiente Matias" si aplica.

### MATPROMT
- **Hacer:** Este bundle; añadir sección run33 en MATPROMT-FULL-RUN-PROMPTS.md; DELTA solo si prioridad cambia.

### Parallel/Serial
- **Hacer:** PARALLEL-SERIAL-PLAN-2026-03-20-run33.md — serie; foco Pista 3 coordinación.

### Mapping
- **Hacer:** Confirmar que planilla-inventory y docs (AUTOMATIONS-BY-WORKBOOK, tabs esperados) están alineados; anotar en REPORT si hay drift de nombres de tabs o columnas; handoff a Dependencies y Reporter.
- **Leer:** planilla-inventory.md, DASHBOARD-INTERFACE-MAP, AUTOMATIONS-BY-WORKBOOK (si existe), IMPLEMENTATION-PLAN-POST-GO-LIVE §A1–A2.

### Dependencies
- **Hacer:** Estado vigente; service-map fecha run33; anotar dependencia "Sheets tabs/triggers → APIs bmcDashboard" en REPORT si aplica.

### Contract / Networks / Design / Integrations / Security / Fiscal / Billing / Audit / Calc
- **Hacer:** Confirmar estado vigente; anotar en REPORT solo si hay novedad.

### Reporter
- **Entrega:** REPORT-SOLUTION-CODING-2026-03-20-run33.md (resumen run33, Pista 3 checklist/handoff, Mapping verification, pendientes run34).

### Judge
- **Entrega:** JUDGE-REPORT-RUN-2026-03-20-run33.md; actualizar JUDGE-REPORT-HISTORICO.

### Repo Sync
- **Entrega:** REPO-SYNC-REPORT-2026-03-20-run33.md; qué sincronizar a bmc-dashboard-2.0 y bmc-development-team tras run33.

### DELTA — (solo si aplica)
- **Disparador:** Bloqueo prod, Sheets roto, o prioridad negocio que obligue a reordenar.
- **Roles:** MATPROMT (DELTA), Orchestrator (actualizar roadmap).
