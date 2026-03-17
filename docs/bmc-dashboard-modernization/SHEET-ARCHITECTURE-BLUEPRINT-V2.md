# BMC CRM Sheet — Architecture Blueprint V2 (10/10)

**Target workbook:** [BMC crm_automatizado](https://docs.google.com/spreadsheets/d/1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg/edit?gid=1427195280#gid=1427195280)

**Objetivo:** Consolidación y mejora de arquitectura hacia calidad 10/10: captura asistida en Dashboard, fuente única en CRM_Operativo, catálogos en Parametros, capa técnica Motor_IA, automatismos por fórmulas + Apps Script, UI compacta con sidebar/panel AI.

---

## 1. Decisión de arquitectura (5 módulos)

| Módulo | Rol | Contenido |
|--------|-----|-----------|
| **Parametros** | Catálogo maestro | Listas cerradas para validación (Origen, Categoría, Estado, etc.). Validación desde rangos, no hardcode. |
| **CRM_Operativo** | Fuente única de verdad | Hoja transaccional. Todo lo que el dashboard muestre o edite termina acá. |
| **Motor_IA** | Capa técnica | Parseo, normalización, clasificación sugerida, score, reglas. Hoja semioculta o solo Apps Script. |
| **Dashboard** | Entrada + decisión + monitoreo | Filtros, KPIs, tablas de acción, Panel Agente AI (sidebar HTML). Liviano. |
| **Data_Base** | Histórico / espejo | Solo backup y reporting. Sin lógica activa. |

**Regla central:** *La IA sugiere. La operación confirma. El sistema registra.*

---

## 2. Módulo 1 — Parametros (catálogo maestro)

Centralizar **todas** las listas cerradas: Origen, Categoría, Estado, Responsable, Prioridad manual, Urgencia, Tipo de cliente, Necesita cotización, Stock a validar, Cierre / Estado final. Validación desde rangos de Parametros (evitar listas hardcodeadas).

### 2.1 Estructura sugerida de Parametros

| Columna | Uso |
|---------|-----|
| **Lista** | Nombre del catálogo (Origen, Categoría, Estado, …) |
| **Valor** | Opción (ej. "WhatsApp", "Alta") |
| **Orden** | Orden de aparición en dropdown |
| **Activo** | Sí/No para ocultar opciones sin borrar |
| **Color_UI** | Color para dashboard (opcional) |
| **Icono** | Icono corto (opcional) |
| **Alias** | Etiqueta alternativa (opcional) |
| **Puntaje_Base** | Cuando aplique (ej. Urgencia, Estado) para scoring |

Validación en CRM_Operativo: `requireValueInRange()` o `requireValueInList()` desde rangos de Parametros. Rechazo en operativa; warning solo en staging.

### 2.2 Dropdowns definitivos (valores a cargar en Parametros)

- **Origen:** WhatsApp, Llamada, Instagram, Facebook, Web, Referido, Cliente recurrente, Visita local, Marketplace, Otro.
- **Categoría:** Accesorios, Paneles techo, Proyecto completo, Tornillería, Repuestos, Servicio / instalación, Otro.
- **Estado:** Nuevo, En análisis, Esperando info, Cotizando, Enviado presupuesto, En seguimiento, Ganado, Perdido, Pausado.
- **Prioridad manual:** Alta, Media, Baja, Sin prioridad.
- **Urgencia:** Hoy, 24 h, Esta semana, Este mes, Sin urgencia, **Plazo personalizado**.
- **Tipo de cliente:** Particular, Empresa, Arquitecto / estudio, Constructor / contratista, Distribuidor / revendedor, Instalador, Cliente existente, Sin clasificar.
- **Necesita cotización:** Sí, No, Ya enviada, No aplica.
- **Stock a validar:** Sí, No, Parcial, No aplica.
- **Cierre / Estado final:** Ganado, Perdido, Cancelado, Sin definir.
- **Responsable:** (lista dinámica; puede venir de otra hoja o Parametros).

---

## 3. Módulo 2 — CRM_Operativo (fuente única)

Todo lo que el dashboard muestre o edite debe terminar acá. Una sola fuente de verdad.

### 3.1 Columnas finales recomendadas (orden sugerido)

| # | Columna | Tipo | Notas |
|---|---------|------|--------|
| 1 | ID | Integer | Auto (ej. ROW()-offset) |
| 2 | Fecha alta | Date | YYYY-MM-DD |
| 3 | Cliente | String | |
| 4 | Telefono | String | Normalizado por Motor_IA |
| 5 | Email | String | |
| 6 | Ubicacion | String | |
| 7 | Origen | Dropdown (Parametros) | |
| 8 | Texto ingreso | String | Texto libre original |
| 9 | Resumen IA | String | Derivado Motor_IA |
| 10 | Categoria sugerida | String | Sugerido por IA |
| 11 | Categoria | Dropdown (Parametros) | Final operativo |
| 12 | Tipo cliente sugerido | String | Sugerido por IA |
| 13 | Tipo cliente | Dropdown (Parametros) | Final operativo |
| 14 | Necesita cotizacion | Dropdown (Parametros) | |
| 15 | Stock a validar | Dropdown (Parametros) | |
| 16 | Responsable | Dropdown (Parametros) | |
| 17 | Estado | Dropdown (Parametros) | |
| 18 | Prioridad auto | Calculado | Desde score |
| 19 | Prioridad manual | Dropdown (Parametros) | |
| 20 | Urgencia | Dropdown (Parametros) | Incluye "Plazo personalizado" |
| 21 | Fecha limite objetivo | Date | Obligatoria si Urgencia = Plazo personalizado |
| 22 | Detalle plazo | String | Ej. "obra en 60 días", "licitación en agosto" |
| 23 | Proxima accion | String | |
| 24 | Fecha proxima accion | Date | |
| 25 | Ultimo contacto | Date | |
| 26 | Dias sin movimiento | Float | Calculado |
| 27 | Datos faltantes | String | Lista de campos faltantes |
| 28 | Completitud | Float/Int | % o score |
| 29 | Score auto | Integer | 0–100 |
| 30 | Alerta | Calculado | Vence hoy, Seguimiento vencido, OK, etc. |
| 31 | Presupuesto ID | String | ID en Drive si aplica |
| 32 | Presupuesto URL | String | HYPERLINK en v1 |
| 33 | Presupuesto estado | String | |
| 34 | Fecha presupuesto | Date | |
| 35 | Version | String | Versión del presupuesto |
| 36 | Cierre / Estado final | Dropdown (Parametros) | |
| 37 | Observaciones | String | |

**Urgencia 10/10:** Si Urgencia = "Plazo personalizado", **Fecha límite objetivo** obligatoria y **Detalle plazo** para texto libre (ej. "obra en 60 días"). No meter texto editable dentro del dropdown; usar este par de campos.

---

## 4. Módulo 3 — Motor_IA (capa técnica)

No debe ser una hoja “bonita”; hoja técnica semioculta o solo funciones Apps Script.

**Responsabilidades:**

- Parseo del texto libre
- Normalización (teléfono, fechas relativas, origen, nombres)
- Clasificación sugerida (tipo cliente, categoría, necesidad cotización, stock a validar)
- Deduplicación tentativa
- Score de completitud
- Reglas de aclaración / datos faltantes
- Campos derivados para dashboard

Evitar llenar CRM_Operativo de columnas auxiliares temporales; concentrar lógica aquí y versionarla.

---

## 5. Módulo 4 — Dashboard (entrada + decisión + monitoreo)

Liviano. No tabla inmensa.

### 5.1 Layout recomendado

- **Fila 1 — Filtros:** Responsable | Estado | Categoría | Origen | Urgencia | Fecha
- **Fila 2 — KPIs:** Leads activos | Cotizaciones pendientes | Vencidos hoy | Sin movimiento | Ganados | Pipeline
- **Bloque izquierda:** Panel Agente AI / botón abrir sidebar
- **Bloque central — Tabla "Requiere acción":** Cliente, Estado, Prioridad, Urgencia, Próxima acción, Alerta, 📄 (presupuesto)
- **Bloque derecha:** Vencidos/urgentes | Faltan datos | Presupuestos enviados

**Panel Agente AI:** Sidebar HTML con `Ui.showSidebar()`, no grilla sobrecargada. Entrada de texto libre → `google.script.run` → procesar → escribir en CRM_Operativo.

### 5.2 CRM_Operativo vista diaria

Congelar encabezado y primeras columnas. Colorear por estado y prioridad. Pocas columnas críticas visibles; resto en bloques. Evitar 30 columnas visibles a la vez.

---

## 6. Módulo 5 — Data_Base

Histórico / espejo / reporting. **Sin lógica activa** en la hoja; los movimientos los ejecutan triggers o scripts.

- **Cuándo entra un registro:** Cuando se **cumplen todas las etapas del presupuesto**, la fila se mueve **automáticamente** de CRM_Operativo (o administrador de cotizaciones) a Data_Base. Implementar con trigger o función que detecte “presupuesto completo” y haga append en Data_Base + borrado (o marcado) en origen.
- **Retomar:** Desde Data_Base debe existir un **botón o columna/estado "Retomar"** que mueva la fila de vuelta a la planilla de **Administrador de cotizaciones** (CRM_Operativo) para seguir trabajándola. Acción inmediata al pulsar/activar.
- **Cotización aceptada:** Cuando la cotización es **aceptada**, la fila se mueve a la **pestaña Ventas**. **Recomendación:** misma planilla (mismo workbook), pestaña "Ventas" o "Ventas realizadas y entregadas", como en el flujo actual de marcar entregado (un solo `BMC_SHEET_ID`, misma API). Si se usa otra planilla, definir workbook y permisos aparte.

---

## 7. Flujos operativos

| Flujo | Descripción |
|-------|-------------|
| **A — Ingreso lead desde Panel Agente AI** | Usuario escribe/pega en sidebar → script normaliza, extrae (cliente, teléfono, ubicación, origen, categoría sugerida, tipo cliente sugerido, urgencia sugerida, etc.) → si info mínima OK, crea fila en CRM_Operativo; si faltan datos críticos, crea con Estado = "Esperando info", Datos faltantes y preguntas sugeridas → Dashboard se refresca. |
| **B — Edición humana** | Cambios en Estado, Prioridad, Responsable, Urgencia, Fecha próxima acción, Presupuesto URL → recalculan score, alertas, vistas. |
| **C — Cotización** | Al agregar Presupuesto URL: link en CRM_Operativo, ícono/CTA en Dashboard, opcionalmente Estado → "Enviado presupuesto". |
| **D — Aclaraciones** | Si el agente detecta ambigüedad: no inventar; dejar sugerencias y preguntas. Aumenta seguridad del sistema. |
| **E — Presupuesto completo → Data_Base** | Cuando se cumplen **todas las etapas del presupuesto**, el registro se mueve **automáticamente** a Data_Base (append en Data_Base, borrado o marcado en CRM_Operativo). Trigger o script según definición de “etapas completas”. |
| **F — Retomar** | Botón o columna/estado **"Retomar"** en Data_Base (o en vista de Data_Base): mueve la fila **inmediatamente** de vuelta a la planilla de **Administrador de cotizaciones** (CRM_Operativo) para reabrir el caso. |
| **G — Cotización aceptada → Ventas** | Cuando la cotización es **aceptada**, la fila se mueve a la **pestaña Ventas** (misma planilla recomendado; si es otra planilla, definir workbook y API). Mismo patrón que “marcar entregado” en el flujo actual. |

---

## 8. Automatización

**Automatizar al máximo:** IDs, timestamps, normalización teléfono/texto, deduplicación tentativa, score, alertas, clasificación sugerida, estado inicial, control faltantes, linkeo presupuesto, refresco dashboard.

**Confirmación o control humano:** clasificación final si hay ambigüedad, cierre ganado/perdido, urgencia final si texto no claro, stock real confirmado, presupuesto final/versión válida, responsable final en escenarios complejos.

---

## 9. Apps Script — patrón técnico

- **Fórmulas** para cálculo visible (score, alertas, días sin movimiento).
- **onEdit(e)** para cambios humanos (recalcula score, prioridad, alertas, timestamps).
- **Funciones explícitas / triggers instalables** para procesos enriquecidos.
- **Sidebar HTML** para Panel Agente AI (no toda la inteligencia en celdas).

### 9.1 Trigger stack recomendado

| # | Trigger / función | Uso |
|---|-------------------|-----|
| 1 | onOpen(e) | Menú custom, acceso al sidebar Panel Agente AI |
| 2 | showSidebar() | Muestra panel HTML |
| 3 | processLeadPayload(payload) | Server-side desde sidebar: parsea, valida, normaliza, escribe en CRM_Operativo |
| 4 | onEdit(e) | Reacciona a columnas críticas en CRM_Operativo; recalcula score, prioridad auto, alertas, timestamps |
| 5 | Trigger instalable horario | Barrido vencimientos, housekeeping, consistencia, backlog |
| 6 | Trigger instalable cambio estructural | Solo si se crean hojas o se toca estructura |

Limitación: triggers simples (~30 s, no reaccionan igual a cambios por API/script). Patrón robusto: fórmulas + onEdit para humano + instalables para procesos pesados + sidebar para ingesta.

---

## 10. Presupuesto (Drive)

**En Dashboard:** Mostrar mínimo, ej. “📄 Presupuesto”.

**En CRM_Operativo:** Presupuesto ID, Presupuesto URL, Presupuesto estado, Fecha presupuesto, Version.

**V1:** HYPERLINK(url, "📄 Presupuesto"). **V2 (opcional):** Smart chips de Drive (Sheets API, scopes drive.file/drive; GA desde junio 2025) si aporta valor.

---

## 11. Especificación funcional por módulos (calidad objetivo)

| Módulo | Objetivo | Calidad |
|--------|----------|---------|
| A — Ingesta | Texto libre → fila operativa útil | 9.5/10 |
| B — Normalización | Limpiar y estandarizar (teléfono, origen, nombres, urgencia, fechas) | 10/10 |
| C — Clasificación | Sugerir tipo cliente, categoría, necesidad cotización, stock | 9/10 |
| D — Score y priorización | Foco operativo (urgencia, días sin movimiento, completitud, estado) | 9/10 |
| E — Seguimiento y alertas | Vence hoy, seguimiento vencido, falta relevar, OK | 10/10 |
| F — Cotizaciones | Trazabilidad presupuesto y acceso rápido | 9/10 |
| G — Dashboard ejecutivo | Decidir rápido sin saturación | 9.5/10 |
| H — Gobernanza de datos | Dropdowns, fuente única, sugerido/final, backups | 10/10 |

---

## 12. Riesgos

| Color | Mensaje |
|-------|---------|
| **Verde** | Dropdowns + sugerido/final + sidebar + fuente única = base muy fuerte. |
| **Amarillo** | Si el dashboard escribe mucho directo en celdas sin funciones centralizadas, la lógica se dispersa. |
| **Rojo** | Si “Panel Agente AI” se resuelve solo con fórmulas y celdas (sin Apps Script/HTML), UX y mantenibilidad caen. |

---

## 13. Instrucción maestra (resumen ejecutivo)

Construir un sistema en Google Sheets con **CRM_Operativo** como fuente única de verdad, **Parametros** como catálogo maestro de dropdowns, **Dashboard** como panel ejecutivo y entrada asistida, **Data_Base** como respaldo y **Motor_IA** como capa técnica. Implementar el **Panel Agente AI** como **sidebar HTML** en Apps Script para capturar texto libre, procesarlo, normalizarlo, clasificarlo, detectar faltantes y crear/actualizar registros en CRM_Operativo. Usar **dropdowns** para todos los campos categóricos cerrados (desde Parametros). Mantener separación **sugerido (IA) / final (operativo)**. Resolver **Urgencia** con dropdown cerrado + **Fecha límite objetivo** + **Detalle plazo**; "Plazo personalizado" para casos no estándar. Automatizar scoring, alertas, completitud, vencimientos, trazabilidad de presupuesto y refresco con **fórmulas + onEdit + triggers instalables**. Presupuesto como link corto/ícono en dashboard; en hoja: URL/ID/estado. Interfaz **limpia, espaciada y accionable**, sin saturación visual.

---

## 14. Próximos pasos de implementación

**Diff actual vs blueprint:** Ver [docs/google-sheets-module/planilla-map.md](../google-sheets-module/planilla-map.md) para comparación de tabs, columnas CRM_Operativo, Parametros, dropdowns y checklist de implementación.

1. **Parametros:** Crear/ajustar hoja con estructura (Lista, Valor, Orden, Activo, Color_UI, Icono, Alias, Puntaje_Base). Poblar listas definitivas (§2.2).
2. **CRM_Operativo:** Añadir/alinear columnas con la lista §3.1; configurar validación de datos desde rangos de Parametros.
3. **Urgencia:** Implementar regla Plazo personalizado → Fecha límite objetivo obligatoria + Detalle plazo.
4. **Motor_IA:** Crear hoja técnica o módulo Apps Script (parseo, normalización, clasificación, score); no exponer como vista principal.
5. **Dashboard:** Reducir columnas visibles; filas de filtros y KPIs; bloques (acción, vencidos, faltan datos, presupuestos).
6. **Panel Agente AI:** Sidebar HTML + `processLeadPayload` + menú onOpen.
7. **Triggers:** onOpen, onEdit (columnas críticas), instalable horario (y opcional cambio estructural).
8. **Data_Base:** Mantener como espejo/backup sin lógica.

**Repositorio:** Usar skill `bmc-sheets-structure-editor` (Matias, Cursor) para cambios de estructura vía API; `google-sheets-mapping-agent` para documentar mapa actualizado. Workbook ID en env: `BMC_SHEET_ID`.
