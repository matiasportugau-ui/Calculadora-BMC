# MATPROMT — Prompts orientadores para Full Team Run

**Propósito:** Artefacto canónico donde el rol **MATPROMT** (`matprompt`) deja el **bundle de prompts** por miembro de `PROJECT-TEAM-FULL-COVERAGE.md` §2 para cada corrida del equipo completo.

**Alternativa:** runs muy largos pueden usar archivo dedicado en `docs/team/matprompt/MATPROMT-RUN-YYYY-MM-DD-runN.md` (crear carpeta `matprompt/` si hace falta).

---

## Cómo usar

1. **Orquestador — paso 0a:** Tras leer estado y PROMPT, invocar MATPROMT para rellenar la sección **«Bundle — RUN …»** de abajo (o crear archivo en `matprompt/`).
2. **Cada agente:** Antes de su paso (2–7), leer **solo su subsección** del bundle + handoffs de roles previos.
3. **Tarea nueva en mitad del run:** MATPROMT añade **«DELTA — fecha»** con prompts solo para roles afectados.

---

## Plantilla de bundle (copiar por cada run)

```markdown
## Bundle — RUN YYYY-MM-DD / runN

- **Resumen ejecutivo (3–5 líneas):**
- **Objetivos del usuario / agenda:**
- **Roles N/A este run:** (y por qué)
- **Orden o notas de Parallel/Serial:**

### Orchestrator — Prompt orientador
- **Objetivo del rol en este run:**
- **Leer antes de actuar:**
- **Hacer (máx. 5 bullets):**
- **Entregables:**
- **No hacer (anti-patrones):**
- **Handoff a:**

### MATPROMT — Prompt orientador
- (Autoprompt: mantener bundle actualizado; emitir DELTA ante cambios.)

### Mapping — Prompt orientador
- **Objetivo:**
- **Leer:**
- **Hacer:**
- **Entregables:**
- **No hacer:**
- **Handoff a:**

### Design — Prompt orientador
… (repetir para cada rol §2 que participe: Sheets Structure, Networks, Dependencies, Integrations, GPT/Cloud, Fiscal, Billing, Audit/Debug, Reporter, Contract, Calc, Security, Judge, Parallel/Serial, Repo Sync)

### DELTA — (solo si aplica)
- **Disparador:** (tarea nueva / cambio de prioridad)
- **Roles afectados:**
- **Instrucciones ajustadas:**
```

---

## Bundle — RUN 2026-03-20 / run33

**Archivo dedicado:** [matprompt/MATPROMT-RUN-2026-03-20-run33.md](./matprompt/MATPROMT-RUN-2026-03-20-run33.md)

- **Resumen ejecutivo:** Full team run33; Pista 3 (tabs/triggers) coordinación; handoff Matias; verificación Mapping (planilla-inventory ↔ tabs esperados, sin drift); §2.2 transversales revisadas. Estado vigente por rol; REPORT, JUDGE, REPO-SYNC; PROJECT-STATE y Próximos prompts actualizados para run34 (smoke post-Sheets).
- **Objetivos:** Pasos 0→0a→0b→1→…→8→9; Pista 3 checklist/handoff; Mapping verificación; salida artefactos + STATE + Próximos prompts run34.
- **Roles N/A profundo:** Sheets Structure (ejecución Matias); GPT/Cloud (Run 38).
- **Orden:** Serie; ver [parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run33.md](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run33.md).

---

## Bundle — RUN 2026-03-20 / run32

**Archivo dedicado:** [matprompt/MATPROMT-RUN-2026-03-20-run32.md](./matprompt/MATPROMT-RUN-2026-03-20-run32.md)

- **Resumen ejecutivo:** Full team sync (Invoque full team); Run 32 roadmap: cierre honesto AUTOPILOT 24–25 + contratos; §2.2 transversales revisadas (ai-interactive-team, bmc-project-team-sync aplicables; chat-equipo N/A). Estado vigente por rol; artefactos REPORT, JUDGE, REPO-SYNC; PROJECT-STATE y Próximos prompts actualizados.
- **Objetivos:** Pasos 0→0a→0b→1→…→8→9; salida resumen ejecutivo + enlaces a artefactos.
- **Roles N/A profundo:** Sheets Structure (Pista 3 manual); GPT/Cloud (Run 38).
- **Orden:** Serie documental; ver [parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run32.md](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run32.md).

