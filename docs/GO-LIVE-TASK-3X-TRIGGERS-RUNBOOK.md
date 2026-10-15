# Go-Live Task 3.x — Instalación de Triggers en Apps Script

**Estado**: Manual (no automatizado)  
**Tiempo estimado**: 30 min (6 triggers × 5 min c/u)  
**Dependencia**: Task 1.4 (compartir workbooks) + Task 2.x (crear tabs) completados

---

## Quick Start

Para cada uno de los **4 workbooks**, vas a:
1. Abrir la planilla en Google Sheets
2. **Extensiones** → **Apps Script**
3. Copiar/pegar el código `Code.gs` de abajo
4. Guardar (Ctrl+S)
5. Crear los triggers en el ícono ⏰ (Activadores)

**Total: 4 workbooks × 2-3 triggers c/u = 6 triggers.**

---

## 1️⃣ Workbook: Pagos Pendientes 2026

**URL**: https://docs.google.com/spreadsheets/d/1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI  
**Sheet ID**: `BMC_PAGOS_SHEET_ID`

### Paso 1: Abrir Apps Script

1. En la planilla, ve a **Extensiones > Apps Script**
2. Se abre una pestaña nueva con el editor
3. Si hay código viejo, bórralo todo

### Paso 2: Copiar `Code.gs`

Selecciona todo el código de abajo y pégalo en el editor:

```javascript
// Pagos Pendientes 2026 — Triggers de automatización

/**
 * Al editar cualquier celda en la hoja Pagos_Pendientes:
 * Actualiza timestamp, valida fecha, etc.
 */
function alEditarPagos(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;

  // Verificar si es la hoja Pagos_Pendientes
  if (sheet.getName() !== "Pagos_Pendientes") {
    return; // Ignorar cambios en otras hojas
  }

  // Log del cambio (timestamp)
  const timestamp = new Date();
  const col = range.getColumn();
  const row = range.getRow();

  Logger.log(`[PAGOS EDIT] Row ${row}, Col ${col}, Value: ${range.getValue()}, Time: ${timestamp}`);

  // Implementación futura: validar campos, enviar notificaciones, etc.
}

/**
 * Al abrir la planilla:
 * Refresca datos, muestra notificaciones, etc.
 */
function alAbrirPagos() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const ss = sheet.getSheetByName("Pagos_Pendientes");

  if (!ss) {
    Logger.log("[ERROR] Hoja 'Pagos_Pendientes' no encontrada");
    return;
  }

  Logger.log("[PAGOS OPEN] Planilla abierta: " + new Date());

  // Implementación futura: refrescar datos de API, mostrar alertas, etc.
}
```

### Paso 3: Guardar

- Presiona **Ctrl+S** o haz clic en el ícono de disquete
- Verás un mensaje "Proyecto guardado"

### Paso 4: Crear Triggers

1. En el menú de la izquierda, haz clic en **⏰ Activadores**
2. Haz clic en **+ Añadir activador** (abajo a la derecha)
3. Completa el formulario:

#### Trigger 1: `alEditarPagos`

| Campo | Valor |
|-------|-------|
| Función a ejecutar | `alEditarPagos` |
| Tipo de evento (al que debe ejecutarse) | **De la hoja de cálculo** |
| Tipo de evento especificado | **Al editar** |
| Notificación de errores | **Diariamente** |

Haz clic en **Guardar**.

#### Trigger 2: `alAbrirPagos`

| Campo | Valor |
|-------|-------|
| Función a ejecutar | `alAbrirPagos` |
| Tipo de evento | **De la hoja de cálculo** |
| Tipo de evento especificado | **Al abrir** |
| Notificación de errores | **Diariamente** |

Haz clic en **Guardar**.

✅ Listo! Pagos Pendientes tiene 2 triggers.

---

## 2️⃣ Workbook: 2.0 - Ventas

**URL**: https://docs.google.com/spreadsheets/d/1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA  
**Sheet ID**: `BMC_VENTAS_SHEET_ID`

### Paso 1-2: Copiar `Code.gs`

```javascript
// 2.0 - Ventas — Triggers de automatización

/**
 * Al editar la hoja Ventas_Consolidado:
 * Sincroniza con CRM, valida datos, etc.
 */
function alEditarVentas(e) {
  const sheet = e.source.getActiveSheet();

  // Verificar que es la hoja correcta
  if (sheet.getName() !== "Ventas_Consolidado") {
    return;
  }

  const range = e.range;
  const row = range.getRow();
  const col = range.getColumn();

  Logger.log(`[VENTAS EDIT] Row ${row}, Col ${col}, Value: ${range.getValue()}, Time: ${new Date()}`);

  // Implementación futura: sincronizar con CRM, validar stock, actualizar precios
}
```

### Paso 3-4: Guardar + Crear Trigger

| Campo | Valor |
|-------|-------|
| Función a ejecutar | `alEditarVentas` |
| Tipo de evento | **De la hoja de cálculo** |
| Tipo de evento especificado | **Al editar** |
| Notificación de errores | **Diariamente** |

✅ Listo! Ventas tiene 1 trigger.

---

## 3️⃣ Workbook: Stock E-Commerce

**URL**: https://docs.google.com/spreadsheets/d/1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw  
**Sheet ID**: `BMC_STOCK_SHEET_ID`

