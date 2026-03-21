# MATPROMT — RUN 2026-03-22 / run52 (cierre R3 — bundle post-push + agenda operativa)

**Objetivo:** Full team **run 52** — cerrar **§0.1 pre-run** con artefactos **R3–R5** tras **run 51** y **`main`** ya publicado con deps run36. **Foco:** prompts orientadores por rol §2 para **Pista 3** (Sheets manual), **E2E** (checklist URLs), **Repo Sync** (mirrors); sin asumir trabajo humano hecho.

**Artefactos enlazados:**  
`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-22-run52.md` · `reports/REPORT-SOLUTION-CODING-2026-03-22-run52.md` · `judge/JUDGE-REPORT-RUN-2026-03-22-run52.md` · `reports/REPO-SYNC-REPORT-2026-03-22-run52.md` · `reports/RUN-ROADMAP-FORWARD-2026.md` §5.1

---

## Resumen ejecutivo (3–5 líneas)

1. **Run 52:** Documental **0→9** con evidencia CI: **`npm audit`:** **0**; **`npm run lint`:** 0 errores (12 warnings); **`npm test`:** **119 passed** (2026-03-22).
2. **Contexto:** Merge run36 + **push** `origin/main` ya aplicados; pendientes operativos = **Pista 3**, **E2E**, **Repo Sync**, billing/OAuth/SKUs según `PROMPT-FOR-EQUIPO-COMPLETO`.
3. **§2.2 (paso 0):** bmc-project-team-sync ✓; ai-interactive-team si hay conflicto de prioridad; chat-equipo N/A salvo instancia.

## Objetivos del usuario / agenda

- Emitir **bundle MATPROMT** (este archivo) = **R3** ✓
- **Parallel/Serial** plan run52 = **R4** ✓
- **Judge** report run52 = **R5** ✓

## Orden (Parallel/Serial)

- **Serie:** 0 → 0a (MATPROMT) → 0b → 1–8 → Judge → Repo Sync → 8 → 9 (próximo **run 53**).

---

## Prompts orientadores breves por rol §2

### Orchestrator
- **Hacer:** Registrar run52 en PROJECT-STATE; enlazar artefactos; PROMPT → siguiente **run 53**.

### MATPROMT
- **Hacer:** Este bundle; sección en `MATPROMT-FULL-RUN-PROMPTS.md`.

### Parallel/Serial
- **Hacer:** `PARALLEL-SERIAL-PLAN-2026-03-22-run52.md` — **serie** (checklist + docs).

### Mapping + google-sheets-mapping-agent
- **Hacer:** Mantener hub Sheets; Pista 3 = handoff Matias; sin drift de nombres en `planilla-inventory` cuando se cierren tabs.

### Sheets Structure
- **Hacer:** N/A ejecución remota; checklist en IMPLEMENTATION-PLAN / AUTOMATIONS.

### Dependencies / Contract
- **Hacer:** Estado vigente; `test:contracts` cuando API arriba.

### Networks / Audit / Security
- **Hacer:** E2E URLs Cloud Run/Vercel; Security: env/OAuth sin secretos en repo.

### Reporter
- **Entrega:** `REPORT-SOLUTION-CODING-2026-03-22-run52.md`.

### Judge
- **Entrega:** `JUDGE-REPORT-RUN-2026-03-22-run52.md`; histórico.

### Repo Sync
- **Entrega:** `REPO-SYNC-REPORT-2026-03-22-run52.md`.

### DELTA — (solo si aplica)
- **Disparador:** Cambio de prioridad negocio o incidente prod → MATPROMT DELTA + Orchestrator.