---

## Convenciones

- **SMART:** objetivos medibles por artefacto en repo (archivo, sección de doc, test).
- **Rutas:** preferir rutas relativas al repo `Calculadora-BMC`.
- **Secrets:** nunca incluir tokens; usar `process.env` / referencias genéricas a `.env`.
- **Judge:** si un rol está N/A, declararlo explícitamente para no penalizar omisión.

---

## Bundle — RUN 2026-03-19 / run21

- **Resumen ejecutivo (3–5 líneas):** Run 21 combina protocolo **0a MATPROMT** con **implementación** en calculadora fachada: tornillos T2 cotizados por **unidad** (precio del paquete ÷100), **cinta butilo** solo si el usuario la activa (default off), **silicona 300 ml neutra** como producto opcional con SKU MATRIZ `SIL300N`. Tests `validation.js` ampliados; UI en `PanelinCalculadoraV3.jsx`.
- **Objetivos del usuario / agenda:** Cerrar slice BOM fachada acordado + documentar full team.
- **Roles N/A este run (profundo):** **Sheets Structure** (sin cambio tabs); **Networks** (sin deploy); **Integrations** (sin OAuth/webhook); **GPT/Cloud** (sin cambio OpenAPI); **Fiscal/Billing** (sin conciliación); **Audit/Debug** (sin audit runner); **Security** (sin review nueva amenaza); **Repo Sync** (sincronización externa opcional). *(Paso 0: marcar “leído / N/A”.)*
- **Orden o notas Parallel/Serial:** Ver `docs/team/parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-19-run21.md` (serie; implementación Calc primero).

### Orchestrator — Prompt orientador
- **Objetivo del rol en este run:** Ejecutar 0→0a→0b→…→9; asegurar que MATPROMT deje bundle y que Calc confirme tests verdes antes del cierre.
- **Leer antes de actuar:** `PROJECT-STATE.md`, `PROMPT-FOR-EQUIPO-COMPLETO.md`, bundle run21 (esta sección).
- **Hacer (máx. 5 bullets):** (1) Invocar MATPROMT 0a. (2) Ordenar implementación + tests. (3) Registrar REPORT/JUDGE run21. (4) Actualizar PROMPT “Próximos prompts”. (5) Handoff Repo Sync si aplica.
- **Entregables:** Estado actualizado; run21 trazado en docs.
- **No hacer (anti-patrones):** No pedir tabs Sheets sin Matias; no forzar `npm audit --force`.
- **Handoff a:** MATPROMT luego Calc.

### MATPROMT — Prompt orientador
- **Objetivo:** Mantener este bundle; ante **DELTA** (nueva tarea a mitad de run) añadir subsección `DELTA — fecha` con roles tocados.
- **Leer:** `PROJECT-TEAM-FULL-COVERAGE.md` §2, run21 REPORT.
- **Hacer:** Revisar que cada rol §2 figure como participante o **N/A** con causa.
- **Entregables:** Bundle consistente; fila en histórico.
- **No hacer:** No incluir secretos.
- **Handoff a:** Orchestrator.

### Mapping — Prompt orientador
- **Objetivo:** Confirmar mapeo **SIL300N** → `SELLADORES.silicona_300_neutra` si la MATRIZ adopta el SKU; si no, N/A.
- **Leer:** `matrizPreciosMapping.js`, `planilla-inventory.md` (selladores).
- **Hacer:** Anotar en `PROJECT-STATE` si falta columna/SKU real en planilla.
- **Entregables:** Nota breve en REPORT o state.
- **No hacer:** No editar Sheets sin Matias.
- **Handoff a:** Calc / Dependencies.

### Design — Prompt orientador
- **Objetivo:** UX toggles “Cinta butilo” / “Silicona 300 ml neutra” bajo selladores fachada — revisar jerarquía si hace falta en iteración siguiente.
- **Leer:** `PanelinCalculadoraV3.jsx` sección OPCIONES.
- **Hacer:** N/A profundo este run salvo feedback usuario.
- **Entregables:** —
- **No hacer:** No bloquear ship por estética menor.
- **Handoff a:** Calc.

