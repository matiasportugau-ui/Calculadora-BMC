# Prototipo HTML “Panelin V3.2 Pro” vs Calculadora BMC (repo)

**Fecha:** 2026-04-08  
**Alcance:** Comparativa funcional y técnica entre un demo en navegador (HTML + Babel + CDN) y la calculadora canónica en `src/components/PanelinCalculadoraV3_backup.jsx` (cargada desde `src/App.jsx`). Incluye auditoría del wizard techo, especificación de mejora “largo global/local”, decisión Wolfboard, lista de no hacer, backlog con criterios de aceptación y checklist de regresión QA.

**Referencias de código:** `src/utils/calculations.js` (`calcFactorPendiente`, `calcLargoRealFromModo`, `calcAutoportancia`), `src/utils/roofEncounterModel.js`, `src/components/RoofPreview.jsx`, `src/data/constants.js` (`SCENARIOS_DEF.solo_techo.wizardSteps`).

---

## 1. Matriz funcional (Prototipo / App / Acción)

| Capacidad | Prototipo HTML | Calculadora BMC | Acción |
|-----------|----------------|-----------------|--------|
| Multi-“agua” / zonas | `faldones[]` con nombre y `segments[]` | `techo.zonas[]` + tipo de aguas (`tipoAguas`), planta multizona | **Mantener modelo app.** Inspiración UX: tabs tipo faldón si se quiere densidad (diferido). |
| Tramos count × length | `segments[{ id, count, length }]` | Por zona: largo/ancho o modo paneles (`normalizarMedida`); no es el mismo array de segmentos | **No copiar modelo segmentos** sin mapeo explícito a `zonas`. Atajo “extraer 1 panel” requiere diseño (diferido). |
| Pendiente / largo real | `calcFactorPendiente` inline (1/cos, tope 89°) | `calcFactorPendiente`, `calcLargoRealFromModo` (incluye modos pendiente) | **No duplicar** fórmulas: usar solo `calculations.js`. |
| Autoportancia | Mapa fijo mm → vano | `calcAutoportancia(panel, espesor, largo)` con `esp.ap` del panel | **No portar** mapa del HTML. |
| BOM / fijaciones | Placeholder (`paneles * 4`, largo max = primer tramo) | BOM real, varilla/perímetro, `computeRoofEstructuraHintsByGi`, etc. | **No copiar** reglas del prototipo. |
| Encuentros / accesorio superior | Selector ACC-C/P/K/D + barra de color | `roofEncounterModel`, bordes/encuentros en preview y cotización | **Adoptar idea UX:** resumen visual ligado a datos ya resueltos (diferido; evitar segundo catálogo). |
| Precios | `precioM2` manual | MATRIZ / `getPricing`, costeo `bomCosting.js` | **Mantener app.** |
| PDF / Drive / historial | Mock `setTimeout` + drawer | `budgetLog`, `googleDrive`, `pdfGenerator`, etc. | **Mantener app.** |
| Visor 2D/3D | Strip proporcional simple | `RoofPreview`, cotas, estructura, encuentros | **Mantener app.** Mejora: hover lista ↔ zona si aplica (diferido). |
| Chat / API | No | Panelin chat, rutas API | **N/A** prototipo. |
| Edición largo global/local | Toggle que aplica largo a todos los segmentos de la faldón activa | No equivalente directo (una fila de dimensiones por zona en wizard) | **Especificado** en §4 (implementación futura). |

---

## 2. Lista explícita de “no hacer”

1. **No** volver a definir `calcFactorPendiente` en la UI o en otro módulo paralelo; importar desde `src/utils/calculations.js`.
2. **No** introducir el mapa de autoportancia por espesor del HTML (30/50/80/100 fijo) como fuente de verdad; usar `calcAutoportancia` y datos de panel/MATRIZ.
3. **No** usar `fijaciones = totalPaneles * 4` ni “largo real max = primer tramo” como reglas de negocio.
4. **No** desacoplar encuentros del modelo existente: cualquier chip/barra visual debe leer el mismo estado que `roofEncounterModel` / preview de zona.

---

