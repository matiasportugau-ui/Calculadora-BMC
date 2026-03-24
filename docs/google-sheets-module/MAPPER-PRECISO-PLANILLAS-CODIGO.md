# Mapeo preciso de planillas — fuente: código (`server/`)

**Canónico:** No mantener otra “tabla maestra” de columnas fuera de este archivo y de [README.md](README.md) del módulo. Para acceso por producto (UI/GPT/OmniCRM) ver [SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md](SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md).

**Generado a partir de:** `server/config.js`, `server/routes/bmcDashboard.js` (router BMC Finanzas).  
**Propósito:** Una sola referencia **alineada al runtime**: qué `env`, qué pestaña, qué fila de encabezados y qué nombres de columna asume el código (incl. sinónimos `findKey`).

Documentación de negocio previa: [planilla-inventory.md](planilla-inventory.md), [SHEETS-MAPPING-5-WORKBOOKS.md](SHEETS-MAPPING-5-WORKBOOKS.md). Este archivo **prioriza el código** si hay divergencia.

---

## 0. Variables de entorno y trampa del schema

| Variable | Uso en código | Default / notas |
|----------|----------------|-----------------|
| `BMC_SHEET_ID` | Workbook principal (CRM, audit, metas, fallback pagos/calendario) | Vacío → 503 en rutas que lo requieren |
| `BMC_SHEET_SCHEMA` | Selecciona pestaña y offsets para cotizaciones / entregas | **`Master_Cotizaciones`** si no se define en `.env` |
| `BMC_PAGOS_SHEET_ID` | Workbook solo pagos | Opcional; si falta, pagos pueden leerse del principal |
| `BMC_VENTAS_SHEET_ID` | Workbook 2.0 Ventas | Requerido para `/api/ventas` |
| `BMC_STOCK_SHEET_ID` | Stock E-Commerce | Requerido para stock |
| `BMC_CALENDARIO_SHEET_ID` | Calendario vencimientos | Opcional; fallback a tab en principal |
| `BMC_MATRIZ_SHEET_ID` | MATRIZ costos/ventas | Default en código: `1VBbVay7pwPgC40CWCIr35VbKVuxPsKBZ` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Credencial service account | Requerido para Sheets API |

**Crítico:** Con el default `BMC_SHEET_SCHEMA=Master_Cotizaciones`, las rutas usan la pestaña **`Master_Cotizaciones`** y **no** aplican `headerRowOffset: 2`. Para operación documentada como **CRM_Operativo** hay que definir:

```bash
BMC_SHEET_SCHEMA=CRM_Operativo
```

Sin eso, **POST/PATCH `/api/cotizaciones`** devuelven **501** (solo permitidos con `CRM_Operativo`).

---

## 1. Workbook principal — `BMC_SHEET_ID`

### 1.1 Cotizaciones, próximas entregas, coordinación — `getCotizacionesSheetOpts(schema)`

| `BMC_SHEET_SCHEMA` | Pestaña | Fila encabezados | Rango lectura efectivo |
|----------------------|---------|------------------|-------------------------|
| `CRM_Operativo` | `CRM_Operativo` | **Fila 3** (`headerRowOffset: 2`) | `'CRM_Operativo'!A3:ZZ` → primera fila = headers |
| Otro (p. ej. default `Master_Cotizaciones`) | `Master_Cotizaciones` | Fila 1 (`headerRowOffset` 0) | Primera fila del rango = headers |

**Mapeo CRM → canónico (`CRM_TO_BMC` en código):**

| Columna en hoja (clave objeto = header) | Campo API / interno |
|----------------------------------------|---------------------|
| `ID` | `COTIZACION_ID` |
| `Fecha` | `FECHA_CREACION` |
| `Cliente` | `CLIENTE_NOMBRE` |
| `Teléfono` | `TELEFONO` |
| `Ubicación / Dirección` | `DIRECCION` |
| `Origen` | `ORIGEN` |
| `Consulta / Pedido` | `NOTAS` |
| `Estado` | `ESTADO` |
| `Responsable` | `ASIGNADO_A` |
| `Fecha próxima acción` | `FECHA_ENTREGA` |
| `Monto estimado USD` | `MONTO_ESTIMADO` |
| `Observaciones` | `COMENTARIOS_ENTREGA` |

**POST `/api/cotizaciones`:** solo si `schema === "CRM_Operativo"`; escribe en `CRM_Operativo` usando **la fila 3** como headers (`A3:ZZ3`).

**PATCH `/api/cotizaciones/:id`:** actualiza solo columnas CRM: `Estado` ← `ESTADO`, `Responsable` ← `ASIGNADO_A`, `Fecha próxima acción` ← `FECHA_ENTREGA`.

**Próximas entregas (CRM):** filtra `ESTADO` ∈ {`Pendiente`, `Abierto`} y `FECHA_ENTREGA` en semana actual.

**Próximas entregas (Master):** `ESTADO === "Confirmado"` + misma ventana de fechas.

### 1.2 `AUDIT_LOG`

