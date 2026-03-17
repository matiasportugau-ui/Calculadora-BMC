# Dashboard Interface Map

**Propósito:** Mapeo sección → bloques UI → fuente de datos (API, sheet). Ubicación por página, funcionalidad y uso en localhost.

**Referencias:** [IA.md](./IA.md), [DASHBOARD-VISUAL-MAP.md](./DASHBOARD-VISUAL-MAP.md), [MAPA-VISUAL-ESTRUCTURA-POR-ESTACION.md](./MAPA-VISUAL-ESTRUCTURA-POR-ESTACION.md).

---

## 1. Ubicación por página y puerto

| Página | URL | Puerto | Comando |
|--------|-----|--------|---------|
| **Dashboard Finanzas/Operaciones** | /finanzas (3001) o / (3849) | 3001, 3849 | npm run start:api, npm run bmc-dashboard |
| **Calculadora** | http://localhost:5173 | 5173 | npm run dev |
| **Inicio** | # (mismo documento) | 3001, 3849 | — |
| **Operaciones** | #operaciones | 3001, 3849 | — |
| **Finanzas** | #finanzas | 3001, 3849 | — |
| **Ventas** | #ventas | 3001, 3849 | — |
| **Invoque Panelin** | #invoque | 3001, 3849 | — |

---

## 2. Secciones y bloques UI

### 2.0 KPI Report — Inicio (#inicio)

| Elemento | Tipo | Fuente API | Fuente Sheet |
|----------|------|------------|--------------|
| KPI Total pendiente | card | GET /api/kpi-report | Pagos_Pendientes |
| KPI Esta semana | card | idem | idem |
| KPI Entregas esta semana | card | idem | CRM_Operativo / Master |
| KPI Bajo stock | card | idem | Stock E-Commerce |
| Card equilibrio | card | idem | Metas_Ventas, 2.0 - Ventas |

**Funcionalidad:** Vista ejecutiva unificada; meta vs real; estado de equilibrio.

### 2.1 Resumen financiero (Overview)

| Elemento | Tipo | Fuente API | Fuente Sheet |
|----------|------|------------|--------------|
| Selector moneda | select | GET /api/kpi-financiero | Pagos_Pendientes (byCurrency) |
| KPI Total pendiente | card | idem | byCurrency[moneda].total |
| KPI Esta semana | card | idem | byCurrency[moneda].estaSemana |
| KPI Próxima semana | card | idem | byCurrency[moneda].proximaSemana |
| KPI Este mes | card | idem | byCurrency[moneda].esteMes |

**Funcionalidad:** Ver KPIs por moneda; cambiar moneda actualiza trend y breakdown.

### 2.2 Vencimientos próximos (Trend)

| Elemento | Tipo | Fuente API | Fuente Sheet |
|----------|------|------------|--------------|
| Gráfico SVG | chart | GET /api/kpi-financiero | calendar (byCurrency por fecha) |
| Placeholder vacío | div | — | — |

**Funcionalidad:** Hasta 8 fechas en orden cronológico; filtrado por moneda seleccionada.

### 2.3 Pagos pendientes (Breakdown)

| Elemento | Tipo | Fuente API | Fuente Sheet |
|----------|------|------------|--------------|
| Tabla | table | GET /api/kpi-financiero | pendingPayments |
| Columnas | Cliente, Pedido, Monto, Vencimiento, Estado | — | — |

**Funcionalidad:** Filtrado por moneda; orden por FECHA_VENCIMIENTO; Estado derivado (Vencido, Esta semana, Próxima semana, Sin fecha).

### 2.4 Calendario de vencimientos

| Elemento | Tipo | Fuente API | Fuente Sheet |
|----------|------|------------|--------------|
| Tabla | table | GET /api/kpi-financiero | calendar |
| Columnas | Dinámicas (fechas, monedas) | — | — |

**Funcionalidad:** Solo lectura; vencimientos por fecha.

### 2.5 Entregas y logística (#operaciones)

| Elemento | Tipo | Fuente API | Fuente Sheet |
|----------|------|------------|--------------|
| Tabla próximas entregas | table | GET /api/proximas-entregas | CRM_Operativo o Master_Cotizaciones |
| Botón Copiar WhatsApp | button | GET /api/coordinacion-logistica | idem |
| Vista previa mensaje | pre | idem | idem |
| Botón Marcar entregado | button | POST /api/marcar-entregado | Master + Ventas realizadas |

**Funcionalidad:** Ver entregas de la semana; copiar mensaje WhatsApp; marcar entregado (solo schema Master).

### 2.6 Metas de ventas

