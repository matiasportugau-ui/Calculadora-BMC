# Plan de implementación — Sincronicidad ~100% del sistema (Calculadora BMC)

**Fecha:** 2026-03-19  
**Disparador:** Full team sync review tras cambios en `constants.js` (fijaciones unitarias, `HERRAMIENTAS`, `presupuesto_libre`, catálogo libre) **sin** propagación completa a motor/UI.

**Definición de “100% sync” (este plan):**

1. Una sola fuente de verdad de precios de **FIJACIONES**/**HERRAMIENTAS** para motor y UI (ideal: import desde `constants.js`, sin bloque duplicado desactualizado).
2. `calculations.js` BOM usa **solo precio unitario** y cantidades enteras reales (sin `x100`/`x1000` en costeo).
3. Escenario **`presupuesto_libre`** visible en UI + líneas manuales + totales/IVA coherente con resto de escenarios.
4. `bomToGroups` agrupa presupuesto libre sin mezclar lógica techo/pared.
5. `matrizPreciosMapping.js` + documentación Sheets reflejan SKUs nuevos o quedan explícitamente “pendiente Matias”.
6. `npm test` y ESLint en archivos tocados **verdes**.
7. `PROJECT-STATE` / `CHANGELOG` / `API-REFERENCE` coherentes con el comportamiento real.

---

## Fase A — Motor canónico (`src/utils/calculations.js`)

| ID | Tarea | Criterio aceptación |
|----|--------|----------------------|
| A1 | `calcFijacionesCaballete`: `cant` tornillo aguja = `tornillosAguja`; `pu = p(tornillo_aguja)`; `unidad: "unid"` | Línea BOM coincide con constants unitarias; total = cant × pu |
| A2 | `calcPerfileriaTecho`: T1 `cant = fijPerf` (o fórmula explícita 1 tornillo por punto si negocio lo confirma); eliminar `ceil(/100)` | Sin unidad `x100` en ítem |
| A3 | `calcFijacionesPared` T2: `pu = p(tornillo_t2)` directo; eliminar `unidades_por_paquete` | Tests suite 14 actualizados (PU ≈ lista web unitaria) |
| A4 | `calcFijacionesPared` remaches: `cant = remaches`, `pu = p(remache_pop)`, `unidad: "unid"` | Sin `x1000` |
| A5 | (Opcional) `calcPresupuestoLibre(lineas)` donde `lineas = [{ bucket, id, cant }]` | Retorna `allItems`, `totales`, flag `presupuestoLibre: true` |

**Dependencias:** ninguna externa. **Riesgo:** cambio de magnitud de totales vs versión paquetes — comunicar a negocio.

---

## Fase B — UI principal (`PanelinCalculadoraV3.jsx`)

| ID | Tarea | Criterio aceptación |
|----|--------|----------------------|
| B1 | Añadir `presupuesto_libre` a `SCENARIOS_DEF` + `VIS` (espejo `constants.js` o import centralizado) | Selector muestra “Presupuesto libre” |
| B2 | Eliminar duplicación: **importar** `FIJACIONES`, `HERRAMIENTAS`, `PRESUPUESTO_LIBRE_IDS` desde `../data/constants.js` **o** script de sync check en CI | Grep no encuentra `unidades_por_paquete` en V3 |
| B3 | Replicar en funciones locales las mismas fórmulas que Fase A (hasta que V3 importe `calc*` desde `calculations.js` — preferido a largo plazo) | Resultados V3 ≈ API/motor |
| B4 | UI presupuesto libre: estado `libreLineas[]`, agregar/quitar, dropdown por `PRESUPUESTO_LIBRE_IDS`, totales con `calcTotalesSinIVA` | BOM muestra grupo claro (ver Fase C) |

---

## Fase C — BOM (`src/utils/helpers.js`)

| ID | Tarea | Criterio aceptación |
|----|--------|----------------------|
| C1 | Si `result.presupuestoLibre && result.allItems`, retornar `[{ title: "PRESUPUESTO LIBRE", items }]` (o split FIJACIONES/HERRAMIENTAS si se prefiere) | PDF/tabla coherente |

---

## Fase D — MATRIZ y mapping (`src/data/matrizPreciosMapping.js`)

| ID | Tarea | Criterio aceptación |
|----|--------|----------------------|
| D1 | Asignar SKU columna D por fila para: anclajes Isoroof/BC/U, remache 316, tornillos exagonales, pistola | `getPathForMatrizSku` resuelve path |
| D2 | Documentar en `planilla-inventory.md` o nota Mapping: columnas costo/venta/web con IVA → sin IVA | Sin secretos |

---

## Fase E — Tests (`tests/validation.js`)

| ID | Tarea | Criterio aceptación |
|----|--------|----------------------|
| E1 | Ajustar suites 9–10–14 a lógica **unitaria** (T1, aguja, T2 PU, remaches) | `npm test` PASS |
| E2 | Test mínimo `calcPresupuestoLibre` si se implementa A5 | 1 caso con 2 líneas |

---

## Fase F — Docs y estado

| ID | Tarea | Criterio aceptación |
|----|--------|----------------------|
| F1 | `docs/API-REFERENCE.md`: T1/T2/remache/agua como `unid` | Sin referencias a paquetes en coste |
| F2 | `docs/CHANGELOG.md` entrada “Sync: motor+UI unitario + presupuesto libre” | Versión bump si release |
| F3 | `docs/team/PROJECT-STATE.md`: eliminar contradicciones (T1×100 vs unitario) | Una sola narrativa |

---

## Fase G — Deploy y runtime

| ID | Tarea | Criterio aceptación |
|----|--------|----------------------|
| G1 | `npm run build` | Build OK |
| G2 | Contrato/API si aplica: `npm run test:contracts` con API arriba | PASS o N/A documentado |

---

## Orden recomendado (ejecución)

**Serial:** A → E (tests) → B → C → F → G  
**Paralelo (cuando dueño distinto):** D (MATRIZ) con F1–F3 si no bloquea código.

---

## Propietarios sugeridos

| Fase | Rol principal |
|------|----------------|
| A, E | Calc |
| B, C | Calc + Design |
| D | Mapping (+ Matias para columnas Sheets) |
| F | Reporter / Orchestrator |
| G | Networks / Integrations |

---

## Checklist rápido “¿propagó?”

```bash
rg "x100|x1000|unidades_por_paquete" src/utils/calculations.js src/components/PanelinCalculadoraV3.jsx
rg "presupuesto_libre" src/components/PanelinCalculadoraV3.jsx
npm test
```

*(Resultado esperado post-cierre: sin matches de paquete en motor/UI; escenario libre presente; tests verdes.)*
