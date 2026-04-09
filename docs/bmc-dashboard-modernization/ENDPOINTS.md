# Endpoints API — Inventario

**Propósito:** Lista canónica de rutas API. **Convención:** Al crear una ruta nueva, actualizar este archivo y service-map.md.

**Fuente:** server/routes/bmcDashboard.js, server/index.js.

---

## Rutas GET (bmcDashboard)

| Ruta | Fuente | Respuesta |
|------|--------|-----------|
| /api/cotizaciones | CRM_Operativo / Master_Cotizaciones | Array cotizaciones |
| /api/proximas-entregas | Idem | Entregas semana |
| /api/coordinacion-logistica | Idem | Texto WhatsApp |
| /api/kpi-financiero | Pagos_Pendientes, Metas_Ventas | byCurrency, calendar, pendingPayments |
| /api/pagos-pendientes | Pagos_Pendientes | Array pagos |
| /api/metas-ventas | Metas_Ventas | Array metas |
| /api/audit | AUDIT_LOG | Array audit |
| /api/calendario-vencimientos | Calendario | Por mes |
| /api/ventas | 2.0 Ventas | Array ventas |
| /api/ventas/tabs | Idem | Lista tabs |
| /api/stock-ecommerce | Stock | Array stock |
| /api/stock-kpi | Stock | KPIs |
| /api/kpi-report | Agregado | totalPendiente, entregasEstaSemana, etc. |
| /api/stock/history | EXISTENCIAS_Y_PEDIDOS | Historial |

---

## Rutas POST/PATCH (bmcDashboard)

| Ruta | Método | Acción |
|------|--------|--------|
| /api/cotizaciones | POST | Crear cotización |
| /api/cotizaciones/:id | PATCH | Actualizar |
| /api/pagos | POST | Crear pago |
| /api/pagos/:id | PATCH | Actualizar |
| /api/ventas | POST | Crear venta |
| /api/stock/:codigo | PATCH | Actualizar stock |
| /api/marcar-entregado | POST | Mover a Ventas realizadas |

---

## Otras rutas

| Ruta | Módulo |
|------|--------|
| /health | index.js |
| /calc/* | calc.js |
| /api/legacy/* | legacyQuote.js |
| /auth/ml/*, /ml/* | MercadoLibre |
| /auth/shopify/*, /webhooks/shopify | Shopify |

---

**Última actualización:** 2026-03-19
