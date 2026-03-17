# BMC Dashboard — Propuesta UX/UI Time-Saving

**Propósito:** Propuesta de diseño centrada en ahorro de tiempo (menos clics, escaneo rápido, acciones claras). Fuente: DASHBOARD-FRONT-VISION, DASHBOARD-INTERFACE-MAP, bmc-dashboard-design-best-practices.

---

## 1. Resumen de investigación (best practices)

| Patrón | Uso en BMC | Ahorro de tiempo |
|--------|------------|------------------|
| **Table + row actions** | Entregas, pagos pendientes | Actuar por fila sin abrir detalle |
| **KPI strip above list** | Resumen financiero | Ver totales sin scroll |
| **Filters + default view** | Muchas filas | Reducir ruido; "esta semana" por defecto |
| **Modal / side panel for edit** | Edición fecha, estado, notas | Editar in-place, sin navegación |
| **Sticky header + fixed actions** | Tablas largas | Acciones siempre visibles |
| **One-click primary action** | Marcar entregado, Copiar WhatsApp | Un clic + confirm si destructivo |

---

## 2. Revisión contra necesidades BMC

| Sección | Necesidad | Fit actual | Propuesta |
|---------|-----------|------------|-----------|
| **Resumen financiero** | KPIs por moneda, trend, breakdown | KPI cards + selector moneda | Mantener; añadir loading skeleton |
| **Entregas** | Ver entregas, Copiar WhatsApp, Marcar entregado | Tabla + botones por fila | OK; asegurar botones siempre visibles (sticky o inline) |
| **Pagos pendientes** | Tabla filtrada, orden por vencimiento | Tabla | Añadir filtro rápido "Esta semana" / "Vencidos" |
| **Metas** | Referencia rápida mes | Tabla | Mantener; compactar si muchas filas |
| **Audit** | Filtrar, exportar CSV | Input + botón | Mantener; feedback al exportar |
| **Ventas 2.0** | Pipeline, Costeo, Administrar Venta | Placeholder | Implementar según DASHBOARD-FRONT-VISION §4 |

---

## 3. Propuesta concreta (opciones A/B)

### Opción A — Mejoras incrementales (bajo esfuerzo)

1. **Loading states:** Skeleton o spinner en cada bloque mientras fetch; mensaje "Reintentar" si 503.
2. **Filtro rápido en Breakdown:** Botones "Esta semana" | "Vencidos" | "Todos" encima de la tabla.
3. **Sticky header en tablas largas:** Headers fijos al scroll para Entregas y Breakdown.
4. **Feedback en acciones:** Toast o mensaje breve tras "Marcar entregado" o "Copiar WhatsApp".

**Ahorro estimado:** 2–3 clics menos por sesión; menos confusión al actuar.

### Opción B — Rediseño moderado (medio esfuerzo)

Todo lo de A, más:

1. **Vista por defecto "Esta semana":** Breakdown y Entregas filtrados por defecto; toggle para ver todo.
2. **Acciones por fila agrupadas:** Dropdown "⋮" por fila con Marcar entregado, Copiar WhatsApp, Ver detalle.
3. **Modal para edición rápida:** Al hacer clic en fecha/estado de una fila, modal para editar y guardar (requiere PATCH en API).
4. **KPI cards compactas:** Misma info en menos espacio; más espacio para tablas.

**Ahorro estimado:** 5–7 clics menos; flujo más guiado.

---

## 4. Recomendación

- **Corto plazo:** Ejecutar **Opción A** (incremental, bajo riesgo).
- **Medio plazo:** Evaluar **Opción B** cuando Ventas 2.0 esté en marcha y el equipo priorice UX.

---

## 5. Checklist de implementación (Opción A)

- [x] Añadir loading skeleton/spinner en bloques que consumen /api/*
- [x] Mensaje "Reintentar" + botón cuando API retorna 503
- [x] Filtros rápidos "Esta semana" | "Vencidos" | "Todos" en Breakdown
- [x] Sticky header en tablas Entregas y Breakdown (CSS position: sticky)
- [x] Toast o mensaje de éxito tras Marcar entregado y Copiar WhatsApp

---

**Última actualización:** 2025-03-15  
**Handoff:** Usar con REPORT-SOLUTION-CODING e IMPLEMENTATION-PLAN para asignar a Solution/Coding.
