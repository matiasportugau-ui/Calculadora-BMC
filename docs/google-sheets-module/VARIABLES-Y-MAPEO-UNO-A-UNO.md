# Variables extraíbles y mapeo consciente (uno a uno)

**Estado:** Canónico en este repo; **índice del módulo:** [README.md](README.md). Mapeo runtime de columnas/pestañas: [MAPPER-PRECISO-PLANILLAS-CODIGO.md](MAPPER-PRECISO-PLANILLAS-CODIGO.md). Acceso por producto: [SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md](SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md).

**Propósito:** Lista canónica de **variables extraíbles** por planilla/workbook, su **campo lógico** (canónico o de producto) y un **proceso de verificación fila a fila** para asegurar que código, hoja y extensiones coinciden.

**Documentos base (no duplicar; este archivo orquesta):**

| Documento | Contenido |
|-----------|-----------|
| **[MAPPER-PRECISO-PLANILLAS-CODIGO.md](MAPPER-PRECISO-PLANILLAS-CODIGO.md)** | **Mapeo extraído del código** (`bmcDashboard.js`): columnas exactas, offsets, primera pestaña vs fija, `BMC_SHEET_SCHEMA`. |
| [planilla-inventory.md](planilla-inventory.md) | 5 workbooks, tabs, rutas API GET/PUSH |
| [planilla-map.md](planilla-map.md) | CRM_Operativo columnas actuales vs blueprint |
| [SHEETS-MAPPING-5-WORKBOOKS.md](SHEETS-MAPPING-5-WORKBOOKS.md) | Columna origen → campo canónico + mapper en `bmcDashboard.js` |
| [MAPPING-VALIDATION-AUDIT-VS-INVENTORY.md](MAPPING-VALIDATION-AUDIT-VS-INVENTORY.md) | Gaps audit vs inventario |
| OmniCRM: `omnicrm-sync/shared/data-mapper.js` + `docs/omnicrm-apps-script-v1.1.gs` | Payload extensión → columnas Web App |

---

## 1. Inventario de workbooks y variables “de sistema”

Variables de entorno que **seleccionan** qué planilla lee el backend:

| Variable | Workbook (rol) |
|----------|----------------|
| `BMC_SHEET_ID` | BMC crm_automatizado — CRM, cotizaciones, entregas |
| `BMC_PAGOS_SHEET_ID` | Pagos Pendientes 2026 |
| `BMC_VENTAS_SHEET_ID` | 2.0 - Ventas |
| `BMC_STOCK_SHEET_ID` | Stock E-Commerce |
| `BMC_CALENDARIO_SHEET_ID` | Calendario vencimientos |
| `BMC_MATRIZ_SHEET_ID` | MATRIZ costos/ventas (calculadora) |

**Verificación uno a uno (checklist corta):**

- [ ] Cada `*_SHEET_ID` en deploy (Cloud Run / local) = URL del libro correcto en Drive.
- [ ] Service account `bmc-dashboard-sheets@…` tiene **lector** (mínimo) en cada workbook.
- [ ] Nombre de tab consumida por API coincide con el real (ej. `Pendientes_` vs `Pagos_Pendientes` — ver gaps en MAPPING-VALIDATION).

---

## 2. Tabla maestra: variable extraíble → origen → consumidor

Usar esta tabla como **matriz viva**: al cambiar una columna en Sheets o un campo en API, actualizar **una fila** y marcar verificación.

**Leyenda:** **Origen** = tab + nombre de columna en planilla (o índice si es estable). **Consumidor** = ruta API, componente UI o script.

### 2.1 Workbook principal — `BMC_SHEET_ID` — tab `CRM_Operativo`

Columnas operativas según [planilla-map.md §2](planilla-map.md) (31 columnas observadas).  
Mapeo API “core” según [SHEETS-MAPPING §2.1](SHEETS-MAPPING-5-WORKBOOKS.md):

