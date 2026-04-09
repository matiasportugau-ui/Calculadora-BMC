# Reglas de negocio — Facturación

**Propósito:** Qué constituye duplicado, tolerancia de redondeo, estados de pago válidos. Reduce falsos positivos en la revisión de Billing.

---

## Duplicados

| Regla | Descripción |
|-------|-------------|
| Mismo documento | Mismo tipo (factura/NC) + mismo número = duplicado |
| Mismo pago | Mismo COTIZACION_ID + mismo MONTO + misma fecha = posible duplicado |

---

## Tolerancia de redondeo

| Regla | Valor |
|-------|-------|
| Redondeo permitido | ±0.01 por operación |
| Acumulado mensual | Documentar si supera umbral |

---

## Estados de pago

| Estado | Válido | Descripción |
|--------|--------|-------------|
| Pendiente | Sí | Por cobrar |
| Cobrado | Sí | Cobrado; FECHA_COBRO registrada |
| (otros) | Según planilla | Ver planilla-inventory |

---

## Referencias

- billing-error-review skill
- planilla-inventory Pagos_Pendientes
