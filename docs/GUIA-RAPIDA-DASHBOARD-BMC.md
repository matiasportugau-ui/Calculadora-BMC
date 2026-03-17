# Guía rápida — Dashboard BMC Finanzas & Operaciones

**Para:** Vendedores y administradivos de BMC  
**Última actualización:** 2026-03-16

---

## Acceso

| URL | Descripción |
|-----|-------------|
| **Local** | http://localhost:3001/finanzas |
| **Producción** | *(URL fija cuando esté desplegado)* |
| **Compartido (ngrok)** | URL temporal que te comparta el equipo técnico |

---

## Secciones principales

### 1. Resumen financiero (Overview)

- **KPIs:** Total pendiente, Esta semana, Próxima semana, Este mes.
- **Selector de moneda:** Cambiar entre $, UES, etc.
- **Fuente:** Pagos pendientes de la hoja.

### 2. Vencimientos próximos (Trend)

- Gráfico de barras con hasta 8 fechas en orden cronológico.
- Filtrado por la moneda seleccionada.

### 3. Pagos pendientes (Breakdown)

- Tabla con Cliente, Pedido, Monto, Vencimiento, Estado.
- **Filtros:** "Esta semana" (default), "Vencidos", "Todos".
- Orden por fecha de vencimiento.

### 4. Entregas y logística (#operaciones)

- **Próximas entregas:** Lista de entregas de la semana.
- **Copiar WhatsApp:** Genera mensaje completo para coordinación.
- **WhatsApp (por fila):** Copia mensaje individual.
- **Marcar entregado:** Actualiza la hoja tras la entrega (pide comentarios opcionales).

### 5. Metas de ventas

- Objetivos por período.

### 6. Audit log

- Registro de cambios.
- **Exportar CSV:** Descarga el log completo.

---

## Acciones frecuentes

| Acción | Pasos |
|--------|-------|
| **Ver pagos esta semana** | Breakdown → filtro "Esta semana" |
| **Ver pagos vencidos** | Breakdown → filtro "Vencidos" |
| **Copiar mensaje WhatsApp** | Entregas → "Copiar WhatsApp" o "WhatsApp" por fila |
| **Marcar entrega completada** | Entregas → "Marcar entregado" → (opcional) comentarios → OK |
| **Actualizar datos** | Botón "Actualizar" (arriba a la derecha) |

---

## Feedback visual

- **Loading:** Skeleton/spinner mientras cargan los datos.
- **Toast:** Mensaje verde tras "Marcar entregado" o "Copiar WhatsApp".
- **Error:** Toast rojo si algo falla.

---

## Soporte

- Si los datos no cargan: verificar que el equipo técnico tenga configurado el workbook y las credenciales.
- Para problemas técnicos: contactar al administrador del sistema.

---

**Referencias:** [GO-LIVE-DASHBOARD-CHECKLIST.md](bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md), [REPORT-STATUS-USER-REVIEW.md](REPORT-STATUS-USER-REVIEW.md)