| # | Columna en Sheet (origen) | Campo canónico / uso | Consumidor principal |
|---|---------------------------|----------------------|----------------------|
| 1 | ID | `COTIZACION_ID` | `/api/cotizaciones`, dashboard |
| 2 | Fecha | `FECHA_CREACION` | Idem |
| 3 | Cliente | `CLIENTE_NOMBRE` | Idem |
| 4 | Teléfono | `TELEFONO` | Idem |
| 5 | Ubicación / Dirección | `DIRECCION` | Idem |
| 6 | Origen | (filtros / Parametros) | UI, reporting |
| 7 | Consulta / Pedido | `NOTAS` | Idem |
| 8–31 | Categoría … Observaciones … | Ver planilla-map §2 | Según feature (KPI, alertas, etc.) |
| — | Fecha próxima acción | `FECHA_ENTREGA` | entregas, coordinación |
| — | Estado | `ESTADO` | Idem |
| — | Responsable | `ASIGNADO_A` | Idem |
| — | Monto estimado USD | `MONTO_ESTIMADO` | Si mapper lo expone |

**Verificación uno a uno (proceso):**

1. Abrir `CRM_Operativo` fila de encabezado real (fila 3 según docs; confirmar en vivo).
2. Por cada fila de la tabla anterior: ¿el **nombre** en Sheets es **exactamente** el que asume `bmcDashboard.js` / normalización? Si renombran columna, actualizar mapper o doc el mismo día.
3. Ejecutar GET `/api/cotizaciones` y comprobar que cada campo canónico llega con dato de prueba conocido.

---

### 2.2 Pagos — `BMC_PAGOS_SHEET_ID` — tab real (ej. `Pendientes_`)

| Campo canónico | Columnas origen típicas | Consumidor |
|----------------|-------------------------|------------|
| `PRECIO_VENTA` / `MONTO` | Precio de Venta IVA Inc, Venta U$S IVA inc., etc. | `/api/kpi-financiero`, `/api/pagos-pendientes` |
| `COSTO_COMPRA` | Costo de la compra | Idem |
| `CLIENTE_NOMBRE` | CLIENTE | Breakdown |
| `COTIZACION_ID` | ÓRDEN / Ped. Nro | Match pedidos |
| `FECHA_VENCIMIENTO` | FECHA / PLAZO | KPI |
| `ESTADO_PAGO` | ESTADO | Filtros |
| `PROVEEDOR` | PROVEEDOR | Filtros |

**Gap conocido:** cabeceras duplicadas o nombres de tab — revisar [MAPPING-VALIDATION §2.2](MAPPING-VALIDATION-AUDIT-VS-INVENTORY.md).

**Verificación:** una fila de prueba con valores conocidos; comparar respuesta JSON de `/api/pagos-pendientes`.

---

### 2.3 Ventas 2.0 — `BMC_VENTAS_SHEET_ID` — múltiples tabs (proveedores)

| Campo canónico | Columna origen | Notas |
|----------------|----------------|-------|
| `COTIZACION_ID` | ID. Pedido | |
| `CLIENTE_NOMBRE` | NOMBRE | |
| `FECHA_ENTREGA` | FECHA ENTREGA | |
| `COSTO` | COSTO SIN IVA / MONTO SIN IVA | |
| `GANANCIA` | GANANCIAS SIN IVA | |
| `PROVEEDOR` | **Nombre de la pestaña** | Gap histórico: API puede leer solo primera tab — validar código actual |

**Verificación:** por cada tab crítica, una fila conocida; confirmar `PROVEEDOR` en JSON.

---

### 2.4 Stock E-Commerce — `BMC_STOCK_SHEET_ID`

| Campo canónico | Columna origen | Consumidor |
|----------------|----------------|------------|
| `CODIGO` | Codigo / Código | `/api/stock-ecommerce`, PATCH stock |
| `PRODUCTO` | Producto | Idem |
| `COSTO_USD` | Costo m2 U$S + IVA | KPI |
| `MARGEN_PCT` | Margen % | Idem |
| `GANANCIA` | Ganancia | Idem |
| `VENTA_USD` | Venta + IVA | Idem |
| `STOCK` | Stock | Alertas |
| `PEDIDO_PENDIENTE` | Pedido RYC / Pedido … | |
| `SHOPIFY_SYNC_AT` | (columna nueva al final) | Sync |

