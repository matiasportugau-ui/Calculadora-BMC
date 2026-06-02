# Panel Product Viz Roadmap — FreeCAD Evaluation (2026-06)

**Fuente de evaluación principal:** Videos compartidos por el usuario:
- 8LBIMiYYnRs (serie Planos de Vivienda con FreeCAD): 2D CAD profesional (TechDraw: grosores, hatching, cotas, anotaciones limpias).
- IV-nv9ygZPM: FreeCAD BIM Architecture (objetos 3D paramétricos, modelado de edificios).
- RQW723n3DkU: FreeCAD Python API (automatización: datos/CSV → geometría programática, sin GUI).
- dQyLqMLfluw: Estado de la BIM Library (componentes reutilizables paramétricos listos para usar).

**Objetivo general:** Elevar la renderización 2D/3D de productos (paneles ISODEC, ISOROOF, variantes pared) de la calculadora a nivel profesional CAD/BIM, coherente con el motor de cálculo, usable en wizard/visor/PDF/cliente, y con espíritu de automatización.

El especialista `bmc-panel-product-visualization-specialist` (con skill + rúbrica 100 pts) es el dueño de esta área. Complementa `roofplan-architect` (ensamble de cubierta) y `bmc-roof-2d-viewer-specialist`.

## Principios de priorización
- **Impacto usuario primero**: Lo que ve el vendedor/cliente en el flujo principal (selección familia/espesor → visor derecho → estructura → PDF final).
- **Quick wins visibles**: 2D técnico (inspirado en TechDraw) da "calidad profesional" inmediato con bajo riesgo (SVG puro).
- **3D después**: Volumetría + perfil real es el salto grande para "renderización 3D", pero depende de specs + más cambios en R3F.
- **Fundación data-driven**: Todo debe venir del mismo specs (evitar drift con calc/au/espesor/fam).
- **Gates siempre**: lint → test (si aplica) → manual browser (pasos clave + móvil) + PDF gen → re-score rúbrica del especialista → gate:local:full para cambios grandes.
- **Reutilizar**: Estilos roofplan (temas, tipografía, data-bmc-*), capture pipeline existente, carruseles Shopify actuales.
- **No over-engineer**: Mantener ligero (sin nuevos deps pesados). Pensar en futuro Python/FreeCADCmd para exports ricos.

## Fases recomendadas (orden de implementación para mejor resultado)

### Fase 1: 2D Técnico Profesional Visible Ya (Máximo impacto rápido, 1-2 sesiones)
**Por qué primero**: Los videos enfatizan planos 2D de calidad (TechDraw). El usuario ve secciones constructivas reales (capas, espesores, perfiles) en el flujo de selección y visor. Coincide con "planos de vivienda" y da feeling de herramienta seria/pro.

**Entregables clave**:
- Specs de construcción sólidas (ya hecho: `panelConstructionSpecs.js` con datos de fichas + au/espesores).
- Componente `PanelCrossSection.jsx` pulido (ya base hecho; mejorar: más detalles de perfil real, múltiples vistas opcionales, mejor title block, soporte pared).
- Exposición en UX principal:
  - Ya integrado en `PanelFamilyShowcase` (preview live con espesor actual).
  - **Agregar acordeón "Sección constructiva 2D / Ficha visual del panel"** en `QuoteVisualVisor.jsx` (al lado o debajo de Visualización 3D, o reemplazando "Próximamente" en pasos relevantes).
  - Opcional: en pasos de espesor/familia/color, o siempre visible en visor.
- PDF: Agregar captura de sección 2D de producto en `buildSnapshotSectionHtml` y apéndice (similar a "Plano 2D de cubierta").
- Coherencia: Pasar `espesorMm`, `techoColor` etc. correctamente; preview actualiza live.
- Rúbrica: Correr y documentar score post-fase (enfocar dominio 3 "2D Technical Product Drawings").

**Verificación**:
- En wizard: elegir familia + cambiar espesor/color → sección se actualiza con capas correctas y dims.
- Visor + PDF generado muestra la sección limpia, con hatching, cotas, sin solapes.
- Móvil legible.
- Re-score rúbrica (objetivo: subir dominio 2D a 13+/15).

**Esfuerzo estimado**: Bajo-medio. Ya hay base implementada.

### Fase 2: 3D Volumétrico + Viewer de Producto (Salto grande en "renderización 3D")
**Por qué segundo**: Una vez que 2D técnico está visible y confiable, atacar el "3D se ve plano". Videos de BIM dan el modelo: objetos con espesor real, perfiles, propiedades.

**Entregables**:
- Usar `getPanelConstruction` en `RoofPanelRealisticScene.jsx` (y RoofBorderCanvas si aplica) para dar **thickness real**:
  - Top + bottom faces + caras laterales/laps.
  - Para Isoroof: geometría de nervadura/rib (usar profileDims o simple extrude/Shape).
- Nuevo o mejorado **PanelProduct3DViewer** (o extensión): 
  - Vista aislada de un módulo representativo del panel (1-2 au × largo corto).
  - Thickness visible, opción de corte/sección (cut plane o toggle liner).
  - Anotaciones (drei Html): familia, espesor, au, materiales clave.
  - Controles Orbit + reset + "ver en ensamble".
  - Soporte color/familia live.
- Integración:
  - En `PanelFamilyShowcase`: reemplazar/augmentar imagen/Sketchfab con el 3D viewer pequeño (o toggle 2D/3D).
  - En QuoteVisualVisor: nuevo sub-acordeón o tab "Producto 3D" (además del ensamble).
  - Opcional: en pasos de selección.
