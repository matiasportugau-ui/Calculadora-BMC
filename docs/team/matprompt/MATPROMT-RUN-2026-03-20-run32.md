# MATPROMT — RUN 2026-03-20 / run32 (Full team sync — cierre honesto + contratos)

**Objetivo:** Ejecutar **Invoque full team** completo (0→0a→0b→1→…→8→9): sincronización de estado, **§2.2** transversales revisadas, bundle por rol, plan Parallel/Serial, REPORT + JUDGE + REPO-SYNC; actualizar PROJECT-STATE y "Próximos prompts" para run33.

**Artefactos enlazados:**  
`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run32.md` · `reports/REPORT-SOLUTION-CODING-2026-03-20-run32.md` · `judge/JUDGE-REPORT-RUN-2026-03-20-run32.md` · `reports/REPO-SYNC-REPORT-2026-03-20-run32.md` · `reports/RUN-ROADMAP-FORWARD-2026.md`

---

## Resumen ejecutivo (3–5 líneas)

1. **Run 32 (roadmap):** Cierre honesto AUTOPILOT 24–25 + contratos API; ejecutar `npm run test:contracts` con API arriba si aplica; marcar ✓ real en tabla AUTOPILOT donde haya evidencia.
2. **Full team sync:** Todos los roles §2 invocados; estado vigente confirmado por área; sin cambios de código en esta corrida (solo documental/artefactos).
3. **§2.2 transversales (paso 0):** ai-interactive-team (aplicable — handoffs/diálogo); bmc-project-team-sync (aplicable — orden y PROJECT-STATE); chat-equipo (N/A — no existe en repo).
4. **Pendientes:** Pista 3 tabs/triggers (Matias); E2E; npm audit --force (aprobación); Repo Sync push; billing cierre.

## Objetivos del usuario / agenda

- **Full team sync:** Pasos 0 → 0a → 0b → 1 → … → 8 → 9.
- **Entrada obligatoria:** PROJECT-STATE, PROMPT-FOR-EQUIPO-COMPLETO, IMPROVEMENT-BACKLOG, §2 y §2.2.
- **Salida:** Resumen ejecutivo del run; enlaces a MATPROMT, Parallel/Serial, REPORT, JUDGE, REPO-SYNC; PROJECT-STATE actualizado.

## Roles N/A profundo este run

- **Sheets Structure:** sin edición de tabs (Pista 3 manual Matias).
- **GPT/Cloud:** sin cambio OpenAPI/GPT Builder este run (Run 38 en roadmap).

## Orden (Parallel/Serial)

- **Serie:** 0 → 0a (MATPROMT) → 0b (Parallel/Serial) → 1–8 (estado vigente por rol) → Judge → Repo Sync → 8 (PROJECT-STATE) → 9 (Próximos prompts + BACKLOG).
- **Paralelo:** no aplica este run (sync documental).

---

## Prompts orientadores breves por rol §2

### Orchestrator
- **Hacer:** Ejecutar 0→0a→0b→…→9; registrar run32 en PROJECT-STATE; enlazar artefactos; actualizar "Próximos prompts".
- **No hacer:** No afirmar contratos PASS sin API levantada o documento explícito.

### MATPROMT
- **Hacer:** Este bundle; fila en MATPROMT-FULL-RUN-PROMPTS.md; DELTA solo si prioridad cambia mid-run.

### Parallel/Serial
- **Hacer:** PARALLEL-SERIAL-PLAN-2026-03-20-run32.md — serie documental run32.

### Mapping / Dependencies / Contract / Networks / Design / Integrations / Security / Fiscal / Billing / Audit / Calc
- **Hacer:** Confirmar estado vigente; anotar en REPORT si hay novedad; Contract: documentar resultado test:contracts (PASS/FAIL/SKIP según API).

### Reporter
- **Entrega:** REPORT-SOLUTION-CODING-2026-03-20-run32.md.

### Judge
- **Entrega:** JUDGE-REPORT-RUN-2026-03-20-run32.md; actualizar JUDGE-REPORT-HISTORICO.

### Repo Sync
- **Entrega:** REPO-SYNC-REPORT-2026-03-20-run32.md; qué sincronizar a bmc-dashboard-2.0 y bmc-development-team.

### DELTA — (solo si aplica)
- **Disparador:** Cambio de prioridad o bloqueo (prod caído, Sheets roto).
- **Roles:** MATPROMT (DELTA), Orchestrator (reordenar roadmap).