### Sheets Structure — Prompt orientador
- **N/A:** Sin cambios estructurales; solo validación futura SKU silicona 300.

### Networks — Prompt orientador
- **N/A:** Sin tareas infra este run.

### Dependencies — Prompt orientador
- **Objetivo:** Mencionar en `service-map.md` o state si el flujo calculadora ↔ MATRIZ gana un SKU nuevo (`SIL300N`).
- **Leer:** `dependencies.md` (fecha al próximo sync si aplica).
- **Hacer:** Patch opcional de “última actualización” cuando Repo Sync.
- **Entregables:** —
- **No hacer:** —
- **Handoff a:** Repo Sync.

### Integrations — Prompt orientador
- **N/A:** Sin Shopify/Drive OAuth en este slice.

### GPT/Cloud — Prompt orientador
- **N/A:** Sin cambio `openapi-calc.yaml` obligatorio; si Actions envían payload pared extendido, validar en run futuro.

### Fiscal — Prompt orientador
- **N/A:** Sin análisis DGI este run.

### Billing — Prompt orientador
- **N/A:** Sin CSV billing.

### Audit/Debug — Prompt orientador
- **N/A:** Sin audit runner; smoke: `npm test` verde en Calc.

### Reporter — Prompt orientador
- **Objetivo:** `REPORT-SOLUTION-CODING-2026-03-19-run21.md`.
- **Leer:** diff calculadora + tests.
- **Hacer:** Resumen tabla implementación + pendientes.
- **Entregables:** Reporte en `docs/team/reports/`.
- **No hacer:** —
- **Handoff a:** Judge.

### Contract — Prompt orientador
- **Objetivo:** Verificar que consumidores de `calcSelladorPared` con 3 args sigan OK (`opts` default).
- **Leer:** `src/utils/calculations.js` export.
- **Hacer:** Si hay API HTTP que serialice pared, anotar campos nuevos opcionales.
- **Entregables:** Nota en REPORT si hay endpoint afectado.
- **No hacer:** —
- **Handoff a:** Calc.

### Calc — Prompt orientador
- **Objetivo:** Implementar T2 c/u, opciones cinta/sil300; duplicar lógica en `PanelinCalculadoraV3.jsx` inline data; mantener `calculations.js` canónico.
- **Leer:** `constants.js`, `calculations.js`, `validation.js`.
- **Hacer:** `npm run lint` en archivos tocados; `npm test`.
- **Entregables:** Código + tests verdes.
- **No hacer:** No hardcodear sheet IDs.
- **Handoff a:** Reporter / Judge.

### Security — Prompt orientador
- **N/A:** Sin superficie nueva de secretos.

### Judge — Prompt orientador
- **Objetivo:** `JUDGE-REPORT-RUN-2026-03-19-run21.md`.
- **Leer:** REPORT run21, bundle MATPROMT.
- **Hacer:** Ranqueo corto; marcar N/A justificados.
- **Entregables:** Judge report.
- **No hacer:** —
- **Handoff a:** Orchestrator.

### Parallel/Serial — Prompt orientador
- **Objetivo:** Plan run21 en `PARALLEL-SERIAL-PLAN-2026-03-19-run21.md`.
- **Leer:** carga del run.
- **Hacer:** Declarar serie para cambio único dominio calc.
- **Entregables:** Plan archivo.
- **No hacer:** —
- **Handoff a:** Orchestrator.

### Repo Sync — Prompt orientador
- **Objetivo:** Tras OK usuario, push a remotos configurados; reflejar artefactos equipo si sync externo.
- **Leer:** `PROJECT-STATE` pendientes.
- **Hacer:** Lista de archivos cambiados para copiar a `bmc-development-team` si procede.
- **Entregables:** Commit / informe sync.
- **No hacer:** No forzar credenciales.
- **Handoff a:** Orchestrator.

### DELTA — (solo si aplica)
- **No aplica** en run21 cierre.

---

## Bundle — RUN 2026-03-20 / run23 (fusión run22 + Presupuesto libre V3)

