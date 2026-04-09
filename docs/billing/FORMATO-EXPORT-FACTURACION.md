# Formato estándar — Export facturación

**Propósito:** Especificación de columnas para CSV/XLS de facturas, pagos, notas de crédito. Permite automatizar validaciones.

---

## Facturas

| Columna | Tipo | Requerido |
|---------|------|-----------|
| doc_key / NUM_FACTURA | texto | Sí |
| FECHA | fecha | Sí |
| CLIENTE | texto | Sí |
| MONTO | número | Sí |
| MONEDA | texto | Sí |
| TIPO | texto | Factura / NC |

---

## Pagos

| Columna | Tipo | Requerido |
|---------|------|-----------|
| COTIZACION_ID | texto | Sí |
| MONTO | número | Sí |
| FECHA_COBRO | fecha | Sí |
| ESTADO | texto | Pendiente / Cobrado |

---

## Notas

- Unir facturas y pagos por doc_key o COTIZACION_ID según flujo
- Período: YYYY-MM cuando aplique
- Encoding: UTF-8 para CSV

---

## Referencias

- billing-error-review skill
- planilla-inventory
