# Plantilla de validación por columna

**Propósito:** Lista de columnas con tipo de validación (dropdown, número, fecha) y valores permitidos. Sin ambigüedad al configurar.

**Uso:** Al crear o modificar tabs, usar esta plantilla para definir validaciones.

---

## Tipos de validación

| Tipo | Descripción | Ejemplo valores |
|------|-------------|----------------|
| **Dropdown** | Lista de opciones | Pendiente, Cobrado, Entregado |
| **Número** | Solo números | — |
| **Fecha** | Formato fecha | YYYY-MM-DD |
| **Texto** | Libre | — |
| **Checkbox** | Sí/No | — |

---

## Por tab (referencia)

### Master_Cotizaciones / CRM_Operativo
| Columna | Tipo | Valores / Notas |
|---------|------|-----------------|
| ESTADO | Dropdown | Cotizado, Confirmado, Entregado, Cancelado |
| MONEDA | Dropdown | $, UES, etc. |

### Pagos_Pendientes
| Columna | Tipo | Valores / Notas |
|---------|------|-----------------|
| ESTADO | Dropdown | Pendiente, Cobrado |
| MONEDA | Dropdown | $, UES |

### Ventas_Consolidado
| Columna | Tipo | Valores / Notas |
|---------|------|-----------------|
| FACTURADO | Dropdown | Sí, No |

### Calendario (tabs mensuales)
| Columna | Tipo | Valores / Notas |
|---------|------|-----------------|
| PAGADO | Dropdown | Sí, (vacío) |

---

## Referencias

- planilla-inventory.md — estructura actual
- AUTOMATIONS-BY-WORKBOOK.md — checklists por workbook