- **Resumen:** Run **23** unifica el cierre documental **run 22** (propagate & synchronize) con la **UI Presupuesto libre** en `PanelinCalculadoraV3.jsx` (acordeones, `calcPresupuestoLibre`, BOM por grupos, PDF/WhatsApp).
- **Bundle completo (prompts por rol + DELTA):** [`docs/team/matprompt/MATPROMT-RUN-2026-03-20-run23.md`](./matprompt/MATPROMT-RUN-2026-03-20-run23.md)
- **Parallel/Serial:** [`docs/team/parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run23.md`](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run23.md)
- **Judge:** [`docs/team/judge/JUDGE-REPORT-RUN-2026-03-20-run23.md`](./judge/JUDGE-REPORT-RUN-2026-03-20-run23.md)
- **Implementación (Reporter/Coding):** [`docs/team/reports/REPORT-SOLUTION-CODING-2026-03-20-full-team-implement.md`](./reports/REPORT-SOLUTION-CODING-2026-03-20-full-team-implement.md)

### DELTA — (run23)
- **Disparador opcional:** Acotar listado tornillería a `PRESUPUESTO_LIBRE_IDS` / portar UI a `PanelinCalculadoraV3_backup`.
- **Roles:** Calc, Mapping (MATRIZ), Reporter (PROJECT-STATE).

---

## Bundle — RUN 2026-03-19 / run31 (post-autopilot + ciclo mejora)

- **Resumen:** **Invoque full team** 0→9 inmediatamente después del paquete AUTOPILOT 24–30: síntesis de estado, **CI local** (`npm run lint` 0 errores / `npm test` **119 passed**), artefactos Reporter/Judge/Repo Sync, y **PROMPT run32+**.
- **Bundle completo (prompts por rol):** [`matprompt/MATPROMT-RUN-2026-03-19-run31.md`](./matprompt/MATPROMT-RUN-2026-03-19-run31.md)
- **Parallel/Serial:** [`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-19-run31.md`](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-19-run31.md)
- **Reporter:** [`reports/REPORT-SOLUTION-CODING-2026-03-19-run31.md`](./reports/REPORT-SOLUTION-CODING-2026-03-19-run31.md)
- **Judge:** [`judge/JUDGE-REPORT-RUN-2026-03-19-run31.md`](./judge/JUDGE-REPORT-RUN-2026-03-19-run31.md)
- **Repo Sync:** [`reports/REPO-SYNC-REPORT-2026-03-19-run31.md`](./reports/REPO-SYNC-REPORT-2026-03-19-run31.md)

### DELTA — (run31)
- **Disparador:** Working tree con directorios `?? Calculadora-BMC/`, `?? OmniCRM-Sync/` — auditar antes de commit.
- **Roles:** Security, Repo Sync, Orchestrator.

---

## Bundle — AUTOPILOT Runs 24–30 (2026-03-20)

- **Resumen:** Secuencia **documental** que amarra runs **24→30** al plan [SOLUCIONES-UNO-POR-UNO-2026-03-20.md](./plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md): Git/push → smoke prod → Sheets → calc backup/libre → audit `--force` → SKUs/billing → síntesis.
- **MATPROMT (prompts por run):** [`matprompt/MATPROMT-RUN-AUTOPILOT-24-30.md`](./matprompt/MATPROMT-RUN-AUTOPILOT-24-30.md)
- **Parallel/Serial:** [`parallel-serial/PARALLEL-SERIAL-AUTOPILOT-24-30.md`](./parallel-serial/PARALLEL-SERIAL-AUTOPILOT-24-30.md)
- **Reporter / índice:** [`reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md`](./reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md)
- **Judge (agregado):** [`judge/JUDGE-REPORT-AUTOPILOT-RUN24-30.md`](./judge/JUDGE-REPORT-AUTOPILOT-RUN24-30.md)
- **Judge formal (un archivo por run):** [run24](./judge/JUDGE-REPORT-RUN-2026-03-20-run24.md) · [run25](./judge/JUDGE-REPORT-RUN-2026-03-20-run25.md) · [run26](./judge/JUDGE-REPORT-RUN-2026-03-20-run26.md) · [run27](./judge/JUDGE-REPORT-RUN-2026-03-20-run27.md) · [run28](./judge/JUDGE-REPORT-RUN-2026-03-20-run28.md) · [run29](./judge/JUDGE-REPORT-RUN-2026-03-20-run29.md) · [run30](./judge/JUDGE-REPORT-RUN-2026-03-20-run30.md)
- **Nota:** Marcar ⬜/✓ en la tabla del REPORT cuando cada run se ejecute de verdad; el autopilot no sustituye evidencia.

