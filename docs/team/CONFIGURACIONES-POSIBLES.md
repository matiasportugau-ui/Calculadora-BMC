# Configuraciones posibles — Panel Config BMC Calculadora

Listado de opciones y mejores prácticas para el panel de Configuración (botón Config en el header).

---

## 1. Ya implementadas ✓

| Configuración | Descripción | Persistencia |
|---------------|-------------|--------------|
| **IVA (%)** | Alícuota IVA Uruguay (22% default) | localStorage |
| **Lista por defecto** | Web / Precio BMC (venta directa) | localStorage |
| **Flete por defecto** | USD sin IVA para cotizaciones nuevas | localStorage |

---

## 2. Modo de uso y experiencia

| Configuración | Descripción | Mejor práctica |
|---------------|-------------|----------------|
| **Modo por defecto** | Vendedor (wizard) o Cliente (form completo) al cargar | Persistir en localStorage; Vendedor para agentes internos |
| **Recordar último modo** | Mantener el modo usado en la sesión anterior | Útil si el mismo usuario usa siempre uno |
| **Mostrar indicador de modo** | Badge o texto visible en header | Siempre visible para evitar confusión |

---

## 3. Precios y variables fiscales

| Configuración | Descripción | Mejor práctica |
|---------------|-------------|----------------|
| **Moneda de visualización** | USD / UYU | Por defecto USD; UYU si hay integración DGI |
| **Redondeo de precios** | 0, 2 decimales, múltiplo de 5 | 2 decimales para USD; múltiplos para UYU |
| **Incluir IVA en totales** | Mostrar total con/sin IVA por defecto | Siempre mostrar ambos; destacar el final |
| **Margen mínimo** | % sobre costo para alertar cotizaciones bajas | Solo advertencia, no bloqueo |

---

## 4. Comportamiento de la UI

| Configuración | Descripción | Mejor práctica |
|---------------|-------------|----------------|
| **Valores por defecto (Modo Cliente)** | Prellenar familia, espesor, dimensiones típicas | Opción on/off; útil para demos o clientes recurrentes |
| **Categorías BOM visibles** | Qué categorías mostrar por defecto (Paneles, Fijaciones, etc.) | Todas activas por defecto; permitir guardar preferencia |
| **Mostrar SKU en cotización** | Incluir código en PDF/print | Off por defecto para cliente; on para interno |
| **Mostrar precios unitarios** | Detalle de PU en el presupuesto | On para interno; off para cliente final |
| **Compactar grupos BOM** | Iniciar con grupos colapsados | Off por defecto; on si hay muchos ítems |

---

## 5. Validaciones y rangos

| Configuración | Descripción | Mejor práctica |
|---------------|-------------|----------------|
| **Área mínima** | m² mínimos para cotizar (ej. 10) | Evitar cotizaciones testimoniales |
| **Área máxima** | m² máximos sin aprobación especial | Alertar, no bloquear |
| **Largo máximo por panel** | Según fabricante (ej. 14m) | Ya en constants; podría ser configurable para pruebas |
| **Campos obligatorios en proyecto** | Nombre, teléfono, dirección | Nombre + teléfono mínimo; dirección opcional |

---

## 6. Exportación e impresión

| Configuración | Descripción | Mejor práctica |
|---------------|-------------|----------------|
| **Formato PDF** | A4, Letter, orientación | A4 portrait por defecto |
| **Logo en cabecera** | Incluir logo BMC | Toggle on/off |
| **Notas al pie** | Texto legal, condiciones, validez | Plantilla editable |
| **Validez de cotización (días)** | "Válida por X días" | 30 días default |

---

## 7. Integraciones

| Configuración | Descripción | Mejor práctica |
|---------------|-------------|----------------|
| **API URL** | Base URL para cotizaciones GPT, etc. | Solo en dev; en prod usar env |
| **Google Drive** | Habilitar/deshabilitar guardado en Drive | On si hay OAuth configurado |
| **WhatsApp** | Prefijo de número (ej. +598) | Para enlace WA con número formateado |

---

## 8. Apariencia y accesibilidad

| Configuración | Descripción | Mejor práctica |
|---------------|-------------|----------------|
| **Tema** | Claro / Oscuro / Sistema | Respetar prefers-color-scheme |
| **Tamaño de fuente** | Normal / Grande | Para accesibilidad |
| **Idioma** | ES / EN | ES por defecto para Uruguay |

---

## 9. Mejores prácticas generales

### 9.1 Organización del panel

- **Agrupar por sección** con títulos claros (Precios, UI, Exportación, etc.)
- **Separar** configuraciones sensibles (IVA, precios) de las de UX
- **Usar tooltips** para explicar qué hace cada opción

### 9.2 Persistencia

- **localStorage** para preferencias de usuario (modo, tema, categorías)
- **No persistir** credenciales ni URLs de API en Config
- **Validar** rangos antes de guardar (ej. IVA 0–100%)

### 9.3 Seguridad

- No exponer variables que afecten márgenes o precios en modo "cliente público"
- Considerar **rol** (admin vs vendedor) para mostrar/ocultar opciones

### 9.4 Orden sugerido de implementación

1. **Fase 1 (rápido):** Modo por defecto, mostrar SKU, mostrar precios unitarios
2. **Fase 2:** Validaciones (área mín/máx), campos obligatorios
3. **Fase 3:** Exportación (formato PDF, validez, notas)
4. **Fase 4:** Tema, idioma, accesibilidad

---

## 10. Estructura sugerida del objeto de config

```js
{
  // Precios (ya existe)
  iva: 0.22,
  listaDefault: "web",
  fleteDefault: 280,

  // Modo y UX
  modoDefault: "vendedor",        // "vendedor" | "cliente"
  recordarModo: true,
  valoresDefaultCliente: false,    // prellenar en modo cliente
  categoriasBOMDefault: { PANELES: true, FIJACIONES: true, ... },

  // Exportación
  mostrarSKU: false,
  mostrarPreciosUnitarios: true,
  validezDias: 30,
  formatoPDF: "a4",

  // Validaciones
  areaMinima: 0,
  areaMaxima: 0,                   // 0 = sin límite

  // Apariencia
  tema: "sistema",                 // "claro" | "oscuro" | "sistema"
  idioma: "es"
}
```

---

*Documento de referencia para el equipo. Actualizar según se implementen nuevas opciones.*