- Pestaña fija: **`AUDIT_LOG`** (workbook principal).
- Lectura: `getSheetData` **sin** `headerRowOffset` → encabezados en **fila 1**.
- Append API: rango `AUDIT_LOG!A:H` (8 columnas: timestamp, action, rowId, old, new, user x2, sheet).

### 1.3 `Metas_Ventas`

- Pestaña fija: **`Metas_Ventas`**, workbook principal.
- Sin schema especial: headers = fila 1.
- KPI report busca `PERIODO` y montos vía `findKey(..., "META_MONTO", "Meta", "META")`.

### 1.4 Pagos (fallback sin `BMC_PAGOS_SHEET_ID`)

- Pestaña: **`Pagos_Pendientes`** en el workbook principal.
- Sin mapper `Pagos_2026` en ese branch (lectura genérica).

### 1.5 Calendario (fallback sin `BMC_CALENDARIO_SHEET_ID`)

- Pestaña: **`Calendario de Vencimientos`** en el principal.

---

## 2. Workbook pagos — `BMC_PAGOS_SHEET_ID`

| Aspecto | Comportamiento en código |
|---------|---------------------------|
| **Pestaña** | **`getFirstSheetName(sheetId)`** → la **primera** hoja del libro (orden en UI de Sheets). |
| **Encabezados** | **Fila 1** (`headerRowOffset` implícito 0 en `getSheetData` con schema `Pagos_2026`). |
| **Mapper** | `mapPagos2026ToCanonical` |

**Claves de fila origen reconocidas (`findKey`) — resumen:**

| Destino canónico | Origen (sinónimos en código) |
|------------------|--------------------------------|
| `FECHA_VENCIMIENTO` | `FECHA`, `Fecha`, `PLAZO` |
| `CLIENTE_NOMBRE` | `CLIENTE`, `Cliente` |
| `COTIZACION_ID` | `ÓRDEN`, `ORDEN`, `Pedido`, `N° Pedido`, `Ped. Nro` |
| `MONTO` | `Saldo a Proveedor USD`, `Pago a Proveedor USD`, `Venta U$S IVA inc.`, `Precio de Venta IVA Inc`, saldos pesos |
| `MONEDA` | Derivada: si hay monto USD → `UES`, si no → `$` |
| `ESTADO_PAGO` | `ESTADO`, `Estado` (default `Pendiente`) |
| `PROVEEDOR` | `PROVEEDOR`, `Proveedor` |
| `PRECIO_VENTA` | `Precio de Venta IVA Inc`, `Venta U$S IVA inc.` |
| `COSTO_COMPRA` | `Costo de la compra` |

**POST `/api/pagos`:** `getFirstSheetName`, lee headers fila 1, mapea cuerpo → columnas por nombre; si no hay columna orden/pedido, puede **append** de `COTIZACION_ID` al final.

---

## 3. Workbook ventas — `BMC_VENTAS_SHEET_ID`

| Aspecto | Comportamiento |
|---------|----------------|
| **Pestañas** | **Todas** las del workbook (`getSheetNames` + `Promise.allSettled`). |
| **Encabezados** | **Fila 2** por tab (`headerRowOffset: 1` → headers en fila 2). |
| **PROVEEDOR** | Nombre de la **pestaña** (`tabName` en `mapVentas2026ToCanonical`). |
| **Mapper** | `mapVentas2026ToCanonical` |

**Columnas origen reconocidas:**

| Destino | Origen |
|---------|--------|
| `COTIZACION_ID` | `ID. Pedido`, `ID Pedido`, `Id. Pedido` |
| `CLIENTE_NOMBRE` | `NOMBRE`, `Nombre` |
| `FECHA_ENTREGA` | `FECHA ENTREGA`, `Fecha entrega` |
| `COSTO` | `COSTO SIN IVA`, `MONTO SIN IVA`, `Costo`, … |
| `GANANCIA` | `GANANCIAS SIN IVA`, `Ganancia`, … |
| `SALDO_CLIENTE` | `SALDOS`, `Saldos` |
| `PAGO_PROVEEDOR` | `Pago a Proveedor` |
| `FACTURADO` | `FACTURADO`, `Facturado` |
| `NUM_FACTURA` | `Nº FACTURA`, … |

**GET `/api/ventas?tab=NombrePestaña`:** solo esa pestaña. Sin `tab`: **merge de todas** con `?proveedor=` opcional.

---

## 4. Workbook stock — `BMC_STOCK_SHEET_ID`

| Aspecto | Comportamiento |
|---------|----------------|
| **Pestaña principal KPI** | **`getFirstSheetName(stockSheetId)`** (primera hoja). |
| **Encabezados** | **Fila 3** (`headerRowOffset: 2`). |
| **Mapper** | `mapStockEcommerceToCanonical` (`schema: "Stock_Ecommerce"`) |

**Columnas origen:**