---

## Roadmap — Runs 32–39 (adelante, 2026)

- **Documento canónico:** [`reports/RUN-ROADMAP-FORWARD-2026.md`](./reports/RUN-ROADMAP-FORWARD-2026.md)
- **Regla:** Antes de cada run numerado, **MATPROMT** confirma o ajusta el bundle (paso **0.1** del roadmap). Si el run actual revela prioridad nueva → **DELTA** + posible run intermedio (**32b**, etc.).
- **Cruzamiento:** Run **32** ≈ honestidad AUTOPILOT + `test:contracts`; **33–34** ≈ Pista 3 Sheets + smoke post-Sheets; **35–37** ≈ AUTOPILOT **27–29**; **38** GPT/Repo Sync; **39** síntesis (AUTOPILOT **30** ampliado).

---

## Bundle — RUN 2026-03-21 / run51 (hub Sheets + cierre itinerante 37–50)

- **Resumen:** **Invoque full team** **run 51** tras **runs 40–50** itinerantes. Unificación del **hub Google Sheets** (`README` + `MAPPER-PRECISO-PLANILLAS-CODIGO`, `SYNC-FULL-TEAM-SHEETS-ACCESS-MAP`, `VARIABLES-Y-MAPEO-UNO-A-UNO`). **Run36:** rama `run36-audit-force` con **0** vulns; **`main`** con **7** hasta merge. CI: lint 0 errores; tests **119 passed**.
- **Bundle completo (prompts por rol):** [`matprompt/MATPROMT-RUN-2026-03-21-run51.md`](./matprompt/MATPROMT-RUN-2026-03-21-run51.md)
- **Parallel/Serial:** [`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-21-run51.md`](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-21-run51.md)
- **Reporter:** [`reports/REPORT-SOLUTION-CODING-2026-03-21-run51.md`](./reports/REPORT-SOLUTION-CODING-2026-03-21-run51.md)
- **Judge:** [`judge/JUDGE-REPORT-RUN-2026-03-21-run51.md`](./judge/JUDGE-REPORT-RUN-2026-03-21-run51.md)
- **Repo Sync:** [`reports/REPO-SYNC-REPORT-2026-03-21-run51.md`](./reports/REPO-SYNC-REPORT-2026-03-21-run51.md)

### DELTA — (run51)
- **Disparador opcional:** Merge `run36-audit-force` → `main` — Security + Orchestrator actualizan PROJECT-STATE y pendientes npm.

---

## Bundle — RUN 2026-03-24 / run53 (consolidación PANELSIM + ML OAuth + gate tooling + Calc KB)

- **Resumen:** **Invoque full team** **run 53** — 21 roles §2 (SIM y SIM-REV incorporados); PANELSIM infra completa (scripts sesión/email/arranque); ML OAuth (skill transversal `bmc-mercadolibre-api`); gate tooling (gate:local, pre-deploy); Calc KB §4–§7; `npm audit` **0**; tests **119 passed**; paso 5h SIM-REV activo.

- **Bundle completo (prompts por rol):** [`matprompt/MATPROMT-RUN-2026-03-24-run53.md`](./matprompt/MATPROMT-RUN-2026-03-24-run53.md)
- **Parallel/Serial:** [`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-24-run53.md`](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-24-run53.md)
- **Reporter:** [`reports/REPORT-SOLUTION-CODING-2026-03-24-run53.md`](./reports/REPORT-SOLUTION-CODING-2026-03-24-run53.md)
- **SIM-REV (5h):** [`panelsim/reports/SIM-REV-REVIEW-2026-03-24-run53.md`](./panelsim/reports/SIM-REV-REVIEW-2026-03-24-run53.md)
- **Judge:** [`judge/JUDGE-REPORT-RUN-2026-03-24-run53.md`](./judge/JUDGE-REPORT-RUN-2026-03-24-run53.md)
- **Repo Sync:** [`reports/REPO-SYNC-REPORT-2026-03-24-run53.md`](./reports/REPO-SYNC-REPORT-2026-03-24-run53.md)

