# Sheet Map Preview — Live Scan 2026-03-24

**Service Account:** `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com`
**API Base:** `http://localhost:3001`
**All 6 workbooks:** OK

---

## 1. CRM / Cotizaciones (`BMC_SHEET_ID`)

**Title:** BMC crm_automatizado.xlsm
**ID:** `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg`

| Tab | Rows | Cols | Key Headers | API Route |
|-----|------|------|-------------|-----------|
| **Form responses 1** | 101 | 21 | Timestamp, Fecha Consulta, Cliente, Teléfono, Ubicación, Origen, Pedido, Categoría, Urgencia, Cotización formal, Tipo Cliente | _(intake form)_ |
| **CRM_Operativo** | 1000 | 34 | ID, Fecha, Cliente, Teléfono, Ubicación, Origen, Consulta/Pedido, Categoría, Prioridad, Estado, Responsable, Próxima acción, Monto USD, Probabilidad | `GET /api/cotizaciones` · `POST /api/cotizaciones` |
| **Manual** | 1000 | 26 | Objetivo | _(docs)_ |
| **Parametros** | 1000 | 26 | Estado, Prioridad, Urgencia, SiNo, Probabilidad, Categoria, Responsable, Cierre | _(catalogs/dropdowns)_ |
| **Dashboard** | 1000 | 26 | KPI, Valor, Estado, Cantidad, Prioridad auto, Responsable | _(sheet-side dashboard)_ |
| **Automatismos** | 1000 | 26 | Automatismo, Objetivo, Trigger, Lógica, Herramienta, Estado | _(docs)_ |
| **Ventas_Consolidado** | 1000 | 26 | COTIZACION_ID, PROVEEDOR, CLIENTE_NOMBRE, FECHA_ENTREGA, COSTO, GANANCIA, SALDO_CLIENTE, PAGO_PROVEEDOR, FACTURADO, NUM_FACTURA | `GET /api/marcar-entregado` (target) |

---

## 2. Pagos Pendientes 2026 (`BMC_PAGOS_SHEET_ID`)

**Title:** Pagos pendientes Dashboard
**ID:** `1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI`

| Tab | Rows | Cols | Key Headers | API Route |
|-----|------|------|-------------|-----------|
| **Pendientes_** | 977 | 39 | FECHA, PROVEEDOR, Venta U$S IVA inc, Costo U$S IVA inc, ÓRDEN, CLIENTE, ESTADO, Pago cliente USD, Pago a Proveedor USD, Saldo, PLAZO, SALDO DEL CLIENTE | `GET /api/pagos-pendientes` · `GET /api/kpi-financiero` |
| **CONTACTOS** | 1000 | 26 | COTIZACION_ID, PROVEEDOR, CLIENTE_NOMBRE, FECHA_ENTREGA, GANANCIA, SALDO_CLIENTE, PAGO_PROVEEDOR, FACTURADO, NUM_FACTURA, FECHA_INGRESO | _(reference)_ |
| **Listos_** | 2830 | 39 | FECHA, PROVEEDOR, Venta U$S, Costo U$S, ÓRDEN, CLIENTE, ESTADO, Pago, Saldo | _(archive — completed payments)_ |

---

## 3. Ventas Dashboard 2.0 (`BMC_VENTAS_SHEET_ID`)

**Title:** 2.0 - Ventas Dashboard
**ID:** `1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA`