| Elemento | Tipo | Fuente API | Fuente Sheet |
|----------|------|------------|--------------|
| Tabla | table | GET /api/kpi-financiero (metas) | Metas_Ventas |

**Funcionalidad:** Solo lectura; referencia rápida del mes.

### 2.7 Audit log

| Elemento | Tipo | Fuente API | Fuente Sheet |
|----------|------|------------|--------------|
| Filtro texto | input | — | — |
| Botón Exportar CSV | button | — | — |
| Tabla | table | GET /api/audit | AUDIT_LOG |

**Funcionalidad:** Filtrar por acción, usuario, razón; exportar a CSV.

### 2.8 Ventas 2.0 (#ventas)

| Elemento | Tipo | Fuente API | Fuente Sheet |
|----------|------|------------|--------------|
| Selector proveedor | select | — | Filtro client-side |
| Tabla ventas | table | GET /api/ventas | 2.0 - Ventas (BMC_VENTAS_SHEET_ID) |
| Columnas | Cliente, Pedido, Fecha entrega, Costo, Ganancia, Saldo, Facturado | — | — |

**Funcionalidad:** Tabla de ventas por proveedor; filtro por proveedor; columnas clave.

### 2.9 Stock E-Commerce (#stock)

| Elemento | Tipo | Fuente API | Fuente Sheet |
|----------|------|------------|--------------|
| KPI Bajo stock | card | GET /api/stock-kpi | Stock E-Commerce |
| KPI Total productos | card | idem | idem |
| KPI Valor inventario | card | idem | idem |
| Tabla productos | table | GET /api/stock-ecommerce | idem |
| Botón Exportar CSV | button | — | Export client-side |
| Columnas | Código, Producto, Costo, Margen, Stock, Pedido | — | — |

**Funcionalidad:** KPIs de inventario; tabla productos; exportar a CSV.

### 2.10 Invoque Panelin (#invoque)

| Elemento | Tipo | Estado |
|----------|------|--------|
| Placeholder | p | "Próximamente." |

---

## 3. Funcionalidad y uso en localhost

### Puerto 3001 (canónico)

1. `npm run start:api` o `npm run dev:full`
2. Abrir http://localhost:3001 (redirect a /finanzas)
3. **Resumen financiero:** Si hay datos, selector de moneda activo; KPIs actualizados.
4. **Trend:** Gráfico o placeholder según datos.
5. **Breakdown:** Tabla filtrada por moneda.
6. **Entregas:** Tabla + Copiar WhatsApp + Marcar entregado (si schema Master).
7. **Metas, Audit:** Tablas con datos o mensaje vacío.
8. **Actualizar:** Botón refresca todos los datos (Promise.allSettled).
9. **Cotizaciones:** Enlace abre http://localhost:5173 en nueva pestaña.

### Puerto 3849 (standalone)

1. `npm run bmc-dashboard`
2. Abrir http://localhost:3849/
3. Misma UI que 3001; API propia (sheets-api-server.js); schema fijo Master_Cotizaciones.

### Puerto 5173 (Calculadora)

1. `npm run dev`
2. Abrir http://localhost:5173
3. App React: cotizador, Drive, Budget Log, PDF. Sin dashboard nav.

---

## 4. Verificación runtime

| Página/Block | Puerto | Verificado | Notas |
|--------------|--------|------------|-------|
| /finanzas | 3001 | — | Pendiente |
| /finanzas | 3849 | — | Pendiente |
| Cotizaciones | 5173 | — | Pendiente |

---

## 5. Cross-reference (Planilla ↔ Dashboard ↔ API)

| Planilla/Tab | Dashboard section/block | API route | Estado |
|--------------|-------------------------|-----------|--------|
| Pagos_Pendientes | Resumen financiero, Trend, Breakdown | GET /api/kpi-financiero | conditional |
| Metas_Ventas | Metas de ventas | GET /api/kpi-financiero | conditional |
| CRM_Operativo | Entregas y logística | GET /api/proximas-entregas, /api/coordinacion-logistica | live |
| Master_Cotizaciones | Entregas y logística | Idem + POST /api/marcar-entregado | conditional |
| AUDIT_LOG | Audit log | GET /api/audit | conditional |
| 2.0 - Ventas | Ventas 2.0 | GET /api/ventas | conditional (BMC_VENTAS_SHEET_ID) |
| Stock E-Commerce | Stock E-Commerce | GET /api/stock-ecommerce, /api/stock-kpi | conditional (BMC_STOCK_SHEET_ID) |
| — | Invoque Panelin | — | placeholder |

---

**Última actualización:** 2026-03-16