### DELTA — (run53)
- **Disparador opcional:** Avance real en ML OAuth, E2E o Pista 3 → agentes afectados actualizan PROJECT-STATE; MATPROMT emite DELTA si cambia prioridad del run 54.

---

## Bundle — RUN 2026-03-27 / run55 (full team — cierre documental 0→9 + agenda operador)

- **Resumen:** **Invoque full team** **run 55** — secuencia canónica **0→9** según plan equipo; foco **WA + correo ingest + Cloud Run + CRM/Sheets**; **2b N/A**; **5h SIM-REV** en forma **delta** (sin `panelsim:session` obligatorio; evidencia SIM vigente run 54). CI: ver **verify-ci** en [`reports/REPORT-SOLUTION-CODING-2026-03-27-run55.md`](./reports/REPORT-SOLUTION-CODING-2026-03-27-run55.md).

- **Bundle completo (prompts por rol + delta):** [`matprompt/MATPROMT-RUN-2026-03-27-run55.md`](./matprompt/MATPROMT-RUN-2026-03-27-run55.md)
- **Parallel/Serial:** [`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-27-run55.md`](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-27-run55.md)
- **Reporter:** [`reports/REPORT-SOLUTION-CODING-2026-03-27-run55.md`](./reports/REPORT-SOLUTION-CODING-2026-03-27-run55.md)
- **SIM-REV (5h):** [`panelsim/reports/SIM-REV-REVIEW-2026-03-27-run55.md`](./panelsim/reports/SIM-REV-REVIEW-2026-03-27-run55.md)
- **Judge:** [`judge/JUDGE-REPORT-RUN-2026-03-27-run55.md`](./judge/JUDGE-REPORT-RUN-2026-03-27-run55.md)
- **Repo Sync:** [`reports/REPO-SYNC-REPORT-2026-03-27-run55.md`](./reports/REPO-SYNC-REPORT-2026-03-27-run55.md)

### DELTA — (run55)
- **Disparador:** Cierre documental run 55; pendientes humanos **cm-0 / cm-1 / cm-2** y fixes **503 cotizaciones** / **duplicados MATRIZ** siguen abiertos hasta evidencia o código.

---

## Bundle — RUN 2026-03-24 / run54 (full team + Invocación PANELSIM)

- **Resumen:** **Invoque full team** **run 54** — objetivo **SIM/PANELSIM**; CI `npm run gate:local` (**119 passed**, 1 warning ESLint); cierre con **`npm run panelsim:session`** e informe [`panelsim/reports/PANELSIM-SESSION-STATUS-2026-03-24T04-21-27Z.md`](./panelsim/reports/PANELSIM-SESSION-STATUS-2026-03-24T04-21-27Z.md) (Sheets OK, correo OK, API health 200, MATRIZ 200, **`/auth/ml/status` ok** en local).

- **Bundle completo (prompts por rol + delta vs run53):** [`matprompt/MATPROMT-RUN-2026-03-24-run54.md`](./matprompt/MATPROMT-RUN-2026-03-24-run54.md)
- **Parallel/Serial:** [`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-24-run54.md`](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-24-run54.md)
- **Reporter:** [`reports/REPORT-SOLUTION-CODING-2026-03-24-run54.md`](./reports/REPORT-SOLUTION-CODING-2026-03-24-run54.md)
- **SIM-REV (5h):** [`panelsim/reports/SIM-REV-REVIEW-2026-03-24-run54.md`](./panelsim/reports/SIM-REV-REVIEW-2026-03-24-run54.md)
- **Judge:** [`judge/JUDGE-REPORT-RUN-2026-03-24-run54.md`](./judge/JUDGE-REPORT-RUN-2026-03-24-run54.md)
- **Repo Sync:** [`reports/REPO-SYNC-REPORT-2026-03-24-run54.md`](./reports/REPO-SYNC-REPORT-2026-03-24-run54.md)

### DELTA — (run54)
- **Disparador:** Invocación PANELSIM post-paso 9 — evidencia en `PANELSIM-SESSION-STATUS-*.md`; ML OAuth local verificado.

---

## Bundle — RUN 2026-03-22 / run52 (cierre R3–R5 + agenda Pista 3 / E2E / Repo Sync)