- Specs: Extender `panelConstructionSpecs` con más props BIM-like (si hay en fichas: R-value, peso, fuego, etc.).
- Rúbrica: Mejorar dominios 1 (Geometric Fidelity) y 4 (3D Product Viewer).

**Verificación**:
- 3D muestra espesor proporcional (50mm vs 80mm se ve distinto).
- Perfil Isoroof se ve nervado (no plano).
- Viewer aislado usable, sin artifacts, mobile ok.
- Coherencia con 2D section y planta strips.
- PDF captura del nuevo 3D producto si se implementa snapshot.
- Re-score rúbrica.

**Esfuerzo**: Medio-alto (cambios en geometría R3F, nuevo componente 3D).

**Dependencias**: Fase 1 specs + componente 2D (para coherencia visual).

### Fase 3: Integración Completa + PDF/Cliente + Coherencia End-to-End
- Exponer secciones 2D + 3D producto en:
  - Más lugares del wizard/visor.
  - `quotationViews.js` / client visual HTML.
  - PDFs ricos (por ítem de BOM o apéndice "Fichas de productos").
- Captura robusta (asegurar `data-bmc-capture` en viewers aislados).
- Soporte pared/fachada (PANELS_PARED).
- Alinear nomenclatura y tooltips con lenguaje técnico (inspirado en BIM/FreeCAD: "núcleo", "chapa", "engrape", etc.).
- Performance: LOD para muchos paneles, texturas optimizadas.
- Rúbrica completa + fixes de items bajos.

**Esfuerzo**: Medio.

### Fase 4: Automatización, Assets & Avanzado (Estilo Python API + BIM Library)
- Scripts de generación (inspirado en RQW723n3DkU):
  - JS/Node tool o Python (usando svgwrite o similar) que dado familia + espesor + datos de quote genera SVG 2D de alta fidelidad (TechDraw-like, con title block, múltiples vistas).
  - Opcional: Integrar FreeCADCmd (headless) si se instala en CI/dev (para DXF, vistas 3D más precisas, o exports).
  - Batch para presupuestos: generar fichas visuales para todos los ítems.
- Asset pipeline:
  - Mejor PBR (normal maps para perfiles nervados, roughness específicos).
  - Curar o generar texturas para más variantes de color.
  - Mejorar integración Sketchfab (si envs disponibles) como fallback o detalle extra.
- BIM Library style: Hacer que `panelConstructionSpecs` sea más "queryable" (props extras, performance data desde fichas/Matriz).
- Futuro: Export glTF paramétrico simple o viewer más avanzado.
- Documentación: knowledge doc detallado, ejemplos en `docs/team/visual/`.
- Rúbrica final + mantenimiento.

**Esfuerzo**: Variable (puede ser paralelo o post Fase 2/3). Alto ROI a largo plazo para calidad consistente y velocidad de cotizaciones.

## Próximos pasos recomendados (ahora)
1. **Ejecutar Fase 1 restante** (integrar sección 2D en QuoteVisualVisor + PDF snapshots). Delegar al especialista.
2. Correr rúbrica post-Fase 1 y documentar.
3. Actualizar PROJECT-STATE + handoff.
4. Una vez visible el 2D CAD, pasar a Fase 2 (3D volumétrico).

**Cómo usar al especialista**:
- "Usa el bmc-panel-product-visualization-specialist para [fase/tarea específica, ej. 'agregar acordeón de sección 2D en QuoteVisualVisor usando el componente actual y respetando el layout actual del visor']. Incluye los videos FreeCAD como referencia."
- Siempre: score rúbrica, gates, actualizar estado.

**Archivos clave actuales (post Fase 0/1 inicial)**:
- Specs + componente base: `src/data/panelConstructionSpecs.js`, `src/components/panelViz/PanelCrossSection.jsx`
- Integración showcase + espesor step + visor: `src/components/PanelFamilyShowcase.jsx`, `src/components/PanelinCalculadoraV3_backup.jsx` (espesor preview + call), `src/components/QuoteVisualVisor.jsx` (nuevo acordeón Sección 2D).
- Agente: `.cursor/agents/bmc-panel-product-visualization-specialist.md` + skill en `.cursor/skills/...`
- Roadmap: `docs/team/visual/PANEL-PRODUCT-VIZ-ROADMAP-FROM-FREECAD.md`
- Previsualizaciones generadas (mockups IA de interfaz propuesta): session images 1-5 (ver descripciones abajo).
- Rúbrica: `.cursor/skills/panel-product-visualization-specialist/reference.md`

**Previsualizaciones de interfaz (generadas con image_gen basadas en UI real del proyecto - estilo limpio Apple-like, acentos #0071E3, tarjetas blancas, SF Pro):**
- Imagen 1 (visor): QuoteVisualVisor con acordeón "Sección 2D del panel" abierto mostrando corte técnico + hint de 3D producto.
- Imagen 2 (familia): Paso familia con grid de familias + sección 2D CAD abajo en el catálogo.
- Imagen 3 (PDF): Página PDF con sección "Secciones técnicas de productos" + dos cortes 2D + pequeño 3D isométrico.
- Imagen 4 (ficha standalone): Modal "Ficha visual del producto" con 3D volumétrico + vistas 2D múltiples + specs + selector color live.
- Imagen 5 (antes/después 3D): Comparativa ensamble actual (plano) vs propuesto (volumétrico con espesor y perfiles nervados).

Usar estas como referencia visual para implementación. El especialista puede refinar prompts o editar imágenes.

Mantener todo data-driven desde specs. Priorizar experiencia en el flujo de cotización sobre perfección interna.

**Fecha**: 2026-06 (post evaluación de videos). Revisar después de cada fase.
