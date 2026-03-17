# Visión: Front unificado del dashboard (hojas como base de datos)

**Objetivo:** Dejar de mostrar el Google Sheet embebido “crudo” y construir un **front sistemático, intuitivo y fácil de usar** que tome los datos de las hojas vía API, los organice como queramos en el dashboard y permita **editar la planilla desde el dashboard** (la hoja es la base de datos). Incluir **botones de acción** (Costeo de venta, Administrar Venta, etc.) y **automatismos** (ej.: si se marca “entregado” → pasar a Ventas realizadas y entregadas).

---

## 1. Problema actual

- **Ventas 2.0**, **Administrador de Cotizaciones**, **Pagos Pendientes**, **Calendario de vencimientos** se muestran como **iframe del Sheet**.
- El usuario ve la interfaz completa de Google Sheets (menús, barras, celdas), lo que:
  - No es la experiencia que queremos para el equipo.
  - No permite organizar la información por flujos (ventas activas, entregas, cobros).
  - No ofrece acciones claras (costeo, administrar venta, marcar entregado) en un solo lugar.
  - La edición es “celda a celda” en la hoja, sin flujos guiados ni automatismos visibles.

---

## 2. Principios del nuevo front

| Principio | Descripción |
|----------|-------------|
| **Hoja = base de datos** | Las hojas de Google Sheets siguen siendo la fuente de verdad. El dashboard **lee** (API) y **escribe** (API) sobre ellas. No reemplazamos Sheets; lo usamos como backend. |
| **Datos recabados y reorganizados** | El front **obtiene** los datos de la hoja (vía backend con Sheets API) y los **presenta** como decidamos: tablas, cards, filtros, agrupaciones, pestañas internas. La organización en pantalla es independiente de la estructura de la hoja. |
| **Edición desde el dashboard** | El usuario puede **editar** información clave (fecha de entrega, estado, comentarios, etc.) desde el dashboard. Esas ediciones se persisten en la hoja vía API (y, si aplica, Apps Script puede seguir disparando automatismos). |
| **Botones de acción y automatismos** | Acciones concretas con un clic: **Costeo de venta**, **Administrar Venta**, **Marcar entregado**, etc. Detrás pueden ejecutarse scripts (Apps Script o backend) que actualicen la hoja y/o muevan filas (ej.: de Master_Cotizaciones a Ventas realizadas y entregadas). |
| **Sistemático e intuitivo** | Navegación clara por pestañas/vistas; formularios o modales para editar; mensajes de confirmación y estados de carga; sin depender de que el usuario “entrene” en la hoja embebida. |

---

## 3. Pestañas / vistas a cubrir

Cada pestaña del dashboard (Ventas 2.0, Administrador de Cotizaciones, Pagos Pendientes, Calendario) debe evolucionar a un **front propio** que:

1. **Recaba datos** de la hoja correspondiente (y de hojas relacionadas si hace falta) vía API.
2. **Muestra** la información en layouts pensados para el rol (ventas, admin, finanzas).
3. **Permite editar** los campos relevantes (fecha de entrega, estado, montos, notas, etc.) y **guardar** contra la hoja.
4. **Ofrece botones de acción** específicos por contexto (ver abajo).

---

## 4. Ventas 2.0 (hoja “Ventas y Coordinaciones” y relacionadas)

### 4.1 Datos a recabar

- Filas de la hoja de ventas activas (ej. “Ventas y Coordinaciones”): vendedor, ID pedido, ingreso, facturación, estado/detalle, fecha entrega, nombre cliente, etc.
- Si existe integración con **Ventas realizadas y entregadas** (u otra hoja de “entregados”), poder leerlas para historial o reportes.

### 4.2 Cómo organizarlo en el dashboard

- **Vista principal:** tabla o cards de **pedidos/ventas activos** con columnas clave: ID pedido, cliente, vendedor, fecha entrega, estado general, facturación.
- **Filtros:** por vendedor, rango de fechas, estado (pendiente entrega, entregado, etc.).
- **Agrupaciones opcionales:** por semana de entrega, por vendedor, por estado.

### 4.3 Edición desde el dashboard

- **Por fila/venta:** poder editar en un panel o modal:
  - Fecha de entrega.
  - Datos completos de la planilla que se consideren editables (estado, notas, facturación, etc.).
- **Guardar:** envía los cambios al backend; el backend actualiza la hoja (Sheets API o Apps Script). Opcional: reflejar en AUDIT_LOG si aplica.

### 4.4 Botones de acción

