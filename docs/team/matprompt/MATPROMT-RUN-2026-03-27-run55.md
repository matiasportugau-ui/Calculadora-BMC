# MATPROMT — Bundle RUN 2026-03-27 / run55

**Generado por:** MATPROMT (`matprompt`)
**Run:** 55 — **Invoque full team** (pasos 0→9) — **objetivo operativo:** WhatsApp Cloud API + bridge correo (`email:ingest-snapshot`) + **Sheets cuota** (caché/batch/retry ya en código) + **prod smoke** (ver `PROJECT-STATE` 2026-03-27)
**Fecha:** 2026-03-27
**Equipo:** **21 roles** §2 (`PROJECT-TEAM-FULL-COVERAGE.md` §2.1); propagación §4 cuando toque Sheets/API/CRM.

---

## Resumen ejecutivo

Run 55 formaliza el **ciclo completo** del plan **Invoque full team** sin objetivo SIM primario: **paso 5h SIM-REV** queda en modo **delta documental** (sin nueva `panelsim:session` obligatoria en este bloque; evidencia SIM vigente en run 54). El foco es **Integraciones + Networks + Contract + Mapping** para: E2E WA→CRM (**cm-0**), ML/GCS (**cm-1**), ingest correo (**cm-2**), **redeploy** Cloud Run tras cambios Sheets, **`GET /api/cotizaciones` 503** en prod (config/tabs), **duplicados `path` MATRIZ** en CSV prod. **Transversales §2.2:** Project Team Sync ✓; BMC Mercado Libre API — verificar prod vs local; AI Interactive Team N/A.

- **2b Sheets Structure:** **N/A** (sin cambio estructural ejecutado en este run documental).
- **Prompts detallados por rol (plantilla larga):** mantener alineación con [`MATPROMT-RUN-2026-03-24-run54.md`](./MATPROMT-RUN-2026-03-24-run54.md) donde el foco no contradiga run 55; **delta** abajo.

---

## Delta vs run 54 (prioridad run 55)

| Área | Instrucción |
|------|-------------|
| **Orchestrator** | Cerrar artefactos run 55; **PROMPT** paso 9 → próximo ciclo **run 55 humano / run 56** según evidencia `RUN55-OPERATOR-CHECKLIST.md`. |
| **Mapping** | Inventario + `planilla-inventory`: nota **MONTO**; CRM cotizaciones / tabs — alinear con 503 prod. |
| **Contract** | Tras fix cotizaciones o rutas: `npm run test:contracts` con API en marcha. |
| **Networks** | Redeploy Cloud Run si aún no está la build con caché ventas / `batchGet` / retry 429; revisar **min-instances** si cold start afecta WA/webhook. |
| **Integrations** | WA token permanente; `POST /api/crm/parse-email`; `npm run email:ingest-snapshot` con dedupe — solo con operador **cm-2**. |
| **GPT/Cloud** | OpenAPI correo mínimo vigente; no forzar cambios Builder sin acceso. |
| **Calc** | MATRIZ CSV: duplicados `path` — limpieza planilla o regla import; editor **venta_web_iva_inc** ya en repo. |
| **Security** | Rotación keys si hubo exposición; sin secretos en docs. |
| **SIM / SIM-REV** | **No** sesión SIM obligatoria; ver `SIM-REV-REVIEW-2026-03-27-run55.md` (delta). |

---

## Orchestrator — Prompt orientador

- **Objetivo:** Coordinar run 55; asegurar **0→0a→0b→…→8→9** y checklist operador.
- **Leer:** `PROJECT-STATE.md`, `PROMPT-FOR-EQUIPO-COMPLETO.md`, `RUN55-OPERATOR-CHECKLIST.md`, `HUMAN-GATES-ONE-BY-ONE.md` (cm-0/1/2).
- **Entregables:** bundle 0a; Parallel/Serial; REPORT; Judge; Repo Sync; STATE; PROMPT; BACKLOG nota.

---

## Mapping — Prompt orientador

- **Objetivo:** Sin drift inventado; documentar 503 `/api/cotizaciones` y vínculo CRM/tabs.
- **Leer:** `DASHBOARD-INTERFACE-MAP.md`, `planilla-inventory.md`.

---

## Dependencies — Prompt orientador

- **Objetivo:** Reflejar menos lecturas Sheets en rutas ventas/kpi tras caché + batch.
- **Leer:** `dependencies.md` / `service-map.md` (rutas bajo `docs/` según convención vigente).

---

## Contract — Prompt orientador

- **Objetivo:** Validar contrato cuando se toque `bmcDashboard.js` o expectativas de CRM.
- **Hacer:** `npm run test:contracts` con `npm run start:api` y token si aplica.

---

## Networks — Prompt orientador

- **Objetivo:** Cloud Run alineado con código de cuota; smoke prod cuando haya deploy.
- **Hacer:** `npm run smoke:prod` post-deploy; documentar URL canónica.

---

## Design — Prompt orientador

- **Objetivo:** Si hay polling agresivo a `/api/ventas` o kpi, preferir `?tab=` o menor frecuencia.

---

## Integrations — Prompt orientador

- **Objetivo:** WA + ML + correo según gates humanos; no marcar éxito sin evidencia.

---

## Reporter — Prompt orientador

- **Objetivo:** `REPORT-SOLUTION-CODING-2026-03-27-run55.md` con tabla por rol y pendientes honestos.

---

## Security — Prompt orientador

- **Objetivo:** Tokens solo en `.env`; CORS prod acotado cuando se toque.

---

## GPT/Cloud — Prompt orientador

- **Objetivo:** `docs/openapi-email-gpt.yaml` + Builder guía; drift Panelin cuando haya ventana.

---

## Fiscal / Billing / Audit/Debug — Prompt orientador

- **Objetivo:** Estado N/A salvo cierre mensual o anomalías nuevas — citar PROJECT-STATE si hay delta.

---

## Calc — Prompt orientador

- **Objetivo:** Tests + smoke MATRIZ; duplicados `path` como riesgo de import.

---

## Parallel/Serial / Repo Sync / Judge / MATPROMT

- **Parallel/Serial:** plan archivo `PARALLEL-SERIAL-PLAN-2026-03-27-run55.md`.
- **Repo Sync:** evaluar hermanos; push Matias.
- **Judge:** `JUDGE-REPORT-RUN-2026-03-27-run55.md` + histórico.
- **MATPROMT:** mantener DELTA ante cambio de prioridad mid-run.

---

## SIM — Prompt orientador (N/A obligatorio run 55)

- **Objetivo:** Solo si Matias re-prioriza SIM: `AGENT-SIMULATOR-SIM.md` §5.1 + informe `PANELSIM-SESSION-STATUS-*.md`.
- **Run 55 default:** No ejecutar sesión solo por este documento.

---

## SIM-REV — Prompt orientador (5h — forma corta)

- **Objetivo:** `panelsim/reports/SIM-REV-REVIEW-2026-03-27-run55.md` — delta vs run 54, sin nueva sesión.

---

## Sheets Structure — Prompt orientador

- **N/A** este run (solo Matias; sin cambio estructural en bloque 2b).