- **Resumen:** **Invoque full team** **run 52** — artefactos **R3** (MATPROMT), **R4** (Parallel/Serial), **R5** (Judge) tras pre-run R1–R2; **`main`** ya en **origin** con deps run36; **`npm audit`:** **0**; tests **119 passed**.

- **Bundle completo (prompts por rol):** [`matprompt/MATPROMT-RUN-2026-03-22-run52.md`](./matprompt/MATPROMT-RUN-2026-03-22-run52.md)
- **Parallel/Serial:** [`parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-22-run52.md`](./parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-22-run52.md)
- **Reporter:** [`reports/REPORT-SOLUTION-CODING-2026-03-22-run52.md`](./reports/REPORT-SOLUTION-CODING-2026-03-22-run52.md)
- **Judge:** [`judge/JUDGE-REPORT-RUN-2026-03-22-run52.md`](./judge/JUDGE-REPORT-RUN-2026-03-22-run52.md)
- **Repo Sync:** [`reports/REPO-SYNC-REPORT-2026-03-22-run52.md`](./reports/REPO-SYNC-REPORT-2026-03-22-run52.md)

### DELTA — (run52)
- **Disparador opcional:** Avance real en Pista 3 o E2E → Mapping + Audit actualizan PROJECT-STATE; MATPROMT emitir **DELTA** solo si cambia prioridad del run 53.

---

## Histórico

| Fecha | Run | Ubicación del bundle |
|-------|-----|----------------------|
| 2026-03-27 | run55 (full team 0→9 + agenda operador) | [`matprompt/MATPROMT-RUN-2026-03-27-run55.md`](./matprompt/MATPROMT-RUN-2026-03-27-run55.md) |
| 2026-03-24 | run54 (full team + Invocación PANELSIM) | [`matprompt/MATPROMT-RUN-2026-03-24-run54.md`](./matprompt/MATPROMT-RUN-2026-03-24-run54.md) |
| 2026-03-24 | run53 (PANELSIM + ML OAuth + gate tooling + Calc KB) | [`matprompt/MATPROMT-RUN-2026-03-24-run53.md`](./matprompt/MATPROMT-RUN-2026-03-24-run53.md) |
| 2026-03-22 | run52 (R3–R5 cierre + agenda operativa) | [`matprompt/MATPROMT-RUN-2026-03-22-run52.md`](./matprompt/MATPROMT-RUN-2026-03-22-run52.md) |
| 2026-03-21 | run51 (hub Sheets + itinerante) | [`matprompt/MATPROMT-RUN-2026-03-21-run51.md`](./matprompt/MATPROMT-RUN-2026-03-21-run51.md) |
| 2026-03-20 | roadmap 32–39 | [`reports/RUN-ROADMAP-FORWARD-2026.md`](./reports/RUN-ROADMAP-FORWARD-2026.md) — plan vivo; bundles por run se añaden al ejecutar cada uno |
| 2026-03-19 | run31 (post-autopilot) | Sección arriba + [`matprompt/MATPROMT-RUN-2026-03-19-run31.md`](./matprompt/MATPROMT-RUN-2026-03-19-run31.md) |
| 2026-03-20 | autopilot 24–30 | Sección arriba + [`matprompt/MATPROMT-RUN-AUTOPILOT-24-30.md`](./matprompt/MATPROMT-RUN-AUTOPILOT-24-30.md) + Judge formal run24–run30 (`judge/JUDGE-REPORT-RUN-2026-03-20-run24.md` … `run30.md`) |
| 2026-03-20 | run23 (fusión) | Sección arriba + [`matprompt/MATPROMT-RUN-2026-03-20-run23.md`](./matprompt/MATPROMT-RUN-2026-03-20-run23.md) |
| 2026-03-19 | run21 | Sección «Bundle — RUN 2026-03-19 / run21» en este archivo |
| 2026-03-19 | Sync review | `docs/team/matprompt/MATPROMT-RUN-SYNC-REVIEW-2026-03-19.md` + `IMPLEMENTATION-PLAN-SYSTEM-SYNC-100-2026-03-19.md` |
| 2026-03-19 | Alta MATPROMT | Esta guía creada; primer bundle al siguiente «Invoque full team» |

*(Añadir una fila por cada run que genere bundle.)*
