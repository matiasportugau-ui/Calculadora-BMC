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

## Histórico

| Fecha | Run | Ubicación del bundle |
|-------|-----|----------------------|
| 2026-03-20 | run23 (fusión) | Sección arriba + [`matprompt/MATPROMT-RUN-2026-03-20-run23.md`](./matprompt/MATPROMT-RUN-2026-03-20-run23.md) |
| 2026-03-19 | run21 | Sección «Bundle — RUN 2026-03-19 / run21» en este archivo |
| 2026-03-19 | Sync review | `docs/team/matprompt/MATPROMT-RUN-SYNC-REVIEW-2026-03-19.md` + `IMPLEMENTATION-PLAN-SYSTEM-SYNC-100-2026-03-19.md` |
| 2026-03-19 | Alta MATPROMT | Esta guía creada; primer bundle al siguiente «Invoque full team» |

*(Añadir una fila por cada run que genere bundle.)*