| Tab | Rows | Cols | Key Headers | API Route |
|-----|------|------|-------------|-----------|
| **Ventas y Coordinaciones** | 951 | 38 | origen, vendedor, ID Pedido, INGRESO, FACT, FECHA ENTREGA, NOMBRE, DIRECCIÓN, PEDIDO, MONTO USD, COSTO, GANANCIAS, FLETE, Datos Facturación, Pago, SALDOS | `GET /api/ventas` |
| **Ventas Realizadas y Entregadas** | 3903 | 80 | VENDEDOR, ID Pedido, INGRESO, FACTURA, ESTADO, FECHA ENTREGA, NOMBRE, MONTO USD, COSTO, GANANCIAS, FLETE | `GET /api/ventas` |
| **TRANSPORTISTAS** | 996 | 28 | Nombre, Estado, Empresa, Destinos, Largos paneles, Contacto, Tarifas | _(reference)_ |
| **BASE DATOS CLIENTES** | 905 | 14 | ID, NOMBRE, EMPRESA, TELÉFONO, EMAIL, FACTURACIÓN, BANCARIOS, DIRECCIÓN, FECHA ALTA, GRUPO, ESTADO | _(reference)_ |
| **BASE DATOS PROVEEDORES** | 602 | 16 | ID, EMPRESA, NOMBRE CONTACTO, CARGO, TELÉFONO, EMAIL, DIRECCIÓN, FACTURACIÓN, BANCARIOS, CONDICIONES PAGO | _(reference)_ |
| **Ventas Rami** | 1000 | 47 | VENDEDOR, ID PEDIDO, ESTADO, NOMBRE, ENCARGO, MONTO IVA inc, COMPRA, MARGEN 25%, FLETE | `GET /api/ventas` |
| **Ventas Realizadas E.E** | 1000 | 39 | ESTADO, FECHA, NOMBRE, ENCARGO, MONTO USD, MAIL, FLETE, FACTURADO | `GET /api/ventas` |
| **Preventas** | 820 | 30 | _(sparse)_ | `GET /api/ventas` |
| **Feedback** | 1005 | 32 | Nombre, Motivo, Realizó compra, Donde, Precio | _(reference)_ |
| _+10 más_ | — | — | Plegadora, Entregas, Llamadas, Aluminios, Distribuidores, Muestras, Contactos, Policarbonatos, Precios 2018, Peon Carga, Tareas/Fletes, Preventa 2022, Preventas Anteriores | _(legacy/archive)_ |

---

## 4. Stock E-Commerce (`BMC_STOCK_SHEET_ID`)

**Title:** Stock E-Commerce Dashboard
**ID:** `1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw`

| Tab | Rows | Cols | Key Headers | API Route |
|-----|------|------|-------------|-----------|
| **EXISTENCIAS_Y_PEDIDOS** | 1097 | 65 | Cargado Shopify, Etiquetas, Codigo, Producto, Costo m2 U$S+IVA, Margen%, Ganancia, Venta+IVA, Consumidor Final, DEPO OFI, Exterior, DEPO GRANDE, Stock, SHOPIFY_SYNC_AT | `GET /api/stock-ecommerce` · `GET /api/stock-kpi` |
| **Orden y Inventario 06-09-2025** | 1154 | 60 | Stock Avería, Costo, Venta, Ganancia, Pedidos | _(historical snapshot)_ |
| **POSICION FISICA** | 913 | 44 | _(warehouse layout)_ | _(reference)_ |
| **Conteo 11082025** | 1000 | 26 | Posición, Producto, Cantidad | _(physical count)_ |
| **Egresos** | 1000 | 27 | Fecha, Cliente, Articulo, Unidades, Precio, Entrega | _(outbound log)_ |
| _+2 más_ | — | — | POSICION FISICA ORDEN ORIGINAL, Copy of Sheet1 | _(archive)_ |

---

## 5. Calendario Vencimientos (`BMC_CALENDARIO_SHEET_ID`)

**Title:** CALENDARIO DE VENCIMIENTOS Dashboard
**ID:** `1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk`

| Tab | Rows | Cols | Key Headers | API Route |
|-----|------|------|-------------|-----------|
| **GASTOS** | 1000 | 26 | CONCEPTO, IMPORTE $, NO PAGO, IMPORTE U$S | _(summary)_ |
| **MARZO 2026** | 999 | 27 | CONCEPTO, REFERENCIA, FECHA VENCIMIENTO, IMPORTE $, IMPORTE U$S, ESTADO, FECHA PAGO, alertas | `GET /api/calendario-vencimientos` |
| **FEBRERO 2026** | 1000 | 27 | _(same schema)_ | `GET /api/calendario-vencimientos?month=2026-02` |
| **ENERO 2026** | 1000 | 27 | _(same)_ | `GET /api/calendario-vencimientos?month=2026-01` |
| _+18 tabs más_ | — | — | Monthly tabs from OCT 2024 → DIC 2025 (same schema) + Sura DFSK (cuotas), CONVENIOS Y PATENTES 2025 | month filter |

