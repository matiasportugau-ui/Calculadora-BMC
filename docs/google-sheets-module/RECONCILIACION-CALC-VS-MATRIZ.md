# Reconciliación Calculadora ↔ MATRIZ + plan de "sheet como fuente de verdad"

**Fecha:** 2026-06-01 · **Insumos:** export de la calculadora (`Listado de precios`) y export de la MATRIZ (`GET /api/actualizar-precios-calculadora`) del 2026-06-01.

Herramienta reproducible: [`scripts/reconcile-calc-vs-matriz.mjs`](../../scripts/reconcile-calc-vs-matriz.mjs).

```bash
node scripts/reconcile-calc-vs-matriz.mjs <calc-export.csv> <matriz-export.csv> [--out-dir DIR]
# genera: <out-dir>/matriz-import-ready.csv  +  <out-dir>/reconcile-report.json
```

---

## 1. Diagnóstico (estado al 2026-06-01)

| Métrica | Valor |
|---|---|
| Paths en la calculadora (completos) | **137** |
| Paths en la MATRIZ | 72 |
| Paths que faltan en la MATRIZ | **65** |
| Paths con diferencias de precio | 72 (todos) |
| Filas MATRIZ con anomalías (vacíos / negativos / c‑IVA < ex‑IVA) | **72 (todas)** |
| Paths de calc sin SKU en `matrizPreciosMapping.js` | **18** |

**Conclusión:** la calculadora está **completa y correcta**; la MATRIZ está **incompleta y con datos sucios**. Importar la MATRIZ tal cual hoy **rompería** los precios de producción. Concretamente:

- **Paneles** (IAGRO*, IROOF*, ISP*EPSF, IW*, ICR040): solo trae `costo` (col F); `venta_local` (L) y `venta_web` (T) **vacías**.
- **Columna M (c/IVA)** trae basura en varias filas: `IROOF30 = -5.84`, `IROOF40 = 2.69`, `IROOF50 = 5.38`… son **deltas/fórmulas filtradas**, no precios.
- **65 paths** (todo PIR techo, ISOWALL, casi todas las FIJACIONES, varios perfiles) **no tienen fila** en la MATRIZ.

El detalle fila por fila está en `reconcile-report.json` (`diferencias`, `anomaliasMatriz`, `soloEnCalc`).

---

## 2. Mapeo de celdas (fuente de verdad del pipeline)

Pestaña **BROMYROS** de la MATRIZ → CSV → calculadora. Definido en `MATRIZ_TAB_COLUMNS` (`server/routes/bmcDashboard.js`) y `matrizPreciosMapping.js`.

| Celda Sheet | Encabezado canónico | Campo CSV | Campo calc | Regla |
|---|---|---|---|---|
| **D** | SKU | `sku` | (→ `path` vía mapping) | clave estable |
| **E** | Descripción | `descripcion` | `label` | — |
| **F** | Costo m² USD **ex IVA** | `costo` | `.costo` | tal cual |
| **L** | Venta local USD **ex IVA** | `venta_local` | `.venta` | tal cual |
| **M** | P. consumidor **c/IVA** | `venta_local_iva_inc` | `.ventaIvaInc` | tal cual (ref.) |
| **T** | Venta web USD **ex IVA** | `venta_web` | `.web` | tal cual |
| **U** | Venta web USD **c/IVA** | `venta_web_iva_inc` | `.webIvaInc` | tal cual (solo lectura, sin push) |

Si en la calculadora falta el c/IVA, se deriva `ex IVA × 1,22`.

---

## 3. Documento listo para importar

`matriz-import-ready.csv` — 137 filas, formato canónico de la MATRIZ
(`sku,path,descripcion,categoria,costo,venta_local,venta_local_iva_inc,venta_web,venta_web_iva_inc,unidad,tab`),
con la **calculadora como fuente de verdad** y todas las celdas de venta completas (277 celdas rellenadas).

Dos usos:

1. **Importar directo a la calculadora** (Config → Listado de precios → *Importar planilla modificada*) — funciona ya, clave por `path`.
2. **Pegar en la pestaña BROMYROS** para dejar el sheet correcto — requiere alinear columnas D/F/L/M/T y completar los SKU que faltan (ver §4).

> **18 paths quedan con `sku` vacío** en el documento (no existen en `matrizPreciosMapping.js`): no pueden ir al sheet por SKU hasta agregarles una entrada. Sí importan bien a la calculadora (clave por `path`).

Paths sin SKU (a resolver en `matrizPreciosMapping.js` + col D del sheet):
`tornillo_hex_galv_4/6_mecha/aguja`, `varilla_roscada_8mm`, `taco_expansivo_8mm`,
`gotero_frontal_greca.ISOROOF.50/80`, varios `ISODEC_PIR._all` (lateral cámara, babetas, cumbrera, soporte canalón), `canalon.ISODEC_PIR.120`, `perfil_u.ISOPANEL.250`, `perfil_u.ISOWALL.50/80/100`.

---

## 4. Para que "editar el sheet" edite producción

**Hoy NO es automático.** `Cargar desde MATRIZ` guarda los precios en **`localStorage` del navegador del operador** (`src/utils/pricingOverrides.js`) — no es global ni persistente en producción. Editar el sheet cambia el CSV del endpoint, pero **cada navegador** debe volver a cargar, y al limpiar caché se pierde.

Para que el sheet sea fuente de verdad **global y persistente**, hay dos caminos:

- **A — Bake & deploy (recomendado, determinista):** completar la MATRIZ con `matriz-import-ready.csv`, luego regenerar `src/data/constants.js` desde la MATRIZ y commitear/deploy. Los precios quedan en el build para todos. Es la opción alineada con el modelo actual (precios en `constants.js`).
- **B — Fetch en runtime para todos:** que la app llame `/api/actualizar-precios-calculadora` al cargar y aplique los overrides para cualquier usuario (no solo admin). Quita el deploy del loop pero cada cliente pega contra Sheets y hay que cachear.

**Prerrequisito común:** dejar la MATRIZ **completa y limpia** (las 137 filas, columnas F/L/M/T correctas, SKU en D). Sin eso, cualquiera de los dos caminos propaga datos rotos.

### Orden sugerido
1. Completar/limpiar pestaña BROMYROS con `matriz-import-ready.csv` (y agregar los 18 SKU faltantes en col D + `matrizPreciosMapping.js`).
2. `npm run matriz:pull-csv` y `npm run matriz:reconcile -- .runtime/matriz-precios-latest.csv` → 0 duplicados, 0 vacíos.
3. Elegir camino A o B para la persistencia en producción.
