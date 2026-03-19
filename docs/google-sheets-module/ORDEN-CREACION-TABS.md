# Orden de creación de tabs

**Propósito:** Documentar dependencias entre tabs. Crear en el orden correcto para evitar errores.

**Referencias:** AUTOMATIONS-BY-WORKBOOK.md, planilla-inventory.md.

---

## Workbook principal (BMC crm_automatizado)

| Orden | Tab | Depende de | Notas |
|-------|-----|------------|-------|
| 1 | Master_Cotizaciones | — | Base |
| 2 | Pagos_Pendientes | — | O en workbook separado |
| 3 | AUDIT_LOG | — | Append-only |
| 4 | Metas_Ventas | — | KPIs |
| 5 | Ventas realizadas y entregadas | Master_Cotizaciones | Destino de marcar-entregado |

---

## Pagos Pendientes 2026

| Orden | Tab | Depende de | Notas |
|-------|-----|------------|-------|
| 1 | (hoja principal) | — | Pagos pendientes |
| 2 | CONTACTOS | — | Para alertarPagosVencidos (email digest) |

---

## 2.0 - Ventas

| Orden | Tab | Depende de | Notas |
|-------|-----|------------|-------|
| 1 | Tabs por proveedor | — | Fuente de datos |
| 2 | Ventas_Consolidado | Tabs proveedor | Destino de consolidarVentasDiario |

---

## Stock E-Commerce

| Orden | Tab | Depende de | Notas |
|-------|-----|------------|-------|
| 1 | (hoja principal) | — | Stock |
| 2 | SHOPIFY_SYNC_AT | (columna) | Añadir al final |

---

## Calendario de vencimientos

| Orden | Tab | Depende de | Notas |
|-------|-----|------------|-------|
| 1 | MARZO 2026, etc. | — | Una tab por mes |
| 2 | PAGADO (columna) | — | Añadir a cada tab mensual |

---

## Resumen

1. **Workbook 1:** Master → Pagos → AUDIT → Metas → Ventas realizadas
2. **Pagos 2026:** Principal → CONTACTOS
3. **Ventas:** Tabs proveedor → Ventas_Consolidado
4. **Stock:** Principal + columna SHOPIFY_SYNC_AT
5. **Calendario:** Tabs mensuales + columna PAGADO
