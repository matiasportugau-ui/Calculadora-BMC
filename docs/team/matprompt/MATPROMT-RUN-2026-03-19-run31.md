# MATPROMT — RUN 2026-03-19 / run31 (post-autopilot + ciclo mejora)

**Objetivo:** Cerrar un **Invoque full team** completo (0→9) inmediatamente después del paquete **AUTOPILOT 24–30**: síntesis de estado, verificación **CI local**, artefactos **Reporter / Judge / Repo Sync**, y **PROMPT run32+** explícito.

**Artefactos enlazados:**  
`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-19-run31.md` · `reports/REPORT-SOLUTION-CODING-2026-03-19-run31.md` · `judge/JUDGE-REPORT-RUN-2026-03-19-run31.md` · `reports/REPO-SYNC-REPORT-2026-03-19-run31.md` · `reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md`

---

## Resumen ejecutivo (3–5 líneas)

1. **Estado:** Pistas 1–2 del plan SOLUCIONES ya reflejadas en PROJECT-STATE; Pista 3 (Sheets) sigue **manual / Matias**.  
2. **CI:** `npm run lint` — 0 errores, 11 warnings (backup + `calculatorConfig.js`); `npm test` — **119 passed**.  
3. **Riesgo repo:** `git status` muestra directorios no rastreados `Calculadora-BMC/`, `OmniCRM-Sync/` — **no** mezclar con commit canónico sin revisión.  
4. **Siguiente foco:** commit atómico de docs/equipo + código presupuesto libre; luego AUTOPILOT run26–30 según tabla ⬜/✓.

## Objetivos del usuario / agenda

- Ejecutar **full team** con entregables trazables (este archivo + PLAN + REPORT + JUDGE + REPO-SYNC).  
- Dejar **MATPROMT-FULL-RUN-PROMPTS** y **PROMPT-FOR-EQUIPO-COMPLETO** alineados para **run32+**.

## Roles N/A profundo este run

- **Sheets Structure:** sin edición tabs en planilla (solo recordatorio Pista 3).  
- **GPT/Cloud:** sin cambio OpenAPI/GPT Builder en este run documental.

## Orden (Parallel/Serial)

- **Serie:** Orchestrator (0) → MATPROMT (0a, este bundle) → Parallel/Serial (0b) → pasos 1–5g **síntesis** desde STATE vigente → Judge (6) → Repo Sync (7) → STATE+PROMPT (8–9).  
- **Paralelo:** lectura `HANDOFF-NEXT-AGENT-PRESUPUESTO-LIBRE-2026-03-20.md` + validación `npm test` en otra terminal (mismo host).

---

## Prompts orientadores breves por rol §2

### Orchestrator
- **Hacer:** Registrar run31 en PROJECT-STATE; enlazar artefactos.  
- **No hacer:** No afirmar “push hecho” sin `git log`/`status` verificable.

### MATPROMT
- **Hacer:** Fila histórico en `MATPROMT-FULL-RUN-PROMPTS.md`; DELTA solo si usuario cambia prioridad mid-run.

### Parallel/Serial
- **Hacer:** `PARALLEL-SERIAL-PLAN-2026-03-19-run31.md` — serie documental + CI.

### Mapping / Dependencies / Contract / Networks / Design / Integrations / Security / GPT / Fiscal / Billing / Audit / Calc / Sheets Structure
- **Hacer:** Confirmar **sin drift** salvo lo ya en PROJECT-STATE; anotar en REPORT si aparece nueva tarea.

### Reporter
- **Entrega:** `REPORT-SOLUTION-CODING-2026-03-19-run31.md`.

### Judge
- **Entrega:** `JUDGE-REPORT-RUN-2026-03-19-run31.md`; actualizar HISTORICO.

### Repo Sync
- **Entrega:** `REPO-SYNC-REPORT-2026-03-19-run31.md`; flag nested dirs y rama `sheets-verify-config-b29b9`.

### DELTA — (solo si aplica)
- **Disparador:** Usuario pide borrar `Calculadora-BMC/` u `OmniCRM-Sync/` del working tree o añadirlos a `.gitignore`.  
- **Roles:** Security, Repo Sync, Orchestrator.
