# Guía rápida — Dashboard BMC para vendedores

**Para:** Vendedores y usuarios finales del dashboard BMC  
**Última actualización:** 2026-03-18  
**Referencia:** IMPLEMENTATION-PLAN-POST-GO-LIVE §C1

---

## Acceso al dashboard

| Dónde | URL / Cómo |
|-------|------------|
| **Producción** | La URL fija te la entrega el equipo técnico una vez desplegado el dashboard. |
| **Pruebas (local)** | http://localhost:3001/finanzas — solo si estás en la red del equipo. |
| **Compartido** | Si te comparten un enlace temporal (ngrok), úsalo tal cual; caduca al cerrar la sesión del técnico. |

No necesitas instalar nada: entras desde el navegador (Chrome o similar recomendado).

---

## Sección Inicio — KPI Report

En **Inicio** verás un resumen ejecutivo en tarjetas:

- **Total pendiente** — Monto total por cobrar.
- **Esta semana** / **Próxima semana** — Pagos que vencen en ese período.
- **Entregas esta semana** — Cantidad de entregas programadas.
- **Bajo stock** — Alertas de stock (si aplica).
- **Objetivo mensual** vs **Real acumulado** — Metas de ventas.
- **Equilibrio** — Meta vs real (indicador visual).

**Qué hacer:** Revisar en un vistazo el estado del día. Si algo no cuadra, avisar al administrador.

---

## Sección Operaciones — Cotizaciones y entregas

- **Próximas entregas:** Lista de entregas de la semana con cliente, pedido y fecha.
- **Copiar WhatsApp:** Botón para copiar un mensaje listo para enviar por WhatsApp (coordinación con cliente o logística).
- **WhatsApp (por fila):** En cada fila puedes copiar el mensaje solo de esa entrega.
- **Marcar entregado:** Cuando la entrega se hizo, clic en "Marcar entregado". Puedes agregar un comentario opcional. El sistema actualiza la planilla.

**Qué hacer:** Usar "Copiar WhatsApp" para avisar; al terminar la entrega, marcar entregado para que Finanzas y el resto vean el dato actualizado.

---

## Sección Finanzas — Pagos y metas

- **Resumen financiero:** Total pendiente, Esta semana, Próxima semana, Este mes. Selector de moneda ($, UES, etc.).
- **Pagos pendientes (Breakdown):** Tabla con Cliente, Pedido, Monto, Vencimiento, Estado. Filtros: "Esta semana", "Vencidos", "Todos".
- **Metas de ventas:** Objetivos por período y avance.

**Qué hacer:** Revisar pagos "Esta semana" y "Vencidos"; coordinar cobros. Consultar metas para saber cómo va el mes.

---

## Sección Ventas

- **Tabla de ventas** con filtro por **proveedor**.
- **Exportar CSV:** Para llevar los datos a Excel o reportes.

**Qué hacer:** Filtrar por tu proveedor o canal; exportar si necesitas un listado para reuniones o seguimiento.

---

## Acciones frecuentes

| Quiero… | Pasos |
|---------|--------|
| Ver pagos que vencen esta semana | Finanzas → Breakdown → filtro "Esta semana" |
| Ver pagos vencidos | Finanzas → Breakdown → filtro "Vencidos" |
| Copiar mensaje para WhatsApp (todas las entregas) | Operaciones → "Copiar WhatsApp" |
| Copiar mensaje de una sola entrega | Operaciones → en la fila → "WhatsApp" |
| Marcar que ya entregué | Operaciones → "Marcar entregado" → (opcional) comentario → Aceptar |
| Ver ventas por proveedor | Ventas → elegir proveedor en el filtro |
| Descargar ventas en Excel | Ventas → "Exportar CSV" |
| Actualizar los datos en pantalla | Botón "Actualizar" (arriba a la derecha) |

---

## Si la tabla muestra "sin datos" o no carga

1. **Actualizar:** Clic en "Actualizar" y esperar unos segundos.
2. **Horario y permisos:** El dashboard toma datos de las planillas; si no ves nada, puede ser que tu usuario aún no tenga acceso o que la planilla esté en mantenimiento. Contactar al administrador.
3. **Error en pantalla:** Si sale un mensaje rojo de error, anotar el texto y enviarlo al equipo técnico.

---

## Resumen

- **Inicio:** KPIs y equilibrio meta/real.
- **Operaciones:** Entregas, WhatsApp y marcar entregado.
- **Finanzas:** Pagos pendientes y metas.
- **Ventas:** Filtro por proveedor y exportar CSV.

Para dudas de acceso, permisos o fallos: contactar al administrador del sistema o al equipo técnico BMC.
