# MATPROMT — RUN 2026-03-21 / run51 (Sheets hub unificado + cierre 37–50 → siguiente ciclo)

**Objetivo:** Full team **run 51** tras handoff itinerante **runs 40–50** (cerrado documental 2026-03-20). **Foco:** unificar lectura del **hub Sheets** (`MAPPER-PRECISO-PLANILLAS-CODIGO`, `SYNC-FULL-TEAM-SHEETS-ACCESS-MAP`, `VARIABLES-Y-MAPEO-UNO-A-UNO`) con `docs/google-sheets-module/README.md`; confirmar **run36** (`run36-audit-force`): `npm audit` → **0 vulnerabilities** en rama dedicada; **`main`** sigue con **7** hasta merge aprobado. CI en `main`: lint 0 errores; tests **119 passed**.

**Artefactos enlazados:**  
`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-21-run51.md` · `reports/REPORT-SOLUTION-CODING-2026-03-21-run51.md` · `judge/JUDGE-REPORT-RUN-2026-03-21-run51.md` · `reports/REPO-SYNC-REPORT-2026-03-21-run51.md` · `reports/RUN-ROADMAP-FORWARD-2026.md` · `reports/REPORT-RUNS-40-50-ITINERANTE-2026-03-20.md`

---

## Resumen ejecutivo (3–5 líneas)

1. **Run 51:** Primer **Invoque full team** numerado tras extensión **40–50**; narrativa **32–39** y **37–50** ya documentada; **siguiente número sugerido: run 52** (mantener §0.1 pre-run roadmap).
2. **Sheets:** Un solo hub: README + tres pilares (mapper código / sync por producto / variables 1:1); skills y `docs/AGENTS.md` apuntan al mismo lugar.
3. **§2.2 (paso 0):** ai-interactive-team (aplicable si hay conflicto de prioridad); bmc-project-team-sync (aplicable); chat-equipo (N/A salvo que exista instancia).
4. **Seguridad / deps:** Cierre **npm audit** en código = merge **`run36-audit-force`** → `main`; hasta entonces documentar **main vs rama**.

## Objetivos del usuario / agenda

- Full team **0→9** como **run 51**.
- Alinear documentación Sheets sin mapeos paralelos no deprecados.
- Registrar evidencia CI actual y estado **audit** rama vs **main**.

## Roles N/A profundo este run

- **Sheets Structure:** ejecución humana (Matias); run documenta hub y pendientes Pista 3.
- **Cambios de código app:** no requeridos para objetivo documental de run 51.

## Orden (Parallel/Serial)

- **Serie:** 0 → 0a (MATPROMT) → 0b → 1–8 → Judge → Repo Sync → 8 (PROJECT-STATE) → 9 (Próximos prompts **run 52**).

---

## Prompts orientadores breves por rol §2

### Orchestrator
- **Hacer:** Ejecutar 0→0a→0b→…→9; registrar run51 en PROJECT-STATE; enlazar artefactos; actualizar PROMPT para **run 52**.
- **No hacer:** No afirmar 0 vulns en **main** sin merge de run36.

### MATPROMT
- **Hacer:** Este bundle; sección run51 en `MATPROMT-FULL-RUN-PROMPTS.md`; DELTA si roadmap cambia.

### Parallel/Serial
- **Hacer:** `PARALLEL-SERIAL-PLAN-2026-03-21-run51.md` — serie documental.

### Mapping + google-sheets-mapping-agent
- **Hacer:** Verificar que `README`, `reference/README`, `planilla-inventory` y los tres pilares no contradicen nombres de tabs/columnas críticos; anotar drift en REPORT si aparece.
- **Leer:** `docs/google-sheets-module/README.md`, `MAPPER-PRECISO-PLANILLAS-CODIGO.md`, `SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md`, `VARIABLES-Y-MAPEO-UNO-A-UNO.md`.

### Dependencies / Contract / Networks / Design / Integrations / Security / Fiscal / Billing / Audit / Calc
- **Hacer:** Estado vigente; Security confirma **main** 7 vulns vs **run36-audit-force** 0; Contract sin cambio de rutas en este run.

### Reporter
- **Entrega:** `REPORT-SOLUTION-CODING-2026-03-21-run51.md` (hub Sheets, itinerante 37–50, audit branch, CI).

### Judge
- **Entrega:** `JUDGE-REPORT-RUN-2026-03-21-run51.md`; actualizar `JUDGE-REPORT-HISTORICO`.

### Repo Sync
- **Entrega:** `REPO-SYNC-REPORT-2026-03-21-run51.md`; lista artefactos a copiar a repos hermanos si aplica.

### DELTA — (solo si aplica)
- **Disparador:** Merge run36 a main o cambio fuerte de prioridad negocio.
- **Roles:** Security, Orchestrator, MATPROMT.
