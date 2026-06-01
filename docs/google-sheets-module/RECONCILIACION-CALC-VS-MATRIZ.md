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

> **Cobertura SKU: 137/137.** Los 18 paths que antes no tenían SKU ya están mapeados en
> `matrizPreciosMapping.js` (commit de cierre de gap). Donde el precio se comparte con otra
> variante, se usó un **SKU disjunto** para que cada path tenga su propia fila en col D:

| Path | SKU nuevo |
|---|---|
| `FIJACIONES.tornillo_hex_galv_4/6_mecha` | `THEXG4M` / `THEXG6M` |
| `FIJACIONES.tornillo_hex_galv_4/6_aguja` | `THEXG4A` / `THEXG6A` |
| `FIJACIONES.varilla_roscada_8mm` · `taco_expansivo_8mm` | `VAR8MM` · `TACEX8MM` |
| `gotero_frontal_greca.ISOROOF.50/80` | `GFCGR50` / `GFCGR80` |
| `babeta_adosar/empotrar.ISODEC_PIR._all` | `BBADPIR` / `BBEMPIR` |
| `cumbrera` · `soporte_canalon` · `gotero_lateral_camara` `.ISODEC_PIR._all` | `CUMPIR` · `SOPCANPIR` · `GLDCAMPIR` |
| `canalon.ISODEC_PIR.120` | `CANPIR120` |
| `perfil_u.ISOPANEL.250` | `PU250MM` |
| `perfil_u.ISOWALL.80/50/100` | `PU80MM` / `PUW50MM` / `PUW100MM` |

> **Acción operativa:** para que estos productos se editen *desde el sheet*, agregar una fila por
> cada SKU nuevo en la col D de BROMYROS (con su F/L/M/T). Mientras no existan esas filas, igual
> se bakean correctamente vía el export de la calculadora (clave por `path`).

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

---

## 5. Camino A — bake & deploy (elegido)

`scripts/bake-matriz-to-constants.mjs` escribe los precios de un CSV (formato MATRIZ o export
de la calculadora) dentro de `src/data/constants.js`. Modifica **solo** los valores numéricos de
`venta` (col L), `web` (col T) y `costo` (col F); preserva `ap`, `sku`, `largo`, `label`,
comentarios y formato. Funciona con hojas en una línea, anidadas (`ISODEC: { _all: { … } }`) y
multilínea (`perfil_k2`, `perfil_5852`).

```bash
# 1) bajar el CSV en vivo de la MATRIZ (ya limpia)
npm run matriz:pull-csv                                  # → .runtime/matriz-precios-latest.csv

# 2) previsualizar el diff (no escribe nada)
npm run matriz:bake -- .runtime/matriz-precios-latest.csv --dry-run

# 3) aplicar a constants.js
npm run matriz:bake -- .runtime/matriz-precios-latest.csv

# 4) revisar diff, gate y deploy
git diff src/data/constants.js
npm run gate:local
git add src/data/constants.js && git commit -m "chore: bake precios MATRIZ a constants" && git push
# deploy: Vercel (frontend) toma el push; API en Cloud Run según pipeline.
```

**Garantía de seguridad:** el baker **omite valores numéricamente iguales** (diff mínimo) y reporta
los paths del CSV que no tienen hoja en `constants.js`. Self-test: bakear el export actual de la
calculadora produce **0 ediciones** (no-op), porque el export y `constants.js` ya coinciden.

> El baker actualiza `venta` / `web` / `costo`. La columna **M** (`venta_local_iva_inc`) y **U**
> (`venta_web_iva_inc`) son referencias c/IVA; la UI deriva c/IVA = ex IVA × 1,22 si hace falta.