---

### 2.5 Calendario — `BMC_CALENDARIO_SHEET_ID`

| Uso | Columnas típicas |
|-----|------------------|
| Vencimientos mensuales | CONCEPTO, IMPORTE $, NO PAGO, IMPORTE U$S (tabs mensuales) |

---

### 2.6 MATRIZ — `BMC_MATRIZ_SHEET_ID` (calculadora)

| Variable exportable | Descripción |
|---------------------|-------------|
| SKU / Código | Mapeo a `matrizPreciosMapping` / path calculadora |
| Costo | Sin IVA tras conversión |
| Venta BMC / Web | Precios lista |

Ver [MATRIZ-PRECIOS-CALCULADORA.md](MATRIZ-PRECIOS-CALCULADORA.md) y [planilla-inventory §0](planilla-inventory.md).

**Verificación:** “Cargar desde MATRIZ” en calculadora con 2–3 SKUs de prueba; comparar con celda en Sheet.

---

### 2.7 OmniCRM Sync → Google Sheets (canal WhatsApp/ML/IG/FB)

**No es el mismo esquema que CRM_Operativo.** Payload preset `google_sheets_all_platforms`:

| Clave en JSON (extensión → Web App) | Columna creada por Apps Script `CONFIG.headers` |
|-------------------------------------|--------------------------------------------------|
| Timestamp | Timestamp |
| Platform | Platform |
| Direction | Direction |
| Contact Name | Contact Name |
| Contact ID | Contact ID |
| Username | Username (p. ej. IG) |
| Message | Message |
| Message Type | Message Type |
| Conversation | Conversation |
| Conv. Type | Conv. Type |
| Order ID | Order ID |
| Pack ID | Pack ID |
| Product | Product |
| Order Status | Order Status |
| Category | Category |
| Status | Status |
| Event ID | Event ID |
| `_targetSheet` | (no es columna; define pestaña destino) |

**Conflicto con hoja BMC en español:** si la pestaña destino tiene columnas distintas (ej. “Nombre Completo del Cliente”), hay que **o** una pestaña dedicada con headers del script **o** adaptar `CONFIG.headers` + `buildRow` en Apps Script.

**Verificación uno a uno:** por cada clave del preset, una captura de fila en Sheet con valor de prueba; comparar con `data-mapper.js` y `buildRow` en `.gs`.

---

## 3. Plantilla de verificación (copiar por sprint)

```
Variable ID: _____________
Origen: Workbook ___ | Tab ___ | Columna "___" (letra __ fila header __)
Campo canónico o clave producto: _____________
Consumidor: (API / UI / Apps Script / extensión) _____________
Criterio OK: _____________
Verificado por: _____________ Fecha: _____________
Evidencia: (link JSON, screenshot fila, o ID de test)
```

---

## 4. Orden recomendado de trabajo (equipo)

1. **Congelar nombres** de columnas en Sheets para tabs ya en producción; cambios solo con PR en código + fila en esta tabla.
2. **Prioridad 1:** `CRM_Operativo` + Pagos + MATRIZ (ingresos y dinero).
3. **Prioridad 2:** Ventas multi-tab + Stock (gaps de tabs ya documentados).
4. **Prioridad 3:** OmniCRM pestaña dedicada o alineación de headers con CRM BMC.
5. Tras cada cambio: actualizar [MAPPING-VALIDATION-AUDIT-VS-INVENTORY.md](MAPPING-VALIDATION-AUDIT-VS-INVENTORY.md) si aplica.

---

## 5. Cómo exportar una lista “máquina” para diff

- Auditoría previa: [FULL-SHEETS-AUDIT-REPORT.md](FULL-SHEETS-AUDIT-REPORT.md) + `FULL-SHEETS-AUDIT-RAW.json`.
- Repetir auditoría tras cambios estructurales y comparar columnas por tab.

---

**Última actualización:** 2026-03-13  
**Owner sugerido:** rol **Mapping** + **Sheets Structure** (ejecución manual de columnas en Sheets).
