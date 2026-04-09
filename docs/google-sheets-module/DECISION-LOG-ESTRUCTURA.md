# Decision Log — Cambios estructurales en planillas

**Propósito:** Registrar por qué se añadió cada tab/columna. Ayuda a Mapping y Sheets Structure a entender el "por qué" y evitar mapeos incorrectos.

**Mantenimiento:** Actualizar cuando Matias o el equipo añadan tabs o columnas nuevas.

---

## Formato de entrada

| Fecha | Tab/Columna | Razón | Afecta a |
|-------|-------------|-------|----------|
| YYYY-MM-DD | Nombre | Por qué se creó | Mapping, Design, etc. |

---

## Historial

| Fecha | Tab/Columna | Razón | Afecta a |
|-------|-------------|-------|----------|
| — | Master_Cotizaciones | Tab principal de cotizaciones; fuente para entregas, ventas | Mapping, Design, Operaciones |
| — | Pagos_Pendientes | Cobros pendientes; integración con Pagos Pendientes 2026 | Mapping, Billing |
| — | AUDIT_LOG | Registro de cambios PUSH (append) | Mapping, Audit |
| — | Metas_Ventas | Metas por período; KPIs | Mapping, Design |
| — | Ventas realizadas y entregadas | Destino de marcar-entregado | Mapping, Operaciones |
| — | CONTACTOS | (Pendiente crear) Para alertarPagosVencidos; email digest | Mapping, Sheets Structure |
| — | Ventas_Consolidado | (Pendiente crear) Consolidar ventas por proveedor | Mapping, Sheets Structure |
| — | SHOPIFY_SYNC_AT | (Pendiente crear) Timestamp sync Shopify | Mapping, Integrations |
| — | PAGADO | (Pendiente crear) Estado de pago | Mapping, Billing |

---

## Referencias

- planilla-inventory.md — estructura actual
- AUTOMATIONS-BY-WORKBOOK.md — triggers y scripts por tab
