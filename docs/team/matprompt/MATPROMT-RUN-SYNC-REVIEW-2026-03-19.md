# MATPROMT — Full team RUN «Sync review» (2026-03-19)

**Objetivo:** Revisar **todas las modificaciones recientes**, verificar **propagación end-to-end** y cerrar brechas hasta **sincronicidad ~100%** (canónico = UI = MATRIZ = tests = docs = deploy).

---

## Prompt maestro (pegar para “Invoque full team” / Orquestador)

```
FULL TEAM — RUN SYNC REVIEW (2026-03-19)

0. Leer PROJECT-STATE, PROMPT-FOR-EQUIPO-COMPLETO, este archivo y
   docs/team/IMPLEMENTATION-PLAN-SYSTEM-SYNC-100-2026-03-19.md (plan de cierre).

0a. MATPROMT: cada rol §2 lee su subsección abajo + plan § fases que le tocan.
    DELTA: si aparece nueva deriva durante el run, MATPROMT documenta solo roles afectados.

0b. Parallel/Serial: Fase A→B motor+UI primero (serie); luego MATRIZ/docs (paralelo donde no choquen).

1–8. Ejecutar auditoría según rol (checklist en subsecciones).

9. Ciclo de mejoras: ejecutar IMPLEMENTATION-PLAN § próximos pasos hasta el primer gate “tests+lint verdes”;
   actualizar PROJECT-STATE “Cambios recientes” con deriva detectada y cierre aplicado.

Criterio de salida run: tabla “Deriva resuelta” en REPORT + Judge + PROJECT-STATE.
```

---

## Estado verificado en repo (no opinion — hechos)

| Capa | ¿Alineado con `src/data/constants.js` (FIJACIONES unitarias + `HERRAMIENTAS` + `presupuesto_libre`)? |
|------|--------------------------------------------------------------------------------------------------------|
| **`src/utils/calculations.js`** | **NO** — aún usa `x100` / `x1000` / `unidades_por_paquete` en caballete, perfilería T1, T2 pared, remaches. |
| **`src/components/PanelinCalculadoraV3.jsx`** | **NO** — copia inline de FIJACIONES con paquetes viejos; sin escenario `presupuesto_libre` en `SCENARIOS_DEF` local; sin UI de líneas libres. |
| **`src/utils/helpers.js` → `bomToGroups`** | **NO** — sin rama `presupuestoLibre` / grupo dedicado. |
| **`src/data/pricing.js`** | **Sí** — `HERRAMIENTAS` en BASE y flat list para editor. |
| **`src/data/matrizPreciosMapping.js`** | **Parcial** — faltan SKUs para anclajes nuevos, remache 316, tornillos exagonales, pistola (ver plan). |
| **`tests/validation.js`** | **Parcial** — asume lógica T2/remaches acorde a motor **actual** en repo (riesgo si solo se cambia constants). |
| **Docs (`API-REFERENCE`, CHANGELOG, PROJECT-STATE)** | **Parcial** — PROJECT-STATE aún menciona T1×100 / unidades_por_paquete en run21 vs constants ya unitarios. |

**Duplicados / matriz histórica (respuesta negocio):**

- En MATRIZ **antes** casi no había filas explícitas para anclajes Isoroof/BC/U-Platea ni remache 3/16 ni tornillos exagonales de la planilla; solo entradas puntuales (`CABROJ`, `CBUT`, `BROMPLAST`, `SIL300N`, paneles, goteros…).
- En código hubo **solapamiento conceptual**: `remache_pop` único ×1000 vs planilla con **dos** remaches POP; `tornillo_aguja` ×100 vs planilla por **unidad**; `anclaje_h` precios legacy vs fila “Anclaje 100 mm” nueva.

---

## Bundle por rol §2 (prompt orientador corto)

### Orchestrator
- **Objetivo:** Cerrar deriva constants ↔ motor ↔ UI según plan; un solo “canónico”.
- **Leer:** `IMPLEMENTATION-PLAN-SYSTEM-SYNC-100-2026-03-19.md`.
- **Hacer:** Ordenar fases A→G; bloquear “done” solo con `npm test` + lint archivos tocados + nota en PROJECT-STATE.
- **Handoff:** Calc + MATPROMT.

### MATPROMT
- **Objetivo:** Mantener DELTA si cambian prioridades; reflejar en `MATPROMT-FULL-RUN-PROMPTS.md` histórico fila “sync review”.
- **Handoff:** Orchestrator.

### Mapping + Sheets
- **Objetivo:** Lista de SKUs MATRIZ ↔ `FIJACIONES.*` / `HERRAMIENTAS.*` nuevos; sin hardcode en código de sheet IDs.
- **Entregable:** Filas propuestas para planilla + actualización `matrizPreciosMapping.js`.

### Dependencies + service-map
- **Objetivo:** Documentar nodos “Calculadora canónica vs UI inline” hasta que converjan; riesgo de doble verdad.
- **Entregable:** Patch `service-map.md` + `dependencies.md` fecha.

### Contract + GPT/Cloud
- **Objetivo:** Si API expone cotización/payload pared/techo, validar campos nuevos (`inclCintaButilo`, etc.); OpenAPI drift.
- **N/A profundo** si no hay cambio de endpoint este sprint.

### Calc (bmc-calculadora-specialist)
- **Objetivo:** **Unificar** `calculations.js` con precios **por unidad**; eliminar `/100` `/1000` en líneas BOM; opcional `calcPresupuestoLibre(lineas[])`.
- **Tests:** `npm test` obligatorio.

### Design + V3
- **Objetivo:** Escenario **Presupuesto libre** en selector; UI catálogo `PRESUPUESTO_LIBRE_IDS` + cantidades; ideally **importar** `FIJACIONES`/`HERRAMIENTAS` desde `constants.js` para no duplicar.
- **Handoff:** Calc.

### Audit/Debug + Security
- **Objetivo:** Smoke E2E cotización tras cambio; CORS/env sin secretos en commit.
- **N/A** audit runner completo salvo pedido explícito.

### Reporter + Judge + Parallel/Serial + Repo Sync
- **Objetivo:** REPORT “Sync review”, Judge score, plan paralelo para MATRIZ+docs vs código.
- **Repo Sync:** lista archivos a copiar a `bmc-development-team` si aplica.

### Fiscal / Billing / Integrations / Networks
- **N/A** salvo que cambien montos fiscales exportados o CRM; solo verificar que BOM no rompa IVA final (sigue en `calcTotalesSinIVA`).

---

## DELTA — (completar solo si cambia el alcance a mitad de run)

- *Vacío al crear este archivo.*
