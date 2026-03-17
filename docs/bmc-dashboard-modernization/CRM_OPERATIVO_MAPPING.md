# CRM_Operativo → BMC Dashboard — Mapeo de columnas

## Estructura CRM_Operativo (Bnesser)

| Fila | Contenido |
|------|-----------|
| 1 | Título: "CRM Operativo Bnesser Uruguay" |
| 2 | Vacía |
| 3 | Headers |
| 4+ | Datos |

## Mapeo de columnas

| CRM_Operativo | BMC Dashboard (normalizado) | Notas |
|---------------|----------------------------|-------|
| ID | COTIZACION_ID | Identificador único |
| Fecha | FECHA_CREACION | Fecha de alta |
| Cliente | CLIENTE_NOMBRE | Nombre del cliente |
| Teléfono | TELEFONO | Contacto |
| Ubicación / Dirección | DIRECCION | Dirección o zona |
| Origen | ORIGEN | WA, LL, etc. |
| Consulta / Pedido | NOTAS | Detalle del pedido |
| Estado | ESTADO | Pendiente, Descartado, Abierto, etc. |
| Responsable | ASIGNADO_A | TIN, RA, etc. |
| Fecha próxima acción | FECHA_ENTREGA | Fecha de seguimiento |
| Monto estimado USD | MONTO_ESTIMADO | En USD |
| Observaciones | COMENTARIOS_ENTREGA | Notas adicionales |
| Cierre / Estado final | — | Abierto, Descartado, etc. |

## Estados CRM vs BMC

| CRM_Operativo | Equivalente BMC |
|---------------|-----------------|
| Pendiente | Pendiente |
| Descartado | Rechazado |
| Abierto | Enviado / Pendiente |
| (otros) | Mapeo flexible |

## Proximas entregas (lógica adaptada)

Para CRM_Operativo, "próximas entregas" = filas con:
- **Estado** ∈ { Pendiente, Abierto } (activas)
- **Fecha próxima acción** en la semana actual

## Configuración

En `.env`:

```env
BMC_SHEET_SCHEMA=CRM_Operativo
```

Si no se define, se usa `Master_Cotizaciones` (schema BMC original).
