# Planilla Map — BMC crm_automatizado (actual vs blueprint V2)

**Workbook:** [BMC crm_automatizado](https://docs.google.com/spreadsheets/d/1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg/edit?gid=1427195280#gid=1427195280)  
**Blueprint target:** [SHEET-ARCHITECTURE-BLUEPRINT-V2.md](../bmc-dashboard-modernization/SHEET-ARCHITECTURE-BLUEPRINT-V2.md)

Este documento compara el estado **actual** de la hoja con el blueprint 10/10 y sirve como diff para aplicar cambios.

---

## 1. Tabs (hojas) — actual vs blueprint

| Actual (observado) | Blueprint | Acción |
|--------------------|-----------|--------|
| CRM_Operativo | CRM_Operativo (fuente única) | Mantener; alinear columnas (§2) |
| Manual | — | Evaluar: fusionar en Parametros o conservar como doc interno |
| Parametros | Parametros (catálogo maestro) | Mantener; alinear estructura (§3) |
| Dashboard | Dashboard (entrada + decisión) | Mantener; rediseñar layout (§4) |
| Automatismos | Motor_IA (capa técnica) | Renombrar o crear Motor_IA; Automatismos → lógica Apps Script |
| — | Data_Base (espejo) | Crear si no existe. Entrada automática cuando presupuesto completo; botón/estado Retomar → vuelve a CRM; cotización aceptada → Ventas. Ver §7. |

---

## 2. CRM_Operativo — columnas actuales vs recomendadas

Columnas **actuales** (encabezado fila 3, según vista del workbook):

| # | Columna actual | Tipo observado |
|---|----------------|-----------------|
| 1 | ID | Integer |
| 2 | Fecha | Date |
| 3 | Cliente | String |
| 4 | Teléfono | String |
| 5 | Ubicación / Dirección | String |
| 6 | Origen | Dropdown |
| 7 | Consulta / Pedido | String |
| 8 | Categoría | Dropdown |
| 9 | Prioridad manual | Dropdown |
| 10 | Estado | Dropdown |
| 11 | Responsable | Dropdown |
| 12 | Próxima acción | String |
| 13 | Fecha próxima acción | Date |
| 14 | Nivel de avance | String |
| 15 | Necesita cotización | Dropdown |
| 16 | Cotización enviada | String |
| 17 | Monto estimado USD | String/Number |
| 18 | Probabilidad cierre | String |
| 19 | Urgencia | Dropdown |
| 20 | Stock a validar | Dropdown |
| 21 | Datos faltantes | String |
| 22 | Tipo de cliente | Dropdown |
| 23 | Observaciones | String |
| 24 | Último contacto | Date |
| 25 | Resultado esperado | String |
| 26 | Cierre / Estado final | Dropdown |
| 27 | Días sin movimiento | Float |
| 28 | Vence hoy | Calculado |
| 29 | Score auto | Integer |
| 30 | Prioridad auto | Calculado |
| 31 | Alerta | Calculado |

### 2.1 Mapeo actual → blueprint (diff)

| Blueprint (recomendado) | Actual | Acción |
|-------------------------|--------|--------|
| ID | ID | OK |
| Fecha alta | Fecha | Renombrar a "Fecha alta" (opcional, mismo dato) |
| Cliente | Cliente | OK |
| Telefono | Teléfono | Mismo; normalizar nombre a "Telefono" si se desea consistencia |
| **Email** | — | **AÑADIR** |
| Ubicacion | Ubicación / Dirección | Renombrar o mantener; blueprint usa "Ubicacion" |
| Origen | Origen | OK; validación desde Parametros |
| Texto ingreso | Consulta / Pedido | Renombrar a "Texto ingreso" (mismo concepto) |
| **Resumen IA** | — | **AÑADIR** (derivado Motor_IA) |
| **Categoria sugerida** | — | **AÑADIR** (sugerido por IA) |
| Categoria | Categoría | OK; validación desde Parametros |
| **Tipo cliente sugerido** | — | **AÑADIR** (sugerido por IA) |
| Tipo cliente | Tipo de cliente | OK; validación desde Parametros |
| Necesita cotizacion | Necesita cotización | OK |
| Stock a validar | Stock a validar | OK |
| Responsable | Responsable | OK |
| Estado | Estado | OK; ampliar valores según blueprint §2.2 |
| Prioridad auto | Prioridad auto | OK (calculado) |
| Prioridad manual | Prioridad manual | OK |
| Urgencia | Urgencia | OK; añadir "Plazo personalizado" en Parametros |
| **Fecha limite objetivo** | — | **AÑADIR** (obligatoria si Urgencia = Plazo personalizado) |
| **Detalle plazo** | — | **AÑADIR** (texto libre para plazo custom) |
| Proxima accion | Próxima acción | OK |
| Fecha proxima accion | Fecha próxima acción | OK |
| Ultimo contacto | Último contacto | OK |
| Dias sin movimiento | Días sin movimiento | OK |
| Datos faltantes | Datos faltantes | OK |
| **Completitud** | — | **AÑADIR** (% o score) |
| Score auto | Score auto | OK |
| Alerta | Alerta | OK |
| **Presupuesto ID** | — | **AÑADIR** |
| **Presupuesto URL** | Cotización enviada / link | Unificar: usar Presupuesto URL (HYPERLINK v1) |
| **Presupuesto estado** | — | **AÑADIR** |
| **Fecha presupuesto** | — | **AÑADIR** |
| **Version** | — | **AÑADIR** (versión presupuesto) |
| Cierre / Estado final | Cierre / Estado final | OK |
| Observaciones | Observaciones | OK |
| — | Nivel de avance | Evaluar: mapear a Completitud o conservar como está |
| — | Monto estimado USD | Blueprint no lo lista en columnas core; opcional conservar |
| — | Probabilidad cierre | Blueprint no lo lista; opcional conservar |
| — | Resultado esperado | Evaluar: puede ser parte de Observaciones o Proxima accion |
| — | Vence hoy | Mantener como calculado (ya existe) |

### 2.2 Resumen de acciones CRM_Operativo

| Acción | Cantidad | Detalle |
|--------|----------|---------|
| **Añadir** | 10 | Email, Resumen IA, Categoria sugerida, Tipo cliente sugerido, Fecha limite objetivo, Detalle plazo, Completitud, Presupuesto ID, Presupuesto URL (o reemplazar Cotización enviada), Presupuesto estado, Fecha presupuesto, Version |
| **Renombrar** | 2–3 | Fecha → Fecha alta; Consulta / Pedido → Texto ingreso; Ubicación / Dirección → Ubicacion (opcional) |
| **Validación** | Todas dropdown | Asegurar que Origen, Categoría, Estado, Prioridad manual, Urgencia, Tipo cliente, Necesita cotización, Stock a validar, Cierre/Estado final, Responsable tomen valores desde **rangos de Parametros** (no listas fijas en la celda) |
| **Urgencia** | 1 regla | Si Urgencia = "Plazo personalizado", Fecha limite objetivo obligatoria; Detalle plazo libre. |

---

## 3. Parametros — estructura actual vs blueprint

**Blueprint:** Lista | Valor | Orden | Activo | Color_UI | Icono | Alias | Puntaje_Base.

**Acción:** Si Parametros hoy tiene otra estructura, añadir al menos las columnas: Lista, Valor, Orden, Activo. Opcional: Color_UI, Icono, Alias, Puntaje_Base. Poblar listas definitivas según blueprint §2.2 (Origen, Categoría, Estado, Prioridad manual, Urgencia con "Plazo personalizado", Tipo de cliente, Necesita cotización, Stock a validar, Cierre/Estado final, Responsable).

---

## 4. Dropdowns — valores actuales vs definitivos

Cargar en Parametros (lista **Valor** por **Lista**) los siguientes. Si hoy hay valores distintos, unificar a estos para alinear con blueprint y reporting.

| Lista | Valores definitivos (blueprint) |
|-------|----------------------------------|
| Origen | WhatsApp, Llamada, Instagram, Facebook, Web, Referido, Cliente recurrente, Visita local, Marketplace, Otro |
| Categoría | Accesorios, Paneles techo, Proyecto completo, Tornillería, Repuestos, Servicio / instalación, Otro |
| Estado | Nuevo, En análisis, Esperando info, Cotizando, Enviado presupuesto, En seguimiento, Ganado, Perdido, Pausado |
| Prioridad manual | Alta, Media, Baja, Sin prioridad |
| Urgencia | Hoy, 24 h, Esta semana, Este mes, Sin urgencia, **Plazo personalizado** |
| Tipo de cliente | Particular, Empresa, Arquitecto / estudio, Constructor / contratista, Distribuidor / revendedor, Instalador, Cliente existente, Sin clasificar |
| Necesita cotización | Sí, No, Ya enviada, No aplica |
| Stock a validar | Sí, No, Parcial, No aplica |
| Cierre / Estado final | Ganado, Perdido, Cancelado, Sin definir |
| Responsable | (dinámico; desde Parametros u otra hoja) |

---

## 5. Dashboard — layout actual vs blueprint

**Blueprint:** Fila 1 = Filtros (Responsable, Estado, Categoría, Origen, Urgencia, Fecha). Fila 2 = KPIs (Leads activos, Cotizaciones pendientes, Vencidos hoy, Sin movimiento, Ganados, Pipeline). Bloque izquierda = Panel Agente AI / botón sidebar. Centro = Tabla "Requiere acción" (Cliente, Estado, Prioridad, Urgencia, Próxima acción, Alerta, 📄). Derecha = Vencidos/urgentes, Faltan datos, Presupuestos enviados.

**Acción:** Revisar Dashboard actual y rediseñar hacia este layout; Panel Agente AI vía sidebar HTML (Apps Script), no grilla sobrecargada.

---

## 6. Motor_IA / Automatismos

**Actual:** Tab "Automatismos".  
**Blueprint:** Motor_IA como capa técnica (hoja semioculta o solo Apps Script): parseo, normalización, clasificación sugerida, score, reglas.

**Acción:** Decidir si Automatismos se renombra a Motor_IA y se usa solo para lógica técnica, o si la lógica se mueve a Apps Script y la hoja queda como referencia. Evitar duplicar lógica en celdas y en script.

---

## 7. Data_Base, Retomar y Cotización aceptada (flujos y movimientos)

**Blueprint (§6 y §7):**

| Regla | Descripción |
|-------|-------------|
| **Data_Base — cuándo entra** | Cuando se **cumplen todas las etapas del presupuesto**, la fila se mueve **automáticamente** a Data_Base (trigger o script: append en Data_Base, borrado/marcado en CRM_Operativo). |
| **Retomar** | Botón o columna/estado **"Retomar"** que mueve la fila **inmediatamente** de Data_Base de vuelta a la planilla **Administrador de cotizaciones** (CRM_Operativo). |
| **Cotización aceptada → Ventas** | Cuando la cotización es **aceptada**, la fila se mueve a la **pestaña Ventas**. **Recomendación:** misma planilla (mismo workbook), pestaña "Ventas" o "Ventas realizadas y entregadas" (un solo `BMC_SHEET_ID`, mismo patrón que marcar entregado). |

**Acción:** Crear Data_Base si no existe. Implementar trigger/función "presupuesto completo → Data_Base"; función/botón "Retomar" (Data_Base → CRM_Operativo); función/botón "Cotización aceptada" (origen → pestaña Ventas). Definir en Parametros o en script qué cuenta como "todas las etapas del presupuesto".

---

## 8. Orden sugerido de implementación (checklist)

- [ ] **Parametros:** Estructura (Lista, Valor, Orden, Activo, …). Poblar listas §4.
- [ ] **CRM_Operativo:** Añadir columnas nuevas (§2.2). Renombrar las indicadas. Configurar validación de datos desde rangos de Parametros.
- [ ] **Urgencia:** Añadir "Plazo personalizado" en Parametros. Crear columnas Fecha limite objetivo y Detalle plazo. Documentar regla: si Urgencia = Plazo personalizado → Fecha limite objetivo obligatoria.
- [ ] **Presupuesto:** Unificar en Presupuesto ID, Presupuesto URL, Presupuesto estado, Fecha presupuesto, Version. v1: HYPERLINK en Presupuesto URL.
- [ ] **Motor_IA / Automatismos:** Definir si hoja Motor_IA o solo Apps Script; implementar parseo/normalización/clasificación sugerida.
- [ ] **Dashboard:** Rediseñar según §5 (filtros, KPIs, bloques). Panel Agente AI vía sidebar HTML.
- [ ] **Data_Base:** Crear si no existe. Implementar **entrada automática** cuando presupuesto completo (trigger/script).
- [ ] **Retomar:** Añadir botón o columna/estado "Retomar"; script que mueva fila de Data_Base → CRM_Operativo (Administrador de cotizaciones).
- [ ] **Cotización aceptada → Ventas:** Implementar movimiento a pestaña Ventas (misma planilla recomendado). Definir si misma u otra planilla.
- [ ] **Triggers Apps Script:** onOpen (menú + sidebar), processLeadPayload, onEdit (columnas críticas), instalable horario, lógica presupuesto completo → Data_Base. Ver blueprint §9.

---

**Uso:** Con este map se puede aplicar los cambios en el [workbook](https://docs.google.com/spreadsheets/d/1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg/edit?gid=1427195280#gid=1427195280) en el orden §8. Para cambios de estructura vía API (añadir columnas, validaciones), usar skill `bmc-sheets-structure-editor` (Matias, Cursor) y `BMC_SHEET_ID`.