| Destino | Origen |
|---------|--------|
| `CODIGO` | `Codigo`, `Código` |
| `PRODUCTO` | `Producto` |
| `COSTO_USD` | `Costo m2 U$S + IVA`, … |
| `MARGEN_PCT` | `Margen %` |
| `GANANCIA` | `Ganancia` |
| `VENTA_USD` | `Venta + IVA`, `Venta Inm +IVA`, `Venta Inm IVA inc` |
| `STOCK` | `Stock`, `STOCK` |
| `PEDIDO_PENDIENTE` | `Pedido RYC`, `Pedido 11/08`, `Pedido 30/6` |

**GET `/api/stock/history`:** pestañas fijas **`EXISTENCIAS_Y_PEDIDOS`** y **`Egresos`** — **sin** mapper canónico; devuelve filas como objetos genéricos.

**PATCH `/api/stock/:codigo`:** actualiza columnas en la primera hoja según `handleUpdateStock` (incl. `SHOPIFY_SYNC_AT` si existe header).

---

## 5. Workbook calendario — `BMC_CALENDARIO_SHEET_ID`

| Aspecto | Comportamiento |
|---------|----------------|
| **Query `?month=YYYY-MM`** | Tab calculado: **`MES_EN_ESPAÑOL AAAA`** (ej. `MARZO 2026`). |
| **Sin month** | `getFirstSheetName` |
| **Encabezados** | **Fila 2** (`headerRowOffset: 1`) |

---

## 6. MATRIZ — `BMC_MATRIZ_SHEET_ID`

| Aspecto | Comportamiento |
|---------|----------------|
| **Pestaña** | `getFirstSheetName(matrizSheetId)` |
| **Rango** | `'${sheetName}'!A1:Z500` |
| **Encabezados** | **Fila 1** |
| **Columnas** | Búsqueda por regex: SKU `sku|código|codigo`; costo`^costo[s]?$` o `costo (`; venta`venta_bmc|venta consumidor|…`; web`venta_web|venta web|^web$` |
| **Fallback índices** | Si no matchea: columnas **4, 7, 12, 13** (0-based: 3, 6, 11, 12) para sku, costo, venta, web |
| **IVA** | Precios con IVA → divide por `1.22` para CSV hacia calculadora |

---

## 7. Tabla resumen: ruta API → workbook → pestaña → mapper

| Ruta GET/POST | Env / libro | Pestaña (resolución) | Mapper / notas |
|---------------|-------------|----------------------|----------------|
| `/api/cotizaciones` | `BMC_SHEET_ID` | `CRM_Operativo` o `Master_Cotizaciones` | `CRM_TO_BMC` si CRM |
| `/api/proximas-entregas` | Idem | Idem | Filtro fecha + estado |
| `/api/coordinacion-logistica` | Idem | Idem | Texto WhatsApp |
| `/api/audit` | Principal | `AUDIT_LOG` | Raw |
| `/api/pagos-pendientes` | Pagos o principal | Primera hoja **o** `Pagos_Pendientes` | `Pagos_2026` si workbook pagos |
| `/api/metas-ventas` | Principal | `Metas_Ventas` | Raw |
| `/api/kpi-financiero` | Pagos + principal | Pagos: primera hoja; metas: `Metas_Ventas` | Pagos mapeados |
| `/api/calendario-vencimientos` | Calendario o principal | Tab por mes o primera / `Calendario de Vencimientos` | header offset 1 si calendario dedicado |
| `/api/ventas` | `BMC_VENTAS_SHEET_ID` | Todas o `?tab=` | `Ventas_2026` |
| `/api/ventas/tabs` | Ventas | Lista nombres | — |
| `/api/stock-ecommerce`, `/stock-kpi` | `BMC_STOCK_SHEET_ID` | Primera hoja | `Stock_Ecommerce`, offset 2 |
| `/api/stock/history` | Stock | `EXISTENCIAS_Y_PEDIDOS`, `Egresos` | Sin mapper |
| `/api/kpi-report` | Agregación | Varios | Pagos + proximas + stock + metas + ventas |
| POST `/api/cotizaciones` | Principal | `CRM_Operativo` | Solo `CRM_Operativo` |
| POST `/api/pagos` | Pagos o principal | Primera hoja pagos | `handleCreatePago` |
| POST `/api/ventas` | Ventas | Según `handleCreateVenta` | — |
| MATRIZ precios (ruta interna build) | `BMC_MATRIZ_SHEET_ID` | Primera hoja | `buildPlanillaDesdeMatriz` |

---

## 8. Otros (Shopify / preguntas)

- `SHOPIFY_QUESTIONS_SHEET_TAB` en `config.js` (default `Shopify_Preguntas`) — **no** está en el fragmento citado de `bmcDashboard.js`; integración puede vivir en otras rutas. Ver `server/routes` y env.

---

## 9. Mantenimiento

- Tras cambiar **nombres de columnas** en Google Sheets, actualizar **`findKey` / `CRM_TO_BMC` / headers** en `bmcDashboard.js` o alinear la planilla al nombre esperado.
- Tras reordenar **pestañas**, recordar: **pagos/stock/MATRIZ** usan **primera pestaña** salvo rutas con nombre fijo.

---

**Última extracción desde código:** repo Calculadora-BMC — `server/routes/bmcDashboard.js` (lectura integral de mapeos y rutas).
