# Flujos Existentes - BMC / Panelin

Este documento define formalmente los principales flujos de trabajo que existen hoy en la aplicación Calculadora BMC (Panelin).

Estos flujos son la base del sistema de Tutorial Interactivo (Tutorial Mode).

---

## 1. Gestión de Cotizaciones Entrantes (`admin-cotizaciones-gestion`)

**Categoría**: Ventas / Operaciones  
**Superficie principal**: `/hub/cotizaciones` (AdminCotizacionesModule)

**Descripción**:
Flujo operativo diario del equipo de ventas para procesar todas las consultas que llegan por canales digitales (WhatsApp, Mercado Libre, Email).

**Pasos principales (basado en el walkthrough real de 31 pasos)**:

1. Aterrizar en el módulo y verificar estado "En Vivo"
2. Revisar KPIs (Pendientes, Con Error, Stale ≥14 días)
3. Usar vistas guardadas (Mis Leads, Urgentes, Sin movimiento, Borrador, etc.)
4. Ejecutar Batch de IA (el botón más importante del flujo)
5. Revisar filas en tabla o Kanban
6. Abrir Drawer de detalle por fila
7. Editar / Aprobar / Marcar como Enviada
8. Sincronizar con CRM_Operativo cuando corresponda
9. Usar Command Palette (⌘K) para acciones rápidas

**Herramientas clave**:
- `useAdminCotizaciones` hook
- DetailDrawer
- Batch IA (`/api/wolfboard/quote-batch`)
- Saved Views (Tanda 1)

---

## 2. Crear Cotización Completa (`crear-cotizacion-completa`)

**Categoría**: Cotizaciones Técnicas  
**Superficie principal**: Calculadora (`/` o `/calculadora`)

**Descripción**:
Flujo técnico desde la calculadora hasta la entrega del presupuesto al cliente.

**Pasos principales**:
1. Seleccionar escenario (Techo / Pared / Cámara / etc.)
2. Cargar dimensiones y zonas
3. Elegir familia y espesor de panel
4. Revisar BOM (despiece automático)
5. Ajustar totales, descuentos e IVA
6. Generar PDF profesional (con layouts)
7. Enviar por WhatsApp o guardar en Drive

**Herramientas clave**:
- `PanelinCalculadoraV3`
- Cálculos en `src/utils/calculations.js`
- PDF templates en `src/pdf-templates/`
- Export WhatsApp

---

## 3. Respuesta Rápida y Cierre (`respuesta-rapida-cierre`)

**Categoría**: Ventas / Alta Velocidad

**Descripción**:
Flujo optimizado para resolver consultas el mismo día que llegan.

Combinación de los flujos 1 y 2 en modo "alta velocidad".

Pasos reducidos:
- Identificar urgentes
- Generar IA (batch o individual)
- Aprobar + Enviar
- Marcar como enviada inmediatamente

---

## 4. Seguimiento Post-Cotización (`seguimiento-post-cotizacion`)

**Categoría**: Cierre y Seguimiento

**Descripción**:
Uso del orquestador + sistema de follow-ups para no perder oportunidades después de enviar un presupuesto.

Actualmente en etapa temprana (depende del `presupuestacion-orchestrator` + `followUpStore`).

---

## Cómo agregar un nuevo flujo existente

1. Identificar el flujo real en el código (componentes + acciones).
2. Agregarlo en `workflows.js` con pasos concretos y targets (`data-tutorial-id`).
3. Agregar los `data-tutorial-id` correspondientes en los componentes reales.
4. Actualizar este documento.

---

**Última actualización**: 2026-06-01  
**Responsable**: Chief Production Director (basado en código + walkthrough existente de Admin Cotizaciones)
