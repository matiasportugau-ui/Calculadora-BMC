# MATRIZ de Precios → Planilla Calculadora

**Propósito:** Sincronizar precios de la [MATRIZ de COSTOS y VENTAS 2026](https://docs.google.com/spreadsheets/d/1VBbVay7pwPgC40CWCIr35VbKVuxPsKBZ/edit?gid=1520466943) con la planilla editable de la Calculadora BMC.

## Mapeo de columnas

| Col MATRIZ | Contenido | Uso en Calculadora |
|------------|-----------|---------------------|
| D | SKU / Código producto | Mapeo a path (ej. PANELS_TECHO.ISOROOF_3G.esp.30) |
| G | Costo compra proveedor (con IVA) | → costo sin IVA (/ 1.22) |
| L | Precio venta consumidor (con IVA) | → venta_bmc_local sin IVA (/ 1.22) |
| M | Precio venta web (con IVA) | → venta_web sin IVA (/ 1.22) |

## Flujo

1. **Consultar** `GET /api/actualizar-precios-calculadora`
2. El servidor lee la MATRIZ, aplica el mapeo SKU→path, convierte a sin IVA
3. Devuelve un CSV descargable
4. En Config → Listado de precios → **Importar planilla modificada** → seleccionar el CSV descargado
5. Los overrides se aplican en la Calculadora

## Configuración

- `BMC_MATRIZ_SHEET_ID`: ID del workbook MATRIZ (default: 1VBbVay7pwPgC40CWCIr35VbKVuxPsKBZ)
- `GOOGLE_APPLICATION_CREDENTIALS`: Service account con acceso de **lector** a la MATRIZ

Compartir la MATRIZ con `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com` como **Lector**.

## Mapeo SKU → path

Ver `src/data/matrizPreciosMapping.js`. Se puede extender agregando entradas a `MATRIZ_SKU_TO_PATH`.

## Skill

Usar cuando el usuario pida: actualizar precios calculadora, sincronizar precios desde MATRIZ, levantar precios de la planilla, /actualizar-precios-calculadora.
