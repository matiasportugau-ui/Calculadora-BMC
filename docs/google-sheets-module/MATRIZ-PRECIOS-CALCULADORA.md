# MATRIZ de Precios → Planilla Calculadora

**Propósito:** Sincronizar precios de la [MATRIZ de COSTOS y VENTAS 2026](https://docs.google.com/spreadsheets/d/1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo/edit) (workbook canónico en código) con la calculadora BMC (`GET /api/actualizar-precios-calculadora` → CSV → Config → Listado de precios).

*(Puede existir una copia u otra URL; el ID efectivo es `BMC_MATRIZ_SHEET_ID` o el default en `server/config.js`.)*

---

## Convención de etiquetas IVA (para planilla, código y asistentes)

Objetivo: **cero ambigüedad**. Evitar títulos del tipo solo “+ IVA” o “USD + IVA” sin aclarar si el **número de la celda** ya trae IVA o no.

### Regla **tal cual** (confirmada operativa)

- **Columna F** (`Costo m² USD ex IVA`): el número **no lleva IVA incluido**. Al leer o escribir desde/ hacia la MATRIZ o el CSV de costo: **usar el valor exacto de la celda** — **no** multiplicar ni dividir por 1,22.
- **Columna L** (`Venta local USD ex IVA`): igual — **ex IVA**, **tal cual** la celda en import/export y en `push-pricing-overrides` (F/L).
- **Columna M** (referencia consumidor **c/IVA**): el número **ya incluye IVA**. **Tomar M tal cual** — **no** convertir.
- **Columna T** (`Venta web USD ex IVA`): **tal cual** en CSV `venta_web` y en `push-pricing-overrides`.
- **Columna U** (`Venta web USD c/IVA`): **tal cual** en CSV `venta_web_iva_inc` (solo export; el servidor **no** escribe esa columna).

### Abreviaturas canónicas BMC

| Etiqueta corta | Significado | Uso |
|----------------|-------------|-----|
| **ex IVA** | Importe **sin** IVA (base imponible en USD) | F, L, T y `venta_web` en lista / CSV |
| **c/IVA** o **IVA inc.** | Importe **con** IVA incluido | **M** (ref. consumidor), **U** (web c/IVA); **tal cual** celda |

**Regla de encabezado:** Si el valor de la celda es **ex IVA**, el título debe decir **explícitamente** `ex IVA` (no bastan “más IVA” ni “+ IVA” solos).

### Ejemplos de encabezados recomendados (pestaña BROMYROS)

- `Costo m² USD ex IVA` (antes: “Costo m² U$S + IVA” si el número es compra proveedor sin IVA)
- `Venta local USD ex IVA`
- `Venta web USD ex IVA` (col **T**)
- `Venta web USD c/IVA` (col **U** → CSV `venta_web_iva_inc`, sin push)
- Si necesitás columna de referencia al público: `P. consumidor c/IVA` o `Lista IVA inc.` (y el número debe ser realmente con IVA)

### Para IA / desarrollo

En comentarios de código y en prompts: usar siempre el par **ex IVA** vs **c/IVA**; no usar “+ IVA” como sinónimo de “ex IVA”.

---

## Índices vs letras (desarrollo)

En `server/routes/bmcDashboard.js`, pestaña **BROMYROS**, las columnas se definen con **`COL("L")`**: la fuente de verdad es la **letra** como en Google Sheets. La función `colLetterToIndex` vive en `server/lib/sheetColumnLetters.js` (con tests en `tests/validation.js`). Así se evita equivocarse con números 0-based a mano.

## Mapeo de columnas (pestaña **BROMYROS** — código)

| Col | Contenido operativo | CSV / calculadora |
|-----|----------------------|-------------------|
| D | SKU | → `path` vía `matrizPreciosMapping.js` |
| E | Descripción | → `descripcion` |
| F | Costo compra proveedor (**USD ex IVA**) | → `costo` **idéntico** a la celda |
| L | Venta lista BMC (**USD ex IVA**) | → `venta_local` **idéntico** a la celda |
| M | Referencia con **IVA ya incluido** | → `venta_local_iva_inc` **idéntico** a la celda |
| T | `Venta web USD ex IVA` | → `venta_web` **idéntico** a la celda |
| U | `Venta web USD c/IVA` | → `venta_web_iva_inc` **idéntico** a la celda (solo lectura en CSV; no push) |

`POST /api/matriz/push-pricing-overrides`: solo **F**, **L** y **T** (overrides); **no** escribe **U** (ni **M**).

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

## Renombrar encabezados en Google Sheets (F/L/M/T)

Si la fila 1 de **BROMYROS** todavía dice “+ IVA” de forma ambigua, ejecutá (con SA con rol **Editor** en el workbook):

```bash
npm run matriz:rename-headers -- --dry-run
npm run matriz:rename-headers
```

Opcional: segunda columna de costo confusa en **G**: `npm run matriz:rename-headers -- --include-g`  
Otra fila de títulos: `--row 3` (solo si los encabezados no están en la fila 1).

Script: `scripts/matriz-rename-bromyros-headers.mjs`.

## Scripts: CSV en disco y fijaciones Isodec (BROMYROS)

- **`npm run matriz:pull-csv`** — Descarga el mismo CSV que `GET /api/actualizar-precios-calculadora` (default `http://localhost:3001`; override `BMC_API_BASE`) y lo guarda en **`.runtime/matriz-precios-latest.csv`** (carpeta gitignored).
- **`npm run matriz:sync-fijaciones-isodec`** — Lee por API de Sheets las filas **161–166** de **BROMYROS** (varilla, tuerca, carrocero, tortuga blanca/gris, taco) donde **col D suele estar vacía** y actualiza **`venta` / `web` / `costo` en `src/data/constants.js`** (F, L, T tal cual). Opciones: `--dry-run`. **Arandela plana:** búsqueda por descripción + **ARPLA38** en col D; si no hay match, se intenta la fila **167** (descripción tipo “Arandela Plana…” o SKU correcto). Override: `MATRIZ_ROW_ARANDELA_PLANA=…`.
- **`npm run matriz:sync-silicona-300`** — Fila **168** por defecto (`MATRIZ_ROW_SILICONA_300_NEUTRA` opcional) → `SELLADORES.silicona_300_neutra` en `constants.js`. Convén **SIL300N** en col D para CSV `/api/actualizar-precios-calculadora` y validación del script.

## Skill

`.cursor/skills/actualizar-precios-calculadora/SKILL.md`