---

## 6. MATRIZ Costos y Ventas 2026 (`BMC_MATRIZ_SHEET_ID`) — FIXED

**Title:** MATRIZ de COSTOS y VENTAS 2026
**ID:** `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo` (native Google Sheets — was xlsx, converted)

| Tab | Supplier/Category |
|-----|-------------------|
| **BROMYROS** | Selladores, químicos |
| **R y C Tornillos** | Fijaciones, tornillería |
| **BECAM** | Paneles ISOROOF, ISODEC, ISOWALL |
| **HM RUBBER** | Rubber products |
| **MONTFRIO** | Cámaras frigoríficas |
| **Importaciones** | Imported items |
| **CHALAR** | Perfilería |
| **ECOPANELS** | EPS panels |
| **SECO CENTER** | Tools/hardware |
| **ARMCO** | Steel products |
| **POLIGLAS** | Policarbonatos |
| **Contenedores** | Containers |
| **HOMEKIT** | Kits |
| **ALAMBRESA** | Wire/mesh |
| **PRODECO** | Products |
| **Barraca Parna** | Hardware |
| **Obra Color y Roberto Tófalo** | Paint/finishing |

**Schema (tab BROMYROS — representative):** col D = SKU, col F = Costo+IVA, col L = Venta+IVA, col M = E-Commerce
**API Route:** `GET /api/actualizar-precios-calculadora` → CSV with 60+ mapped SKUs

---

## Cross-Reference: API Route → Sheet → Dashboard Section

| API Route | Method | Workbook | Tab(s) | Dashboard Section |
|-----------|--------|----------|--------|-------------------|
| `/api/cotizaciones` | GET/POST | CRM | CRM_Operativo | Cotizaciones |
| `/api/proximas-entregas` | GET | CRM | CRM_Operativo | Operaciones |
| `/api/coordinacion-logistica` | GET | CRM | CRM_Operativo | Operaciones |
| `/api/marcar-entregado` | POST | Ventas | Ventas Realizadas | Operaciones |
| `/api/pagos-pendientes` | GET/POST | Pagos | Pendientes_ | Finanzas |
| `/api/kpi-financiero` | GET | Pagos + Ventas | Pendientes_+ Metas_Ventas | Inicio (KPI) |
| `/api/ventas` | GET | Ventas | all 23 tabs | Ventas |
| `/api/stock-ecommerce` | GET | Stock | EXISTENCIAS_Y_PEDIDOS | Operaciones |
| `/api/stock-kpi` | GET | Stock | EXISTENCIAS_Y_PEDIDOS | Inicio (KPI) |
| `/api/calendario-vencimientos` | GET | Calendario | Monthly tabs | Finanzas |
| `/api/actualizar-precios-calculadora` | GET | MATRIZ | BROMYROS (first tab) | Calculadora (PANELSIM) |
| `/api/kpi-report` | GET | Pagos+Stock+Ventas | aggregated | Inicio |

---

## Stats Summary

| Workbook | Tabs | Active Tabs (API) | Total Rows |
|----------|------|-------------------|------------|
| CRM / Cotizaciones | 6 | 2 (CRM_Operativo, Ventas_Consolidado) | ~6K |
| Pagos Pendientes | 3 | 1 (Pendientes_) | ~4.8K |
| Ventas 2.0 | 23 | ~8 active | ~15K |
| Stock E-Commerce | 7 | 1 (EXISTENCIAS_Y_PEDIDOS) | ~7.2K |
| Calendario | 22 | 22 (monthly tabs) | ~22K |
| MATRIZ | 17 | 1 (BROMYROS — first tab for SKU mapping) | ~500 |
| **Total** | **78 tabs** | **~35 active** | **~55K rows** |
