# Modificaciones propuestas — organizadas (hasta 2026-04-16)

Referencia de **pasos** (escenario **Solo techo**, orden en asistente):

| # | `id` (stepId) | Etiqueta UI |
|---|----------------|-------------|
| 1 | `escenario` | Escenario de obra |
| 2 | `tipoAguas` | Caída del techo |
| 3 | `lista` | Lista de precios |
| 4 | `familia` | Familia panel techo |
| 5 | `espesor` | Espesor techo |
| 6 | `color` | Color techo |
| 7 | `dimensiones` | Dimensiones (metros o paneles) |
| 8 | `pendiente` | Pendiente |
| 9 | `estructura` | Estructura |
| 10 | `bordes` | Accesorios perimetrales |
| 11 | `selladores` | Selladores |
| 12 | `flete` | Flete |
| 13 | `proyecto` | Datos del proyecto |

**Visor 2D (`RoofPreview`)** en panel derecho: pasos en `ROOF_2D_QUOTE_VISOR_STEP_IDS` (desde `dimensiones` en adelante en solo techo, y otros en techo+fachada).  
**Overlay estructura / fijación en planta**: `ROOF_ESTRUCTURA_OVERLAY_STEP_IDS` (`estructura` → `proyecto` en tramo techo, etc.).

---

## 1. Producto / flujo cotización

| Propuesta | Paso principal | También aplica | Estado |
|-----------|----------------|----------------|--------|
| Lista de precios: evitar sensación de “un paso más” obligatorio; tras cotización terminada, **cambiar de lista con rapidez** (BMC / venta / …) sin rehacer todo el wizard. | `lista` (elección inicial) | Resumen / totales / post-wizard (definir dónde vive el control) | Pendiente — decisión producto (ver `USER-NAV-REPORT-2026-04-15-recorder-devtools-planta-lista.md`, NAV-01 / NAV-02) |

---

## 2. Planta 2D — legibilidad ISO / leyendas (sin solapes)

| Propuesta | Paso principal | También aplica | Estado |
|-----------|----------------|----------------|--------|
| Título **“PLANTA”** separado de la marca **Norte** (nunca superpuestos). | `dimensiones`, `pendiente`, `estructura`, `bordes`, `selladores`, `flete`, `proyecto` (donde haya `RoofPreview` con cotas) | Mismo visor en **Techo + Fachada** cuando el paso esté en `ROOF_2D_QUOTE_VISOR_STEP_IDS` | **Hecho** (`OrientationMark.jsx`, `RoofPreview.jsx`) |
| **Barra de escala** no superpuesta con **cadena mm / AU** bajo los paneles. | Igual que arriba | Igual | **Hecho** (`svgFrame` + posición de `ScaleBar`, `RoofPreview.jsx`) |
| Regla general: **nada superpuesto** en planta 2D (revisión continua si aparecen nuevas capas). | Pasos con planta + cotas | — | Parcial (revisar otros textos/capas si surgen) |

---

## 3. Multizona — encuentros (línea panel–panel / “tramos”)

*Capa distinta de los **dots de fijación**.*

| Propuesta | Paso principal | También aplica | Estado |
|-----------|----------------|----------------|--------|
| **Encuentro** entre panel y panel (ej. junta vertical entre panel 2 y 3 como **arista de encuentro** en planta) donde **no aplican perfiles**: **no debe ser seleccionable** (o no debe abrir flujo de perfil/BOM como un borde con accesorio). | `dimensiones`, `pendiente` (planta editable) | `estructura`, `bordes` si la misma geometría sigue visible | **Pendiente** — aclarar regla por tipo de encuentro en modelo (`encounterByPair`, segmentos) |
| Tramos de encuentro: **perfil en tramo sobresaliente**, `effectiveBorders` por tramo, paridad **3D** con segmentos — backlog técnico ya identificado en conversación / informes multizona. | Misma planta | 3D si aplica | **Pendiente** |

---

## 4. Estructura + fijación (combinada) — UX puntero

| Propuesta | Paso principal | También aplica | Estado |
|-----------|----------------|----------------|--------|
| **Todos** los puntos de fijación (dots) deben seguir **seleccionables y apagables**; **no** bloquear juntas por “perfil entre paños” en la grilla de dots (eso fue un malentendido; **revertido**). | `estructura` (overlay combinada) | `bordes`, `selladores`, `flete`, `proyecto` mientras `ROOF_ESTRUCTURA_OVERLAY_STEP_IDS` | Comportamiento restaurado a “todo apagable” |
| **Material de estructura** (apoyos / líneas que soportan el panel): más **fácil de elegir**; al hacerlo **no** deben **apagarse** las fijaciones por conflicto de clic (capas, hit targets, modo “solo estructura”, o UI separada). | **`estructura`** | Pasos posteriores con mismo overlay si el problema persiste | **Pendiente** |

---

## 5. Calidad / herramientas (no es un paso del wizard)

| Propuesta | Paso | Estado |
|-----------|------|--------|
| Selectores estables para Recorder / E2E (`data-testid` o roles, evitar `#:r1:` MUI). | Transversal (todos los pasos) | Pendiente (NAV-04 en USER-NAV-REPORT) |
| Informe **USER-NAV** desde Recorder + narrativa DevTools. | Documentación | Hecho (`USER-NAV-REPORT-2026-04-15-recorder-devtools-planta-lista.md`) |

---

## 6. Resumen por paso (Solo techo) — qué toca cada uno

| Paso | Modificaciones que lo involucran |
|------|-----------------------------------|
| `lista` | Lista precios post-cotización / menos fricción (producto). |
| `dimensiones` | Planta 2D solapes (hecho); encuentros no seleccionables sin perfil (pendiente); visor Recorder. |
| `pendiente` | Igual planta + encuentros. |
| `estructura` | UX material estructura vs dots (pendiente); overlay fijación; encuentros si la planta sigue activa. |
| `bordes` | Planta + bordes; encuentros; overlay si aplica. |
| `selladores` … `proyecto` | Planta 2D cotas/escala (hecho); overlay estructura hasta proyecto. |

---

## 7. Escenarios distintos de “Solo techo”

- **Solo fachada / Cámara / Techo + Fachada**: mismas **ideas** (lista, pasos con `lista`, pasos con `estructura`, pasos con planta) pero con **otra lista de `wizardSteps`** en `constants.js` — asignar el **mismo tipo** de modificación al paso homónimo (`lista`, `dimensiones`, `estructura`, …) o al paso equivalente (`dimensiones_pared`, etc.).

---

*Última actualización: 2026-04-16. Alinear con `docs/team/PROJECT-STATE.md` cuando se implementen bloques.*
