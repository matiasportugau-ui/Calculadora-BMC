# Live DevTools / transcripción — cotas rojas desde paso 7 (Dimensiones)

**Fecha:** 2026-04-05  
**Entorno:** implementación en repo (verificación `npm run lint` + `npm test`). **MCP chrome-devtools:** no ejecutado en este hilo.

---

## 1. Tabla narrativa (U-xx)

| ID | ACTION (pedido) | EXPECT (intención) | Notas |
|----|-----------------|-------------------|--------|
| U-01 | Las líneas de cota rojas deben poder verse **desde el paso 7 de 13** del asistente | Al colocar techo en planta (dimensiones y pasos posteriores con visor 2D), el usuario ve **perímetro libre y encuentros** como en el croquis de referencia | Paso 7 **Solo techo** = `dimensiones` (`SOLO_TECHO_STEPS[6]`). Antes solo aparecían cotas con `estructuraHintsByGi` (paso **Estructura**). |

---

## 2. Tabla evidencia (E-xx)

| ID | Fuente | Hallazgo |
|----|--------|----------|
| E-01 | Código previo | `EstructuraGlobalExteriorOverlay` solo se montaba si `estructuraHintsByGi != null`; hints solo en `activeWizardStepId === "estructura"` en `PanelinCalculadoraV3_backup.jsx`. |
| E-02 | `constants.js` | `ROOF_2D_QUOTE_VISOR_STEP_IDS` incluye `dimensiones` como primer paso con visor 2D prioritario en el panel derecho. |

---

## 3. Cruce U → E

| User ID | Evidence IDs | ¿Coincide? |
|---------|--------------|------------|
| U-01 | E-01, E-02 | Sí: la carencia era el gate a `estructuraHintsByGi`; el visor 2D ya existe desde `dimensiones` vía `showRoof2dInQuoteVisor`. |

---

## 4. Plan de acción (ejecutado)

1. **Investigación:** `RoofPreview.jsx` separa overlay global (`EstructuraGlobalExteriorOverlay`) del overlay por zona (`EstructuraZonaOverlay`). Bastaba con activar el primero sin el segundo hasta Estructura.
2. **Cambio:** Nueva prop `showPlantaExteriorCotas` en `RoofPreview`; `plantaCotaChromeActive = hints || showPlantaExteriorCotas` para `viewBox`, leyenda breve y render del overlay global. `PanelinCalculadoraV3_backup.jsx`: `showPlantaExteriorCotas={showRoof2dInQuoteVisor}` en el `RoofPreview` del visor.
3. **Verificación:** `npm run lint`, `npm test` OK.

---

## 5. Criterios de aceptación

- [x] En modo vendedor, **Solo techo**, desde **Dimensiones** (7/13) y pasos siguientes donde el visor 2D está activo, se muestran **cotas rojas** (perímetro exterior + longitudes en encuentros) si hay geometría multi-segmento.
- [x] En paso **Estructura**, se mantiene el comportamiento anterior: cotas + líneas de apoyo + chip de fijación.
- [x] Pasos **anteriores** al visor 2D (`!showRoof2dInQuoteVisor`): sin cambio (preview embebido en columna izquierda sin la nueva prop).

---

## 6. Próxima corrida MCP (opcional)

Con `http://localhost:5173/` o prod: modo vendedor → Solo techo → avanzar hasta **Dimensiones** → confirmar capa `data-bmc-layer="estructura-global-cotas"` visible en snapshot y ausencia de líneas violetas hasta **Estructura**.
