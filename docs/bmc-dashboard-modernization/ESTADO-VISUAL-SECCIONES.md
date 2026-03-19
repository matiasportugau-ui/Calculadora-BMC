# Estado visual por sección — Dashboard

**Propósito:** Descripción de cada sección cuando no hay screenshots. Ayuda a Design a evaluar mejoras sin levantar el servidor.

---

## Inicio (#inicio)

- Bloque KPI: totalPendiente, estaSemana, entregasEstaSemana, bajoStock, equilibrio
- Fuente: /api/kpi-report
- Elementos: cards con números, posible loading state

---

## Finanzas (#finanzas)

- Resumen financiero, Trend, Breakdown, Calendario
- Fuente: /api/kpi-financiero, /api/calendario-vencimientos
- Elementos: gráficos, tabla calendario, lista pagos pendientes

---

## Operaciones (#operaciones)

- Próximas entregas, coordinación logística
- Fuente: /api/proximas-entregas, /api/coordinacion-logistica
- Elementos: tabla entregas, botón marcar entregado, texto WhatsApp

---

## Ventas 2.0

- Tabla por proveedor, filtro
- Fuente: /api/ventas
- Elementos: dropdown proveedor, tabla, export CSV

---

## Stock E-Commerce

- KPIs, tabla, export
- Fuente: /api/stock-ecommerce, /api/stock-kpi
- Elementos: cards KPI, tabla, botón export

---

## Invoque

- Placeholder
- Fuente: —
- Elementos: por definir

---

## Referencias

- DASHBOARD-INTERFACE-MAP.md
- IA.md
