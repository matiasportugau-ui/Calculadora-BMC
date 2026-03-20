# Integración: 2.0 Administrador de Cotizaciones → BMC crm_automatizado

**Objetivo:** Integrar todo el contenido de la planilla "2.0 - Administrador de Cotizaciones" en la planilla principal "BMC crm_automatizado" (la que alimenta el dashboard).

---

## 1. Workbooks

| Rol | Nombre | ID | URL |
|-----|--------|-----|-----|
| **Origen (donante)** | 2.0 - Administrador de Cotizaciones | `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` | [Abrir](https://docs.google.com/spreadsheets/d/1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0/edit?usp=sharing) |
| **Destino (desarrollo)** | BMC crm_automatizado | `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg` | [Abrir](https://docs.google.com/spreadsheets/d/1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg/edit?usp=sharing) |

**Requisito:** La service account `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com` debe tener acceso de **lector** al workbook origen y **editor** al destino.

---

## 2. Estructura del origen (2.0 - Administrador de Cotizaciones)

### Tabs observadas

- **Admin.** — Hoja principal de administración (datos de cotizaciones).
- **Copy of Admin.** — Copia de Admin.
- **Enviados** — Registros enviados.
- **Confirmado**
- **Sheet8**, gráficos, etc.

### Hoja "Admin." — Columnas (fila 2 como cabecera de datos)

| Columna (origen) | Uso | Mapeo a destino (BMC crm_automatizado) |
|------------------|-----|----------------------------------------|
| Asig. | Responsable / asignado | Responsable (CRM_Operativo) |
| Estado | Pendiente, Asignado, Listo, Enviado, CONTACTAR, etc. | Estado |
| Fecha | Fecha (formato 18-03, 16-03, …) | Fecha |
| Cliente | Nombre del cliente | Cliente |
| Orig. | WA, EM, LL, ML, CL | Origen |
| Telefono-Contacto | Teléfono | Teléfono |
| Direccion / Zona | Ubicación | Ubicación / Dirección |
| Consulta | Texto libre de la consulta/pedido | Consulta / Pedido |
| RUTA DE ACCESO | Ruta o nota | (nueva columna o Observaciones) |
| Relleno, Largo (M), Ancho (M), Color | Datos técnicos estructurados | Columnas adicionales en tab integrada |
| TerminaFront, TerminaSup, Termina Lat. 1/2, Anclajes a, Traslado, Forma, etc. | Especificaciones | Columnas adicionales en tab integrada |

Las filas 1 y 3–7 contienen títulos, opciones de dropdown y texto de proyecto (p. ej. "BMC Uruguay Dashboard Modernization Project"). Los datos de cotizaciones empiezan aproximadamente en la fila 8. Hay una sección "ESPERANDO RESPUESTAS DE LOS CLIENTES" (fila 24 en la captura).

---

## 3. Estrategia de integración

1. **Nueva tab en destino:** En "BMC crm_automatizado" se crea la tab **Admin_Cotizaciones** (si no existe).
2. **Copia de estructura y datos:** El script lee la hoja "Admin." del origen (cabecera en fila 2, datos desde fila 3) y escribe en **Admin_Cotizaciones** del destino, respetando el orden de columnas y filtrando filas vacías o solo de título.
3. **Sincronización:** Se puede ejecutar el script bajo demanda (`npm run integrate-admin-cotizaciones`) o programar un cron; no se modifican otras tabs del destino (CRM_Operativo, etc.) salvo que se decida luego un flujo de fusión.

### Mapeo para API / CRM_Operativo (referencia)

Si en el futuro se quiere alimentar **CRM_Operativo** desde Admin_Cotizaciones o unificar registros:

| Admin_Cotizaciones (origen) | CRM_Operativo (canónico) |
|-----------------------------|---------------------------|
| Asig. | ASIGNADO_A / Responsable |
| Estado | ESTADO |
| Fecha | FECHA_CREACION |
| Cliente | CLIENTE_NOMBRE |
| Orig. | ORIGEN |
| Telefono-Contacto | TELEFONO |
| Direccion / Zona | DIRECCION |
| Consulta | NOTAS / Consulta / Pedido |

---

## 4. Script de integración

- **Script:** `scripts/integrate-admin-cotizaciones.js`
- **Comando:** `npm run integrate-admin-cotizaciones`
- **Variables de entorno:** Usa las mismas credenciales que el dashboard (`GOOGLE_APPLICATION_CREDENTIALS` o auth por defecto). Opcionalmente:
  - `BMC_ADMIN_COTIZACIONES_SOURCE_ID=1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0`
  - `BMC_SHEET_ID=1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg` (destino)

El script crea la tab **Admin_Cotizaciones** en el destino si no existe, luego copia cabecera (fila 2 del origen) y todas las filas de datos (desde fila 3), omitiendo filas completamente vacías y filas que sean solo encabezados de sección (p. ej. "ESPERANDO RESPUESTAS DE LOS CLIENTES").

---

## 5. Referencias

- [planilla-inventory.md](planilla-inventory.md) — Tabs y API del workbook principal.
- [PLANILLA-PRINCIPAL-DASHBOARD.md](PLANILLA-PRINCIPAL-DASHBOARD.md) — Rol de la planilla principal y service account.