### Paso 1-2: Copiar `Code.gs`

```javascript
// Stock E-Commerce — Triggers de automatización

/**
 * Al cambiar cualquier valor en el Stock:
 * Valida niveles, genera alertas, sincroniza con Shopify
 */
function alCambiarStock(e) {
  const range = e.range;
  const newValue = range.getValue();
  const row = range.getRow();
  const col = range.getColumn();

  Logger.log(`[STOCK CHANGE] Row ${row}, Col ${col}, New Value: ${newValue}, Time: ${new Date()}`);

  // Implementación futura:
  // - Validar niveles mínimos
  // - Generar alertas de stock bajo
  // - Sincronizar con Shopify vía API
  // - Notificar a vendedores
}
```

### Paso 3-4: Guardar + Crear Trigger

| Campo | Valor |
|-------|-------|
| Función a ejecutar | `alCambiarStock` |
| Tipo de evento | **De la hoja de cálculo** |
| Tipo de evento especificado | **Al cambiar** |
| Notificación de errores | **Diariamente** |

✅ Listo! Stock tiene 1 trigger.

---

## 4️⃣ Workbook: Calendario de vencimientos

**URL**: https://docs.google.com/spreadsheets/d/1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk  
**Sheet ID**: `BMC_CALENDARIO_SHEET_ID`

### Paso 1-2: Copiar `Code.gs`

```javascript
// Calendario de vencimientos — Triggers de automatización

/**
 * Al editar cualquier fecha o dato de vencimiento:
 * Valida, actualiza recordatorios, sincroniza con Google Calendar
 */
function alEditarCalendario(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;

  Logger.log(`[CALENDARIO EDIT] Sheet: ${sheet.getName()}, Row: ${range.getRow()}, Col: ${range.getColumn()}, Time: ${new Date()}`);

  // Implementación futura:
  // - Validar fechas de vencimiento
  // - Actualizar Google Calendar
  // - Enviar recordatorios a operadores
}

/**
 * Diariamente a las 8:00 AM:
 * Envía recordatorios de entregas próximas, vencimientos, etc.
 */
function cadaDia() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const ss = sheet.getSheetByName("Calendario_Control");

  Logger.log(`[CALENDARIO DAILY] Tarea diaria ejecutada a: ${new Date()}`);

  // Implementación futura:
  // - Leer próximas entregas/vencimientos
  // - Enviar email/SMS a operadores
  // - Actualizar dashboard
}
```

### Paso 3-4: Guardar + Crear Triggers

#### Trigger 1: `alEditarCalendario`

| Campo | Valor |
|-------|-------|
| Función a ejecutar | `alEditarCalendario` |
| Tipo de evento | **De la hoja de cálculo** |
| Tipo de evento especificado | **Al editar** |
| Notificación de errores | **Diariamente** |

#### Trigger 2: `cadaDia`

| Campo | Valor |
|-------|-------|
| Función a ejecutar | `cadaDia` |
| Tipo de evento | **Según la hora** |
| Tipo de evento especificado | **Temporizador diario** |
| Hora | **08:00 AM** |
| Notificación de errores | **Diariamente** |

✅ Listo! Calendario tiene 2 triggers.

---

## ✅ Resumen: Triggers Instalados

**Total: 6 triggers**

| # | Workbook | Función | Evento | Schedule |
|---|----------|---------|--------|----------|
| 1 | Pagos Pendientes | `alEditarPagos` | Al editar | (evento) |
| 2 | Pagos Pendientes | `alAbrirPagos` | Al abrir | (evento) |
| 3 | Ventas | `alEditarVentas` | Al editar | (evento) |
| 4 | Stock | `alCambiarStock` | Al cambiar | (evento) |
| 5 | Calendario | `alEditarCalendario` | Al editar | (evento) |
| 6 | Calendario | `cadaDia` | Temporizador | Diario 08:00 AM |

---

## ✨ Verificación

Una vez instalados todos los triggers:

1. **En cada Apps Script**, ve a **⏰ Activadores** y verifica que los 6 aparezcan en la lista
2. **En cada Apps Script**, ve a la sección **Logs** (ícono de 📋 Log execution) y busca errores
3. Opcionalmente, haz un cambio en una hoja y verifica que se registre en los logs

---

## 🔗 Próximos pasos

Una vez completados los 6 triggers:

1. ✅ Verifica que las tabs existan (tasks 2.x)
2. ✅ Corre `npm run pre-deploy` para verificar estado general
3. ✅ Agenda el deploy a Cloud Run (task 5.x)
4. ✅ Corre verificación E2E (task 6.x)

---

## 📞 Troubleshooting

**Trigger no se ejecuta:**
- Verifica que el nombre de la función sea exacto (minúsculas/mayúsculas)
- Verifica que el tipo de evento coincida (on edit, on open, etc.)
- Abre los **Logs** y busca mensajes de error

**Error: "Permiso denegado":**
- Verifica que la SA (`bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com`) tenga acceso **Editor** al workbook

**¿La hoja no se encuentra?**
- Verifica que el nombre de la hoja en `sheet.getName()` coincida exactamente (case-sensitive)
- Usa `SpreadsheetApp.getActiveSheet()` en lugar de `getSheetByName()` si estás en duda

---

**Creado**: 2026-10-15  
**Última actualización**: 2026-10-15