## 3. Auditoría: wizard Solo techo y visor (`PanelinCalculadoraV3_backup.jsx` + `RoofPreview.jsx`)

### 3.1 Wizard “Solo techo” (pasos canónicos)

Definidos en `src/data/constants.js` → `SCENARIOS_DEF` id `solo_techo` → `wizardSteps`:

1. `escenario` — Escenario de obra  
2. `tipoAguas` — Caída del techo  
3. `lista` — Lista de precios  
4. `familia` — Familia panel techo  
5. `espesor` — Espesor techo  
6. `color` — Color techo  
7. `dimensiones` — Dimensiones (metros o paneles)  
8. `pendiente` — Pendiente  
9. `estructura` — Estructura  
10. `bordes` — Accesorios perimetrales  
11. `selladores` — Selladores  
12. `flete` — Flete  
13. `proyecto` — Datos del proyecto  

**Contraste con el prototipo:** el HTML concentra parámetros globales + lista de tramos + BOM en una sola pantalla. La app separa el flujo en pasos y añade lista MATRIZ, estructura, bordes, selladores y flete. **Brecha UX:** el prototipo no tiene equivalente a pasos 9–12; la app no tiene, hoy, el **toggle global/local de largos** ni la **tira proporcional** de segmentos del HTML.

### 3.2 Hover y realce cruzado (lista ↔ visor)

Hallazgos por inspección de código:

- **BOM / tabla de ítems:** existe hover por fila (`hoveredIdx` / `setHoveredIdx`) para realce de fila; no implica sincronización con el SVG del techo.
- **Encuentros compartidos en preview:** `hoveredKey` / `setHoveredKey` en interacción con lados compartidos (p. ej. pointer over en segmentos clicables).
- **Indicadores del wizard:** `hoveredDotIdx` en los puntos de paso (tooltips de paso), no ligados a `gi` de zona.
- **`RoofPreview.jsx`:** `hoverDim` para tooltip de medidas al hover en planta; hover de puntos de fijación → BOM (`FijacionBomHoverPopover` / capas documentadas en comentarios del archivo).

**Conclusión:** **No hay** hoy un canal único “fila de dimensión de zona `gi` ↔ polígono/resaltado de esa zona en el visor” comparable al prototipo (segmento en lista + strip visual). Implementarlo implicaría props compartidas (p. ej. `highlightedZonaGi`) entre el panel izquierdo del paso `dimensiones` y `RoofPreview`, más reglas en multizona para no solapar con `hoverDim`.

### 3.3 Modelo de datos vs “segmentos” del prototipo

La app modela **zonas** con dimensiones y modo metro/paneles, no un array arbitrario de `{ count, length }` por faldón. Cualquier “extraer 1 panel” o edición masiva de largos debe definirse sobre **`techo.zonas[gi]`** y las funciones existentes (`setTecho`, `updateZonaPreview`, etc.), no importar el estado del HTML tal cual.

---

## 4. Especificación: toggle largo global / local (sin cambiar `calculations.js`)

**Objetivo:** Reducir clics cuando varias zonas o varias filas de entrada deban compartir el mismo **largo proyectado** en el paso de dimensiones, **sin** alterar `calcFactorPendiente` ni `calcLargoRealFromModo`.

**Alcance sugerido (fase 1):**

- **Local (default):** Comportamiento actual: cada zona conserva su `largo` (o derivación desde paneles) de forma independiente.
- **Global:** Un único valor de largo (número en metros o flujo equivalente al input actual) se propaga a **todas las zonas del techo** que deban participar (definir si incluye anexos laterales o solo “aguas” principales según `tipoAguas` y reglas de negocio).

**Implementación (solo capa UI / estado):**

1. Añadir estado de UI `dimensionesLargoEditMode: 'local' | 'global'` en el contenedor del wizard (mismo ámbito que `setTecho`), persistencia opcional vía `serializeProject` solo si producto lo pide.
2. En paso `dimensiones`, al cambiar largo con modo **global**:
   - `setTecho(t => ({ ...t, zonas: t.zonas.map(z => ({ ...z, largo: nuevoLargo })) }))`  
   - Ajustar si el proyecto distingue zonas “anexo” que no deben recibir el largo (filtrar por índice o flag si existe en el modelo).
