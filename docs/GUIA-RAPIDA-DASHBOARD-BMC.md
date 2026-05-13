# Guía rápida — Dashboard BMC Finanzas & Operaciones

**Para:** Vendedores y administradivos de BMC
**Última actualización:** 2026-05-13

---

## Acceso

| URL | Descripción |
|-----|-------------|
| **Producción (operativa diaria)** | https://calculadora-bmc.vercel.app/finanzas |
| **Local (desarrollo)** | http://localhost:3001/finanzas (sólo con `npm run dev:full` corriendo) |

> El frontend se sirve desde Vercel; la API (datos en vivo) vive en Cloud Run (`panelin-calc`). No hace falta VPN ni Apps Script abierto para usar la URL de producción.

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

## Para administradivos (Admin / Operaciones / Finanzas)

Esta sección extiende lo anterior con las tareas que son exclusivas de admin. Si sólo cargás cotizaciones, podés ignorarla.

### Auditoría — leer AUDIT_LOG

- **Para qué:** saber **quién** marcó una entrega, **cuándo** se cambió el saldo de un pago, **qué** se editó en CRM_Operativo. Cada acción del dashboard (marcar entregado, push de pagos, edits desde Apps Script) deja una fila en el tab `AUDIT_LOG`.
- **Dónde:** sección "Audit log" del dashboard → botón **"Exportar CSV"** descarga el log completo del rango visible.
- **Qué buscar:**
  - Columna `action` — qué se hizo (`mark_delivered`, `update_payment_status`, …).
  - Columna `user` — qué cuenta lo hizo (suele ser el correo de Google del usuario, o `service_account` cuando proviene de la API).
  - Columna `target_row` — fila exacta en la planilla afectada.
  - Columna `before` / `after` — valores antes y después del cambio (útil para reverts).
- **Atajo:** si dudás qué se cambió hoy, abrí el dashboard, filtrá la columna `timestamp` por hoy, exportá CSV.

### Interpretar el KPI Report (#inicio)

- **KPIs principales:**
  - **Total pendiente** = suma actual de pagos sin cobrar de la planilla `Pagos_Pendientes`.
  - **Esta semana** = lo que vence entre lunes y domingo de la semana en curso. Si está rojo, hay vencimientos sin cobrar.
  - **Próxima semana** = mismo rango +7 días. Es el horizonte de planificación.
  - **Este mes** = mes calendario en curso (cierre el día 30/31).
- **Selector de moneda:** los KPIs se refiltran por la moneda elegida. Si tu planilla tiene mezcla (USD + UYU), elegí una a la vez para evitar sumas inconsistentes.
- **Trend (gráfico de barras):** 8 fechas máximas con monto agregado por fecha. Las barras rojas indican vencimientos pasados sin cobrar; las barras grises son a futuro.
- **Tip:** si el total no cuadra con lo que ves en la planilla, refrescá con el botón **"Actualizar"** (arriba a la derecha) — el dashboard cachea la respuesta durante 60 s para reducir cuota de Google Sheets.

### Escalar una entrega fallida

1. En sección **"Entregas y logística"**, identificá la fila problema (entrega no llegó, dirección equivocada, cliente reclama).
2. Tocá **"WhatsApp"** en esa fila → te abre el mensaje pre-armado con cliente, dirección y pedido.
3. Coordiná directamente con el transportista por WhatsApp (Cloud API mira `/hub/wa` para historial unificado).
4. Una vez resuelto, **NO** uses "Marcar entregado" si la entrega volvió a logística — abrí `CRM_Operativo` y actualizá manualmente la columna `Estado` a "Reprogramada" o "Cancelada" con observación.
5. Si la entrega se concretó después: usá **"Marcar entregado"** normal → el dashboard escribe la fecha real y el comentario opcional en AUDIT_LOG.

### Triggers Apps Script (cuándo se ejecutan)

| Trigger | Workbook | Hora | Qué hace |
|---|---|---|---|
| `alertarPagosVencidos` | Pagos Pendientes 2026 | 8:00 AM diario | Notifica vencimientos por email a CONTACTOS |
| `consolidarVentasDiario` | 2.0 - Ventas | 7:00 AM diario | Pasa Ventas_Diarias a Ventas_Consolidado |
| `alertarVentasSinFacturar` | 2.0 - Ventas | Lunes 9:00 AM | Reporte semanal de ventas pendientes de factura |
| `alertarBajoStock` | Stock E-Commerce | 8:30 AM diario | Avisa SKUs bajo umbral |
| `sendWeeklyAlarmDigest` | BMC crm_automatizado | Lunes 9:00 AM | Resumen consolidado de alarmas activas |

> Si una alerta dejó de llegar al inbox, verificá en Apps Script editor del workbook correspondiente: **Triggers** → la fila debería estar activa. Si la última ejecución tiene error, click → ver detalle → reintentar manualmente.

### Cuando algo se rompe

- Toast rojo persistente → recargar la página (Ctrl+R). Si persiste, hay un 503 desde la API; avisar al equipo técnico.
- Los KPIs muestran "—" → la API devolvió 503 (Sheets no disponible). Esperar 1 min y refrescar; si sigue, es un problema de credenciales o cuota.
- "Marcar entregado" no actualiza el sheet → revisar AUDIT_LOG para ver si la escritura quedó registrada. Si no aparece nada, hay un fallo silencioso en la API.

---

**Referencias:** [GO-LIVE-DASHBOARD-CHECKLIST.md](bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md), [REPORT-STATUS-USER-REVIEW.md](REPORT-STATUS-USER-REVIEW.md), [AUTOMATIONS-BY-WORKBOOK.md](google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md)
