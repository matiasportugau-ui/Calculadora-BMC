# MATRIZ de Precios → Planilla Calculadora

**Propósito:** Sincronizar precios de la [MATRIZ de COSTOS y VENTAS 2026](https://docs.google.com/spreadsheets/d/1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo/edit) (workbook canónico en código) con la calculadora BMC (`GET /api/actualizar-precios-calculadora` → CSV → Config → Listado de precios).

**Columnas actuales (2026):** G (costo ex IVA), J (venta local ex IVA), K (ref c/IVA), R (venta web ex IVA), S (venta web c/IVA). Ver `MATRIZ_TAB_COLUMNS` en `server/routes/bmcDashboard.js`.

*(Puede existir una copia u otra URL; el ID efectivo es `BMC_MATRIZ_SHEET_ID` o el default en `server/config.js`.)*

---

## Convención de etiquetas IVA (para planilla, código y asistentes)

Objetivo: **cero ambigüedad**. Evitar títulos del tipo solo “+ IVA” o “USD + IVA” sin aclarar si el **número de la celda** ya trae IVA o no.

### Regla **tal cual** (confirmada operativa)

- **Columna G** (`Costo m² USD ex IVA`): el número **no lleva IVA incluido**. Al leer o escribir desde/ hacia la MATRIZ o el CSV de costo: **usar el valor exacto de la celda** — **no** multiplicar ni dividir por 1,22.
- **Columna J** (`Venta local USD ex IVA`): igual — **ex IVA**, **tal cual** la celda en import/export y en `push-pricing-overrides` (G/J).
- **Columna K** (referencia consumidor **c/IVA**): el número **ya incluye IVA**. **Tomar K tal cual** — **no** convertir.
- **Columna R** (`Venta web USD ex IVA`): **tal cual** en CSV `venta_web` y en `push-pricing-overrides`.
- **Columna S** (`Venta web USD c/IVA`): **tal cual** en CSV `venta_web_iva_inc` (solo export; el servidor **no** escribe esa columna).

### Abreviaturas canónicas BMC

| Etiqueta corta | Significado | Uso |
|----------------|-------------|-----|
| **ex IVA** | Importe **sin** IVA (base imponible en USD) | G, J, R y `venta_web` en lista / CSV |
| **c/IVA** o **IVA inc.** | Importe **con** IVA incluido | **K** (ref. consumidor), **S** (web c/IVA); **tal cual** celda |

**Regla de encabezado:** Si el valor de la celda es **ex IVA**, el título debe decir **explícitamente** `ex IVA` (no bastan “más IVA” ni “+ IVA” solos).

### Ejemplos de encabezados recomendados (pestaña BROMYROS)

- `Costo m² USD ex IVA` (col **G**)
- `Venta local USD ex IVA` (col **J**)
- `Venta web USD ex IVA` (col **R**)
- `Venta web USD c/IVA` (col **S** → CSV `venta_web_iva_inc`, sin push)
- Referencia consumidor c/IVA (col **K**)
- Si necesitás columna de referencia al público: `P. consumidor c/IVA` o `Lista IVA inc.` (y el número debe ser realmente con IVA)

### Para IA / desarrollo

En comentarios de código y en prompts: usar siempre el par **ex IVA** vs **c/IVA**; no usar “+ IVA” como sinónimo de “ex IVA”.

---

## Índices vs letras (desarrollo)

En `server/routes/bmcDashboard.js`, pestaña **BROMYROS**, las columnas se definen con **`COL("J")`** (u otras): la fuente de verdad es la **letra** como en Google Sheets. La función `colLetterToIndex` vive en `server/lib/sheetColumnLetters.js` (con tests en `tests/validation.js`). Así se evita equivocarse con números 0-based a mano.

## Mapeo de columnas (pestaña **BROMYROS** — código)

| Col | Contenido operativo | CSV / calculadora |
|-----|----------------------|-------------------|
| D | SKU | → `path` vía `matrizPreciosMapping.js` |
| E | Descripción | → `descripcion` |
| G | Costo compra proveedor (**USD ex IVA**) | → `costo` **idéntico** a la celda |
| J | Venta lista BMC (**USD ex IVA**) | → `venta_local` **idéntico** a la celda |
| K | Referencia con **IVA ya incluido** | → `venta_local_iva_inc` **idéntico** a la celda |
| R | `Venta web USD ex IVA` | → `venta_web` **idéntico** a la celda |
| S | `Venta web USD c/IVA` | → `venta_web_iva_inc` **idéntico** a la celda (solo lectura en CSV; no push) |

`POST /api/matriz/push-pricing-overrides`: solo **G**, **J** y **R** (overrides); **no** escribe **S** (ni **K**).

---

## Flujo

1. `GET /api/actualizar-precios-calculadora`
2. El servidor lee la MATRIZ (pestañas en `MATRIZ_TAB_COLUMNS` en `server/routes/bmcDashboard.js`), mapea SKU→path
3. Devuelve CSV (`path`, `costo`, `venta_local`, `venta_local_iva_inc`, `venta_web`, `venta_web_iva_inc`, …)
4. Config → Listado de precios → **Cargar desde MATRIZ** o **Importar planilla modificada**

## Configuración

- `BMC_MATRIZ_SHEET_ID` (default en código: `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`)
- `GOOGLE_APPLICATION_CREDENTIALS`: service account con acceso a la MATRIZ

## Mapeo SKU → path

`src/data/matrizPreciosMapping.js` — `MATRIZ_SKU_TO_PATH`.

## Renombrar encabezados en Google Sheets (G/J/K/R/S)

Si la fila 1 de **BROMYROS** todavía dice “+ IVA” de forma ambigua, ejecutá (con SA con rol **Editor** en el workbook):

```bash
npm run matriz:rename-headers -- --dry-run
npm run matriz:rename-headers
```

Opcional: si hay columna de costo alternativa en otra letra (ej. G), usar flags del script.  
Otra fila de títulos: `--row 3` (solo si los encabezados no están en la fila 1).

Script: `scripts/matriz-rename-bromyros-headers.mjs`.

## Scripts: CSV en disco y fijaciones Isodec (BROMYROS)

- **`npm run matriz:pull-csv`** — Descarga el mismo CSV que `GET /api/actualizar-precios-calculadora` (default `http://localhost:3001`; override `BMC_API_BASE`) y lo guarda en **`.runtime/matriz-precios-latest.csv`** (carpeta gitignored).
- **`npm run matriz:sync-fijaciones-isodec`** — Lee por API de Sheets las filas **161–166** de **BROMYROS** (varilla, tuerca, carrocero, tortuga blanca/gris, taco) donde **col D suele estar vacía** y actualiza **`venta` / `web` / `costo` en `src/data/constants.js`** (G, J, R tal cual). Opciones: `--dry-run`. **Arandela plana:** búsqueda por descripción + **ARPLA38** en col D; si no hay match, se intenta la fila **167** (descripción tipo “Arandela Plana…” o SKU correcto). Override: `MATRIZ_ROW_ARANDELA_PLANA=…`.
- **`npm run matriz:sync-silicona-300`** — Fila **168** por defecto (`MATRIZ_ROW_SILICONA_300_NEUTRA` opcional) → `SELLADORES.silicona_300_neutra` en `constants.js`. Convén **SIL300N** en col D para CSV `/api/actualizar-precios-calculadora` y validación del script. (Lee G/J/R tal cual).

## Skill

`.cursor/skills/actualizar-precios-calculadora/SKILL.md`