| Botón | Descripción | Comportamiento esperado |
|-------|-------------|-------------------------|
| **Costeo de venta** | Abre flujo para costear esa venta. | Modal o pantalla de costeo; al confirmar, puede escribir resultado en la hoja (ej. columna o hoja de costeos) y/o disparar un cálculo/script. |
| **Administrar Venta** | Gestionar esa venta en detalle. | Abre panel/modal con **todos los datos editables** de la planilla (fecha de entrega, estado, notas, pagos, etc.). Guardar persiste en la hoja. Aquí se puede incluir también “Marcar entregado” si aplica. |
| **Marcar entregado** | La venta ya se entregó. | Al confirmar: **automatismo** → copiar la fila a **Ventas realizadas y entregadas** (con fecha real de entrega, comentarios si los hay) y quitar o marcar en la hoja de activos (según reglas de negocio). Opcional: notificar o actualizar otras hojas. |

### 4.5 Automatismos

- **Si se marca “Entregado”** (o equivalente):  
  - Copiar fila a **Ventas realizadas y entregadas** (FECHA_ENTREGA_REAL = hoy, COMENTARIOS si existen).  
  - Eliminar o archivar la fila en la hoja de ventas activas (o actualizar estado), según diseño actual (ej. Code.gs ya hace algo similar para Master_Cotizaciones).
- Otros automatismos que se definan (ej. al cambiar estado a “Facturado”, actualizar otra hoja o columna).

---

## 5. Otras pestañas (Administrador de Cotizaciones, Pagos, Calendario)

- **Misma idea:** para cada una, definir:
  - **Qué datos** se leen de qué hojas.
  - **Cómo** se muestran (tablas, cards, calendario).
  - **Qué se puede editar** y con qué botón/guardar.
  - **Qué acciones** tienen (ej. en Pagos: “Marcar cobrado”, “Recordatorio”).
- El backend ya expone o puede extender endpoints para leer/escribir esas hojas (igual que para Finanzas/Admin Cotizaciones hoy).

---

## 6. Stack técnico sugerido (alineado con lo existente)

- **Backend:** Node (Calculadora-BMC) con **Sheets API** (service account con acceso de **lectura y escritura** a las hojas). Endpoints tipo:
  - `GET /api/ventas`, `GET /api/ventas/:id`, `PATCH /api/ventas/:id` (o PUT).
  - `POST /api/ventas/:id/marcar-entregado` (y análogos para otras acciones).
- **Front:** mismo dashboard que ya usa el backend (pestaña Finanzas, o una nueva pestaña “Ventas” / “Ventas 2.0” en el Panelin Internal). Componentes React o HTML/JS que consuman la API y muestren tablas/formularios/botones.
- **Automatismos:** pueden vivir en **Apps Script** (al escribir en la hoja, un `onEdit` o trigger hace el “pasar a Ventas realizadas y entregadas”) o en el **backend** (el endpoint `marcar-entregado` hace la copia/borrado vía Sheets API). Lo importante es que la **acción en el dashboard** dispare el flujo completo.

---

## 7. Prompt resumido para implementación

**“Construir un front unificado para el dashboard BMC que:**

1. **En lugar de embeber el Google Sheet**, consuma los datos de Ventas 2.0 (y demás pestañas) vía API y los muestre en tablas/vistas organizadas, con filtros y diseño claro.
2. **Permita editar** desde el dashboard los datos de la planilla (fecha de entrega, estado, datos completos editables) y **persista** los cambios en la hoja (la hoja es la base de datos).
3. **Incluya botones de acción** por venta/pedido:
   - **Costeo de venta** (flujo de costeo y, si aplica, guardar en hoja).
   - **Administrar Venta** (edición completa de la fila: fecha de entrega, datos de la planilla, guardar).
   - **Marcar entregado** (automatismo: copiar a Ventas realizadas y entregadas, con fecha real y comentarios, y actualizar/archivar en la hoja de activos).
4. **Aplique la misma lógica** a las otras pestañas (Administrador de Cotizaciones, Pagos Pendientes, Calendario): datos recabados por API, presentación ordenada, edición y acciones específicas por contexto.
5. **Mantenga** la integración con Apps Script y Sheets existentes (triggers, AUDIT_LOG, Ventas realizadas y entregadas) para que los automatismos y la trazabilidad sigan funcionando.”  

---

## 8. Referencias en el repo

- **IMPLEMENTATION.md** — fases 1–4, estructura de hojas (Master_Cotizaciones, Ventas realizadas y entregadas, Pagos_Pendientes, etc.), triggers y flujo “marcar entregado”.
- **sheets-api-server.js** y **server/routes/bmcDashboard.js** — lectura y escritura vía Sheets API; endpoint `POST /api/marcar-entregado` como ejemplo de acción que escribe en la hoja.
- **dashboard/** (Finanzas) — ejemplo de front que consume API y no embebe la hoja; base para replicar el patrón en Ventas 2.0 y demás pestañas.
