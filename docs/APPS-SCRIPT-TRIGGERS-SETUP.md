
# Guía de Configuración: Triggers de Apps Script para Planillas BMC

Este documento contiene las instrucciones y el código `Code.gs` para configurar los 6 triggers manuales requeridos por el sistema.

**Importante:** Necesitas tener una sesión de Google activa con permisos de edición sobre las planillas de BMC.

## Pasos Generales

1.  **Abre la Planilla de Google Sheets** correspondiente.
2.  Ve a **Extensiones > Apps Script**. Se abrirá una nueva pestaña con el editor de Apps Script.
3.  Si hay un archivo `Code.gs` con contenido, bórralo.
4.  **Copia y pega** el código que corresponda de las secciones de abajo en el editor.
5.  **Guarda el proyecto** (ícono de disquete).
6.  Ve a la sección **Activadores** (ícono de reloj) en el menú de la izquierda.
7.  Haz clic en **+ Añadir activador** y configúralo según la tabla.
8.  Repite para los 6 triggers.

---

## 1. Workbook Pagos Pendientes (`BMC_PAGOS_SHEET_ID`)

### Código `Code.gs` para Pagos

```javascript
function alEditarPagos(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  // Implementación futura para notificar cambios de estado de pago
  if (sheet.getName() === "Pagos_Pendientes" && range.getColumn() === 10) { // Asumiendo que la columna 10 es "ESTADO"
    // Lógica a ejecutar
  }
}

function alAbrirPagos() {
  // Implementación futura para refrescar datos o mostrar notificaciones
}
```

### Triggers para Pagos

| Función | Evento | Tipo | Notificación de errores |
| :--- | :--- | :--- | :--- |
| `alEditarPagos` | Al editar | De la hoja de cálculo | Diariamente |
| `alAbrirPagos` | Al abrir | De la hoja de cálculo | Diariamente |

---

## 2. Workbook Ventas (`BMC_VENTAS_SHEET_ID`)

### Código `Code.gs` para Ventas

```javascript
function alEditarVentas(e) {
  const sheet = e.source.getActiveSheet();
  // Futuro: Sincronizar con CRM o sistema de inventario
  if (sheet.getName() === "Ventas_Consolidado") {
    // Lógica
  }
}
```

### Trigger para Ventas

| Función | Evento | Tipo | Notificación de errores |
| :--- | :--- | :--- | :--- |
| `alEditarVentas` | Al editar | De la hoja de cálculo | Diariamente |

---

## 3. Workbook Stock (`BMC_STOCK_SHEET_ID`)

### Código `Code.gs` para Stock

```javascript
function alCambiarStock(e) {
  // Futuro: Validar niveles de stock y enviar alertas
}
```

### Trigger para Stock

| Función | Evento | Tipo | Notificación de errores |
| :--- | :--- | :--- | :--- |
| `alCambiarStock` | Al cambiar | De la hoja de cálculo | Diariamente |

---

## 4. Workbook Calendario (`BMC_CALENDARIO_SHEET_ID`)

### Código `Code.gs` para Calendario

```javascript
function alEditarCalendario(e) {
  // Futuro: Sincronizar con Google Calendar o sistema de logística
}

function cadaDia() {
  // Futuro: Enviar recordatorios de entregas próximas
}
```

### Triggers para Calendario

| Función | Evento | Tipo | Notificación de errores |
| :--- | :--- | :--- | :--- |
| `alEditarCalendario`| Al editar | De la hoja de cálculo | Diariamente |
| `cadaDia` | Según la hora | Temporizador diario | Diariamente |

---
Una vez configurados, los triggers ejecutarán las funciones correspondientes automáticamente cuando ocurran los eventos especificados.