3. Modo **paneles:** Si el usuario edita en modo paneles, definir si “global” sincroniza **cantidad de paneles** o **largo resultante** tras `normalizarMedida`; documentar la regla en UI (“Aplica largo en m a todas las zonas”).
4. **Validación:** Tras aplicar global, totales de m² y `calcAutoportancia` por zona deben coincidir con el cálculo que se obtendría editando cada zona manualmente al mismo valor.

**Fuera de alcance de esta especificación:** Cambiar fórmulas de pendiente o autoportancia.

---

## 5. Decisión: Wolfboard vs calculadora principal

**Decisión (2026-04-08):** Priorizar **mejoras en la calculadora principal** (`PanelinCalculadoraV3_backup.jsx` + `RoofPreview.jsx`) que reutilicen `calculations.js` y el estado `techo` existente.

**Rationale:**

- Una ruta nueva `/wolfboard/zona-rapida` con un segundo flujo reducido duplicaría mantenimiento (dos UIs, un riesgo de divergencia de reglas) salvo que se comparta el **mismo** estado y navegación hacia el wizard completo.
- `BmcWolfboardHub.jsx` puede seguir como hub de módulos; la tarjeta “Próximo módulo” puede reservarse para un **enlace profundo** a la calculadora con query (p. ej. `/?scenario=solo_techo&wizard=1`) cuando exista, en lugar de un motor paralelo.

**Siguiente paso opcional (diferido):** Si se requiere demo ultraligera, implementar solo **shell** de ruta que renderice el mismo componente calculadora con props/query de “solo pasos techo” — sin duplicar lógica de BOM.

---

## 6. Backlog sugerido (con criterios de aceptación)

| ID | Ítem | Criterios de aceptación (resumen) |
|----|------|-----------------------------------|
| B1 | Toggle largo global/local (§4) | Con modo global, todas las zonas elegibles muestran el mismo `largo`; BOM y m² iguales a edición manual equivalente; `npm run lint` OK. |
| B2 | Hover dimensión ↔ resalte zona en visor | Al pasar el mouse por la fila de la zona `gi` en paso dimensiones, el visor 2D resalta esa zona (y viceversa si aplica); no rompe `hoverDim` ni encuentros. |
| B3 | Atajo “extraer 1 panel” | Solo si el modelo admite división de cantidad sin violar reglas de ancho/paneles; tests o checklist manual documentado. |
| B4 | Barra resumen encuentro (estilo prototipo) | Muestra etiqueta/color según encuentro **ya** guardado en preview; no introduce catálogo distinto al de producción. |
| B5 | Copy resumen proyecto (footer tipo prototipo) | Texto con m² totales, número de aguas/zonas y pendiente tomados de estado real; visible en paso revisión o footer acordado. |

---

## 7. Checklist de regresión QA (tras cambios UI en techo)

Ejecutar después de tocar wizard techo, `RoofPreview` o serialización de proyecto.

- [ ] **Lint:** `npm run lint`
- [ ] **Tests unitarios:** `npm test`
- [ ] **Escenario Solo techo:** completar wizard 13 pasos sin errores en consola
- [ ] **Una agua:** dimensiones + pendiente; verificar m² en resumen y coherencia con `calcLargoRealFromModo` en copy si existe
- [ ] **Varias aguas / multizona:** planta, cotas exteriores, paso Estructura; puntos de fijación y hover BOM
- [ ] **Autoportancia:** zona con largo > `ap`; debe mostrar advertencia coherente con `calcAutoportancia` (no basada en mapa del HTML)
- [ ] **PDF / impresión (si tocó flujo cotización):** generar vista previa una vez
- [ ] **Proyecto guardado:** abrir/cargar JSON o flujo Drive si se tocó `serializeProject` / `deserializeProject`

---

## 8. Historial de documento

| Fecha | Cambio |
|-------|--------|
| 2026-04-08 | Versión inicial: matriz, no hacer, auditoría, spec global/local, decisión Wolfboard, backlog, QA. |
