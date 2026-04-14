# Restricciones de negocio — Dashboard BMC

**Propósito:** Documentar qué acciones el usuario puede hacer, qué no, y por qué. Evita que Design proponga UX que viole reglas de negocio.

**Mantenimiento:** Actualizar cuando cambien reglas operativas.

---

## Reglas generales

| Regla | Descripción | Motivo |
|-------|-------------|--------|
| No editar pagos cerrados | Una vez marcado como Cobrado, no modificar monto ni fecha | Integridad contable |
| No borrar filas de AUDIT_LOG | Es registro histórico; solo append | Trazabilidad |
| No editar ventas entregadas sin flujo | Marcar entregado debe usar el flujo oficial (diálogo o botón) | Consistencia con Sheets |

---

## Por sección

### Finanzas / Pagos

| Acción | Permitida | Notas |
|--------|-----------|-------|
| Ver pagos pendientes | Sí | Filtro por moneda, período |
| Marcar como Cobrado | Sí | Actualiza ESTADO, FECHA_COBRO |
| Editar monto de pago pendiente | Sí (antes de cobrar) | — |
| Editar pago ya cobrado | No | — |

### Operaciones / Entregas

| Acción | Permitida | Notas |
|--------|-----------|-------|
| Ver próximas entregas | Sí | — |
| Marcar entregado | Sí | Via diálogo o botón; mueve a Ventas realizadas |
| Editar fecha de entrega | Sí (antes de entregar) | — |

### Ventas

| Acción | Permitida | Notas |
|--------|-----------|-------|
| Ver ventas por proveedor | Sí | Filtro, tabla |
| Editar venta | Depende del estado | Ver flujo de estados |
| Export CSV | Sí | — |

### Cotizaciones / Calculadora

| Acción | Permitida | Notas |
|--------|-----------|-------|
| Crear cotización | Sí | Via 5173 |
| Enviar a Master | Sí | PUSH |
| Editar cotización existente | Sí (antes de confirmar) | — |

---

## Referencias

- DASHBOARD-INTERFACE-MAP — qué sección consume qué
- planilla-inventory — estados y columnas por tab
