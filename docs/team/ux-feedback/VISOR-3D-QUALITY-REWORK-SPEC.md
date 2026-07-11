# Spec — Rework del Visor 3D (paneles reales, bordes/perfiles, continuidad multi-zona)

> Este documento reemplaza el plan de sesión anterior ("Dedicated feature flag for the Visor 3D",
> **ya shippeado en PR #669+#670**). Es una tarea completamente distinta: el flag ya existe
> y funciona; esta spec ataca la CALIDAD del render que el flag revela.
>
> **Fase 0 de esta spec ya está shippeada** — ver "Cambios recientes" en `PROJECT-STATE.md`
> (fix del bug de detección de encuentros en `RoofPanelRealisticScene.jsx`). El resto (Fases
> 1-4) depende de sourcing de assets 3D externos y de un spike empírico de trigonometría, y
> queda documentado acá para cuando se retome.

## Contexto

El flag `?visor3d=1` (PR #669) expuso `Roof3DSection`/`RoofPanelRealisticScene.jsx` para revisión,
y el resultado se juzgó **lejos de aceptable** en 3 puntos concretos, confirmados uno por uno contra
el código real (no son apreciaciones — cada uno tiene cita exacta de archivo:línea):

1. **Sin volumen real** — cada panel es un `<planeGeometry>` chato con una foto pegada.
2. **Sin bordes/perfiles** — no se renderiza gotero/babeta/canalón, y el componente ni siquiera
   recibe esa data como prop.
3. **Zonas flotando sin tocarse** — dos zonas con un encuentro real (ej. Cumbrera) aparecen como
   cuerpos separados, con hueco y desnivel de altura que no corresponde.

Se investigó a fondo (2 agentes de exploración + verificación manual de las citas más importantes)
antes de diseñar la solución (1 agente de diseño arquitectónico + verificación manual de sus dos
afirmaciones más críticas). Decisiones ya tomadas con el stakeholder:

- **Paneles: modelos 3D reales (glTF) por familia**, no geometría procedural ni truco de normal-map.
- **Sourcing de esos modelos: la spec debe proponer opciones concretas** (no asumir que ya existen).
- **Regla de "soldado" entre zonas: el gesto de arrastrar una zona hasta tocar otra YA es la
  señal de intención de unión** (no un pick separado en un menú) — y **el lado por el que se tocan
  determina qué tipo de encuentro tiene sentido físico** (lateral → pretil/desnivel; frente-fondo →
  cumbrera). Verificado: esto es coherente con la geometría que `findEncounters` ya calcula hoy
  (`orientation: "vertical"|"horizontal"`), y con `docs/team/ux-feedback/ROOF-ENCOUNTER-LOGIC-SPEC.md`
  que explícitamente deja "reglas automáticas por geometría" como trabajo futuro no implementado.

---

## 0. Contrato de coordenadas compartido (leer antes de las 3 secciones)

`buildZoneLayoutsForRoof3d` (`src/utils/roofZoneLayouts3d.js:17-34`) es la única fuente de verdad
de cómo un rect de planta `(x,y,w,h)` se convierte en transform 3D:

```
ox = r.x
oy = r.y * sin(θ)
oz = (r.y + r.h) * cos(θ)      // usa el borde FRENTE, no r.y
```

El borde **fondo** de cada malla (`v=0`) siempre cae exacto en `(oy,oz)` del grupo, sin importar
`slopeMark`; el borde **frente** (`v=h`) es el único que se mueve al invertir `slopeMark`. Esto
implica algo importante para la Sección 3: **altura/profundidad (Y,Z) dependen solo del plan-Y
(`r.y`, `r.h`), nunca de plan-X.** Dos zonas lado a lado en X solo son coplanares en todo el borde
compartido si tienen el mismo `r.y`/`largo`/`slopeMark` — un ridge/cumbrera real necesita
apilamiento **frente-a-fondo en Y** (con `slopeMark` invertido en una de las dos), no adyacencia en X.

Todo lo que toque posicionamiento de zonas (paneles, bordes, líneas de encuentro) **debe reusar
estas mismas fórmulas** — nada de que cada workstream derive su propia matemática de posición.

### Restricción crítica: estas utilidades ya se usan en producción, no solo en el Visor 3D beta

**Verificado en código** (`PanelinCalculadoraV3_backup.jsx:1301`): `buildZoneLayoutsForRoof3d` y
`zonasToPlantRectsWithAutoGap` también alimentan `RoofBorderSelector` — el selector de bordes 3D
interactivo que está **siempre montado en producción**, no gateado por `?visor3d=1`. También
alimentan el plano 2D/PDF (`quotationViews.js`). **Cualquier cambio de posicionamiento debe vivir en
una función NUEVA y paralela** (`resolveRoofZoneLayout3d` en el mismo archivo), sin tocar
`applyLateralAnnexLayout`/`zonasToPlantRectsWithAutoGap` in place — modificarlas ahí rompería
`RoofBorderSelector` y el plano 2D para todos los usuarios, fuera del alcance de esta tarea. Se
acepta algo de duplicación como precio de este aislamiento (documentado como deuda técnica en
Riesgos, no como descuido).

---

## 1. Paneles con volumen real (glTF)

### 1.1 Estado actual (confirmado)
`RoofStripMesh` (`RoofPanelRealisticScene.jsx:168-224`) arma cada franja como
`<mesh><planeGeometry args={[stripW, largo]} /></mesh>` (línea 221) con una foto de catálogo real
tileada encima (`useTexture`, línea 310). Cero geometría de nervadura en todo el repo (grep
exhaustivo). Cero assets `.glb/.gltf/.obj` existentes; `useGLTF` nunca importado. `thicknessMm` está
definido en `roofPanelVisualProfiles.js` pero **nunca se lee** en la escena.

### 1.2 Pipeline reusable ya existente (no se toca, se conecta)
- `src/data/roofPanelMapUrl.js` → `getRoofPanelMapUrl(familiaKey, techoColor)` resuelve una foto real
  de catálogo (bmcuruguay.com.uy vía Shopify CDN) desde `src/data/quoteVisorShopifyFamilies.json`
  (777 líneas, fotos reales por familia+color).
- `src/data/roofPanelVisualProfiles.js` → `roughness`/`metalness`/`thicknessMm` por familia.
- Esto sigue siendo la fuente del **material/diffuse map** de la geometría nueva — cero assets
  nuevos por color, solo por forma de perfil.

### 1.3 Arquitectura propuesta — ACTUALIZADO 2026-07-11: procedural desde cotas reales, no glTF externo

**Cambio de enfoque respecto a la versión original de esta sección** (ver §1.4 para el hallazgo que
lo motiva): en vez de depender de conseguir un `.glb` externo, se construye la geometría con
`THREE.ExtrudeGeometry` desde una sección 2D real — **la misma técnica ya especificada en la
Sección 2 para los perfiles de borde**, aplicada ahora también al panel. Sin loader nuevo, sin
Draco, sin hosting de assets binarios, sin dependencia externa:

- **Sección 2D real para ISOROOF (trapezoidal):** plano técnico acotado de BMC (`isoroof-
  cross-section-dimensioned.png`, ver §1.4) da la unidad repetible exacta: ancho total 1000mm,
  nervadura central 26mm de ancho × 40mm de alto, paso entre nervaduras 72mm. Se define un
  `THREE.Shape` con esa unidad y se repite a lo largo del `au` de la zona.
- **Sección 2D para ISODEC (engrafado):** panel mayormente plano (espesor real 50/80/120mm por
  `PANELS_TECHO.esp`) con una costura/gancho angosto solo en los bordes cada `au=1.12m` — visible
  en el "Detalle engrafe" de la ficha técnica. Geometría más simple que ISOROOF; la única cota sin
  número exacto es el alto de la costura — estimarla ahí (marcado explícitamente como estimación)
  tiene bajo riesgo visual dado que el resto del panel es plano.
- **Nuevo archivo `src/data/roofPanelCrossSections.js`** (mismo patrón que
  `roofPerfilCrossSections.js` de la Sección 2) — define la unidad repetible por forma de familia
  (`ISOROOF`, `ISODEC`, `ISODEC_PIR`, `ISOROOF_COLONIAL`) en mm reales, más las cotas generales
  (`au`, `esp`) ya existentes en `PANELS_TECHO` para escalar correctamente.
- **Tiling/escala:** `ExtrudeGeometry` de la unidad repetible, instanciada con `THREE.InstancedMesh`
  a lo largo de `largo` — mismo presupuesto y razonamiento de performance que la versión anterior de
  esta sección (≤1500 triángulos por tile, una `InstancedMesh` por combinación familia-forma+color,
  agrupando todas las franjas de una zona).
- **Color/textura:** sin cambios — sigue usando `getRoofPanelMapUrl`/`getRoofPanelVisualProfile`
  como diffuse map sobre la geometría real, igual que ya estaba planeado.
- **Si más adelante aparece un archivo 3D fuente real** (Opción D en §1.4, o Kingspan confirmado por
  el proveedor), se puede reemplazar la sección paramétrica por geometría importada sin cambiar el
  resto de la arquitectura (mismo punto de inyección: una función que devuelve geometría de tile) —
  no es una apuesta irreversible.

### 1.4 De dónde salen los modelos reales — ACTUALIZADO 2026-07-11: BMC/su proveedor YA TIENE renders 3D fuente

**Hallazgo directo, investigado en la tienda Shopify viva (bmcuruguay.com.uy), no asumido:**
BMC (o su proveedor) ya produce **renders 3D reales** (no fotos) para marketing — confirmado
visualmente, no solo por nombre de archivo:

- Las fichas técnicas de ISODEC/ISODEC PIR (`ficha_tecnica_Isodec.png`,
  `Ficha_Tecnica_Isodec_PIR_.pdf.png`) incluyen un render 3D del panel con el engrafado visible
  **y** un corte técnico acotado en mm al pie, con un recuadro **"Detalle engrafe"** que muestra
  exactamente la unión entre paneles — justo el dato de sección que la Sección 1/2 daba por
  inexistente.
- El flyer de ISOROOF FOIL (`BMCFlyer10-IsoroofFOIL.jpg`) trae un render 3D del panel **más íconos
  3D renderizados de cada accesorio de borde**: Babeta frontal/lateral, Gotero Superior, Cumbrera,
  Gotero Lateral, Gotero Frontal — con volumen y sombreado reales, no ilustraciones planas.
- **Los perfiles de borde son productos Shopify individuales** (ej. `cumbrera-isoroof-3g`,
  `babeta-de-atornillar-lateral-isoroof`, `babeta-de-empotrar-lateral-isoroof`,
  `canalon-doble-isoroof-...`, `arandela-trapezoidal-caballete-roof`), cada uno con imágenes
  **con prefijo de archivo literal `3D-`** (ej. `3D-CumbreraIsoroof3G-Gris-WEB01.png`,
  una por color) — confirmado bajando y mirando el render de Cumbrera: geometría CAD limpia y
  precisa (cresta simétrica, pestañas, muescas que calzan con la greca del panel), no un ícono
  genérico. Estos productos también traen largo de stock real (3.03m, coincide con `PERFIL_TECHO`)
  y precio.

**Conclusión: alguien (BMC, su agencia, o Bromyros/Kingspan) ya tiene los archivos 3D fuente detrás
de estos renders.** Y para ISOROOF ni siquiera hace falta esperar ese archivo: `isoroof-cross-
section-dimensioned.png` (persistida en `docs/team/visual/roof-panel-3d-refs/`) es un plano técnico
BMC con **cotas exactas en mm**: ancho total 1000, nervadura 26×40, paso 72 — suficiente para
definir la geometría real HOY, sin depender de nadie. Esto reordena las opciones:

| Opción | Qué es | Uso recomendado |
|---|---|---|
| **E. Procedural desde cotas reales publicadas (NUEVO, la más rápida)** | El plano acotado de ISOROOF (1000/26/40/72mm, ver §1.3) permite construir la sección 2D exacta con `ExtrudeGeometry` ya, sin depender de conseguir ningún archivo externo. ISODEC es geometría más simple (mayormente plano) con una sola cota estimada (alto de costura). | **Camino por defecto — implementado directamente en el código, ver §1.3.** Cero costo, cero espera, cero riesgo de licencia. Cubre ISOROOF con precisión real; ISODEC con una estimación de bajo riesgo en un solo detalle menor. |
| **D. Pedir el archivo 3D fuente al proveedor/agencia** | Los renders `3D-*` y las fichas técnicas con "Detalle engrafe" son evidencia directa de un modelo 3D ya existente en algún lado de la cadena (BMC marketing, agencia de diseño, o Bromyros/Kingspan Uruguay — ver Opción C corregida abajo). | Mejora incremental sobre E si aparece — reemplaza la geometría paramétrica por la real sin cambiar la arquitectura (ver §1.3). No bloqueante: E ya funciona sin esto. |
| **A. Marketplace stock** (CGTrader/TurboSquid/Sketchfab) | Modelos genéricos de chapa/panel corrugado, muchos gratis o de bajo costo; CGTrader ofrece conversión gratis a glTF a pedido. | **Spike de validación de pipeline** (Fase 1) si D no resuelve a tiempo — NO el asset final. Verificar licencia de redistribución comercial en app web viva antes de usar más allá del spike. |
| **B. Freelance/encargo** (Upwork/Fiverr/3D artist local UY) | Modelar el perfil real de BMC a partir de fotos + dimensiones reales (`au`/`esp` de `PANELS_TECHO`) — ahora con las fichas técnicas y renders `3D-*` como referencia directa de proporciones, mucho más preciso que antes. | Fallback si D no da el archivo fuente. Lanzar en paralelo al spike de la opción A para no bloquear. |
| **C. Kingspan BIM library — CORREGIDO, no es un competidor** | **Bromyros (el fabricante real detrás de los paneles ISODEC/ISOROOF de BMC) fue adquirida por Kingspan en 2021** y opera hoy como "Kingspan Uruguay" / "Bromyros by Kingspan Isoeste" — confirmado: el propio flyer de BMC lleva el logo "BROMYROS by Kingspan · ISOESTE". La librería BIM pública de Kingspan (kingspan.com/us/en/services/insulated-panel-bim-tools, NBS BIM Library, BIMobject, ARCAT — gratis, LOD300) **no es de un competidor** — es del mismo grupo que fabrica/licencia el producto real. | Verificar con el proveedor si el SKU/perfil de Kingspan coincide con el de BMC antes de usar as-is (nombres de línea pueden diferir entre catálogo internacional y local) — pero ya no aplica el veto ético/de licencia anterior. Puede ser una fuente legítima y de alta fidelidad, o el mismo contacto de la Opción D puede confirmarlo directo. |

No existe dato numérico de sección (cantidad/espaciado/alto de nervadura) estructurado **en este
repo**, pero si D resuelve, el archivo fuente lo trae; si no, las fichas técnicas ya descargadas
en [`docs/team/visual/roof-panel-3d-refs/`](../visual/roof-panel-3d-refs/README.md) sirven de
referencia visual acotada en mm para B. Definir de todos modos como metadata nueva en
`roofPanelModelUrls.js`.

---

## 2. Bordes y perfiles (gotero / babeta / canalón)

### 2.1 Estado actual (confirmado)
`Roof3DSection` no recibe `techoBorders`/`techoZonasBorders` como prop en absoluto
(`PanelinCalculadoraV3_backup.jsx:7545-7553`), mientras que `QuoteVisualVisor`, montado dos líneas
después, sí los recibe (`:7568-7569`). Modelo de datos ya rico y sin tocar:

- `techo.borders` — `{frente,fondo,latIzq,latDer}`, valores = ids de `BORDER_OPTIONS`
  (`constants.js:610-649`, catálogo filtrado por familia).
- `zona.preview.borders` — override por zona, zona-gana-sobre-global (`quotationViews.js:458`).
- `zona.preview.encounterByPair[pk]` — encuentro compartido, con soporte de segmentos
  (`roofEncounterModel.js`, `listEncounterPairSegmentRuns`).
- `PERFIL_TECHO` — SKU/precio/**largo de stock real** (~3.0-3.03m) por perfil×familia×espesor.
- Vocabulario de color/abreviatura ya usado en el plano 2D SVG (`quotationViews.js:268-278`,
  `_BORDER_COLOR`/`_BORDER_ABBREV`) — mismo lenguaje visual a extender en 3D.

**No existe geometría de sección (mm, ángulo de pliegue) para ningún perfil en ningún lado** — el
único PDF referenciado en comentarios (`docs/team/visual/PRODUCT-IMAGE-MAPPING-VERIFICATION.pdf`)
está **vacío (0 bytes)**, confirmado. Es dato nuevo a definir, igual que en la Sección 1 — pero acá
la forma es mucho más simple (chapa plegada, pocos segmentos rectos), no la nervadura repetida del
panel, así que **no requiere el mismo tratamiento de sourcing glTF**.

### 2.2 Arquitectura propuesta
- **Técnica de geometría:** `THREE.ExtrudeGeometry` procedural desde una forma 2D (`THREE.Shape`)
  autoreada por perfil — correcto para este caso (perfil de chapa simple) a diferencia del panel.
- **Nuevo archivo `src/data/roofPerfilCrossSections.js`** — secciones 2D agrupadas en ~4-5
  plantillas genéricas parametrizadas (L-drip para goteros, variante greca, Z-fold para babetas,
  canal U/trapezoidal para canalón, cresta simétrica para cumbrera). **Ya no es estimación a
  ciegas** (ver §1.4 actualizada): la ficha técnica de ISODEC PIR trae un corte acotado en mm con
  recuadro "Detalle engrafe", y cada perfil (Cumbrera, Babeta de atornillar/empotrar lateral,
  Canalón doble, Caballete) es un producto Shopify individual con render `3D-*` real por color
  (confirmado bajando y mirando el de Cumbrera: geometría CAD precisa, no ícono). Usar esas
  imágenes como referencia directa de proporciones al autorear las formas; si la Opción D de §1.4
  entrega el archivo fuente, este paso puede directamente extraer la sección real en vez de
  aproximarla. Dimensiones que igual no se puedan derivar de una imagen quedan como estimación,
  marcada explícitamente como tal en el header del archivo.
- **Resolución de qué perfil va en cada borde:**
  - Bordes exteriores: merge zona-gana-sobre-global (mismo patrón que ya usa `quotationViews.js:462-463`), skip si resuelve a `"none"`.
  - Bordes compartidos: `encounterByPair[pk]` → `normalizeEncounter()`. A diferencia del BOM (que
    colapsa a un id representativo), el render 3D debe mostrar **dos mallas separadas** para
    pretil/desnivel (`perfil` del lado A, `perfilVecino`/`perfilAlto`/`perfilBajo` del lado B) y
    **una** malla de cresta para cumbrera (`cumbreraUnida:true`).
  - Segmentos: `listEncounterPairSegmentRuns` ya existe y no se usa en 3D hoy — iterar directo, sin
    inventar modelo de datos nuevo.
- **Posicionamiento:** mismas fórmulas de la Sección 0 — bordes laterales reusan el `rot` de la
  zona; bordes frente/fondo son mayormente axis-aligned con un tilt de calce. Offset vertical =
  `profile.thicknessMm` (ya existe en `roofPanelVisualProfiles.js`, no hay que inventarlo).
- **Segmentación BOM-precisa:** usar `PERFIL_TECHO[...].largo` (largo de stock real) para partir
  cada borde en piezas físicas reales con una pequeña separación cosmética entre piezas (2-5mm) —
  usa data que ya existe, resultado visualmente honesto con el BOM real.
- **Fix de threading (trivial, 10 min, independiente de todo lo demás):**
  - `PanelinCalculadoraV3_backup.jsx:7544-7553` — agregar `techoBorders={techo.borders}` y
    `techoZonasBorders={techo.zonas?.map((z) => z.preview?.borders ?? {})}` al `<Roof3DSection>`
    (mismas líneas que ya recibe `QuoteVisualVisor` dos líneas más abajo).
  - `Roof3DSection.jsx:59-67,140-148` — agregar los props al signature y pasarlos.
  - `RoofPanelRealisticScene.jsx:460-469` — agregar los props; `encounterByPair` no necesita prop
    nuevo, ya viaja dentro de `validZonas[i].preview` (confirmado: `encounters3d` ya lo lee así en
    la línea 499).

---

## 3. Continuidad multi-zona (Error 3 — Cumbrera y afines)

### 3.1 Regla de producto confirmada con el stakeholder
**El gesto de arrastrar una zona hasta tocar otra ya es la señal de intención de unión** — no un
pick separado en un menú. **El lado por el que se tocan determina qué tipo de encuentro tiene
sentido físico:**
- Toque **lateral** (`orientation:"vertical"` en `findEncounters` — bordes izq/der) → familia
  pretil/desnivel (join tipo escalón/parapeto).
- Toque **frente-fondo** (`orientation:"horizontal"`) → cumbrera (ridge real, dos faldones que
  se encuentran en una cresta) — la única orientación geométricamente capaz de un ridge real bajo
  el modelo de coordenadas actual (ver Sección 0).

Esto es coherente con lo que ya existe: `findEncounters` (`roofPlanGeometry.js:92-180`) ya calcula
`orientation` para cada par tocante. El doc `ROOF-ENCOUNTER-LOGIC-SPEC.md` deja expresamente "reglas
automáticas por geometría" como trabajo futuro no implementado — esta sección lo implementa.

**Verificado en código — el mecanismo de "posición manual = intención" YA EXISTE parcialmente:**
`applyLateralAnnexLayout` (`roofLateralAnnexLayout.js:245`) ya usa la posición manual exacta
(`preview.x`/`preview.y`) **sin** forzar el gap de 0.25m cuando está definida — el gap automático
(`ROOF_LATERAL_LAYOUT_GAP_M`) solo aplica al layout de fallback auto-generado. Lo que falta no es
"respetar el arrastre" (ya funciona para X) sino: (a) que la detección de encuentros en 3D reconozca
esa adyacencia, (b) que el picker de modo de encuentro filtre/sugiera el tipo según `orientation`
en vez de mostrar los 4 modos siempre, y (c) resolver el caso frente-fondo (Y), que hoy el
auto-layout no puede producir en absoluto (solo varía X).

### 3.2 Fix inmediato, aislado, bajo riesgo (Fase 0) — YA SHIPPEADO
`RoofPanelRealisticScene.jsx:491` detectaba encuentros con `zonasToPlantRectsWithAutoGap` (rects con
gap real de 0.25m) contra un epsilon de 0.002m (`ROOF_PLAN_EPS`) — **nunca podía matchear**, por eso
la línea decorativa de color del encuentro tampoco aparecía nunca, sin importar lo que el usuario
haya elegido. Fix aplicado: swap a `zonasToPlantRectsLogical` (gap=0, ya usada para BOM) solo para
detección — el posicionamiento de mallas queda intacto. Un archivo, sin riesgo para
`RoofBorderSelector` ni el plano 2D.

### 3.3 Toque lateral (X) — soldar sin gap adicional
Ya casi funciona por el mecanismo de posición manual (§3.1). Falta: cuando dos zonas quedan
tocándose (por arrastre manual, detectado vía `zonasToPlantRectsLogical`+`findEncounters`), el
picker de encuentro (`RoofPreview.jsx:3090-3350` / `PanelinCalculadoraV3_backup.jsx:2232-2450`) debe
sugerir/defaultear pretil o desnivel (no dejarlo en "continuo" silencioso sin que el usuario haya
decidido nada) — usar `orientation:"vertical"` para filtrar las opciones mostradas.

### 3.4 Toque frente-fondo (Y) — cumbrera real, el ítem de más incertidumbre de toda la spec
Requiere un modo de layout nuevo: apilar una zona detrás de otra en plan-Y (`r.y_B ≈ r.y_A + h_A`,
gap 0) **con `slopeMark` invertido** en una de las dos, de modo que ambas superficies se encuentren
en la cresta. La derivación algebraica (Sección 0) confirma que el enfoque es correcto, pero **no es
confiable derivar el offset exacto sin probarlo empíricamente** — recomendado un spike aislado de
2-3 días (dos zonas hardcodeadas, iterar `r.y`/`slopeMark`, verificación visual) antes de generalizar
a `resolveRoofZoneLayout3d` (función nueva y paralela, ver restricción de la Sección 0 — no tocar
`buildZoneLayoutsForRoof3d` in place).

### 3.5 Desnivel — revivir el stub muerto
`RoofLateralStepInfills` (`RoofPanelRealisticScene.jsx:265-274`) envuelve
`buildLateralStepInfillGeometries`, que **siempre devuelve `[]`** (`roof3dLateralStepInfill.js:14-19`,
deshabilitado a propósito cuando el layout pasó al modelo "coplanar global"). Un desnivel real
necesita un dato que hoy no existe en ningún lado: la altura del escalón. Agregar
`desnivel.stepHeightM` a `roofEncounterModel.js` (junto a `perfilBajo`/`perfilAlto` ya existentes),
expuesto como campo editable en el popover de encuentro (no un default silencioso — un valor
adivinado incorrecto es peor que no mostrar nada). Renombrar/reimplementar como
`roof3dEncounterStepInfill.js`, alcance v1 solo para `desnivel` (pretil ya tiene su pieza de trim de
la Sección 2; cumbrera es plano-continuo por diseño, sin escalón visible).

---

## 4. Fases / secuencia

| Fase | Contenido | Riesgo/duración | Depende de | Estado |
|---|---|---|---|---|
| **0** | Fix de una línea (§3.2) — detección de encuentros | Trivial, ~minutos | — | ✅ Shippeado |
| **1** | Panel real ISOROOF vía `ExtrudeGeometry` desde cotas exactas (opción E, §1.4) — geometría paramétrica + `InstancedMesh`, sin dependencia externa | Riesgo bajo en dato de entrada (cotas reales confirmadas); riesgo medio en integración three.js/performance — ~1 semana | Fase 0 no bloquea | Pendiente |
| **1b** | Pedir archivo 3D fuente real a BMC/Kingspan Uruguay (opción D) — mejora incremental, no bloqueante | ~1-2 semanas turnaround (estimado), en paralelo | — | Pendiente |
| **2** | Rollout a ISODEC (costura estimada) + ISODEC PIR + ISOROOF Colonial | 1 semana | Fase 1 (mismo patrón de código) | Pendiente |
| **3** | Bordes/perfiles — cross-sections, extrusión, resolución, threading de props | ~1 semana, corre en paralelo a 1/2 (no depende de geometría real de panel) | Sección 0 (contrato de coordenadas, ya existe) | Pendiente |
| **3a** | Spike de cumbrera Y-stacking (§3.4) | 2-3 días, temprano, en paralelo a Fase 1 | — | Pendiente |
| **3b** | `resolveRoofZoneLayout3d` + revive step-infill para desnivel | Depende de 3a | 3a | Pendiente |
| **4** | Integración: las 3 piezas juntas en cotizaciones multi-zona reales, QA visual | — | Todo lo anterior | Pendiente |

Todo detrás de `?visor3d=1` excepto el propio fix de la Fase 0 (que también vive en el mismo
archivo gateado).

---

## 5. Archivos a tocar (consolidado)

| Archivo | Cambio |
|---|---|
| `src/components/RoofPanelRealisticScene.jsx` | Tocado en cada fase: fix de detección (✅ hecho), `InstancedMesh` de paneles, capa de trim, nuevo resolver de layout |
| `src/utils/roofZoneLayouts3d.js` | Nueva función `resolveRoofZoneLayout3d` (gap consciente de soldado + modo Y-stack) — `buildZoneLayoutsForRoof3d` queda intacta para `RoofBorderSelector` |
| `src/utils/roofZoneConnectivity.js` (nuevo) | Extraer el union-find ya precedentado en `frontComponentModel` (`PanelinCalculadoraV3_backup.jsx:1221-1291`) a un helper compartido |
| `src/utils/roofEncounterModel.js` | Agregar `desnivel.stepHeightM` |
| `src/utils/roof3dLateralStepInfill.js` | Renombrar/reimplementar → `roof3dEncounterStepInfill.js` |
| `src/data/roofPanelCrossSections.js` (nuevo) | Secciones 2D reales por forma de familia (ISOROOF con cotas exactas 1000/26/40/72mm, ISODEC con costura estimada) — reemplaza el `roofPanelModelUrls.js`/assets `.glb` de la versión anterior de esta tabla |
| `src/data/roofPerfilCrossSections.js` (nuevo) | Secciones 2D por tipo de perfil de borde, referenciadas contra los renders reales en `docs/team/visual/roof-panel-3d-refs/` |
| `src/utils/roofBorderTrimGeometry3d.js` (nuevo) | Extrusión + posicionamiento de trim desde `techoBorders`/`encounterByPair` |
| `src/components/roof3d/Roof3DSection.jsx` | Threading de `techoBorders`/`techoZonasBorders` |
| `src/components/PanelinCalculadoraV3_backup.jsx:7544-7553` | Agregar los 2 props al mount de `<Roof3DSection>` |

---

## 6. Riesgos / decisiones abiertas

1. **La trigonometría de cumbrera Y-stack (§3.4) es el ítem de mayor riesgo de toda la spec** — el
   enfoque está validado en el papel, la fórmula exacta no. Spike aislado obligatorio antes de
   generalizar.
2. **Deuda técnica aceptada a propósito:** `resolveRoofZoneLayout3d` duplica parte de la lógica de
   `applyLateralAnnexLayout` — precio de no arriesgar `RoofBorderSelector`/plano 2D en producción.
3. **Licencia de assets stock (opción A):** verificar redistribución comercial en app web viva antes
   de usar más allá del spike de validación de pipeline.
4. ~~Kingspan es solo referencia (competidor directo)~~ — **CORREGIDO 2026-07-11:** Bromyros
   (fabricante real de BMC) fue adquirida por Kingspan en 2021, opera como "Kingspan Uruguay". No
   es un competidor — ver §1.4. Riesgo real remanente: confirmar con el proveedor que el SKU/perfil
   de la librería BIM pública coincide con el catálogo local antes de usarlo as-is.
5. **Dimensiones de sección** — ya no puramente placeholder (§2.2 tiene fichas técnicas reales con
   cortes acotados), pero cualquier dato que igual haya que estimar debe quedar marcado como tal;
   no dejar que "estimación" se vuelva permanente por omisión.
6. **`desnivel.stepHeightM` es dato nuevo sin default razonable** — exponerlo editable en el UI, no
   adivinarlo en silencio.
7. **Performance no medida empíricamente** — todos los números de instancias/triángulos en §1.3 son
   estimados; medir de verdad en el spike de la Fase 1 antes de comprometerse a `InstancedMesh` a
   escala completa.

---

## 7. Verificación

- **Fase 0 (✅ hecho):** con `?visor3d=1`, crear 2 zonas raíz que queden tocándose por posición
  manual + encuentro "Cumbrera" elegido → la línea de color del encuentro debe aparecer (antes no
  aparecía nunca). `npm run gate:local` verde.
- **Fase 1:** un panel con geometría real (no plano chato) visible al expandir "Ver render 3D",
  medir FPS/triángulos con una zona de ancho máximo realista (~7-8 paneles) — sin caída perceptible
  de framerate con `OrbitControls` activo.
- **Fase 3:** con bordes configurados (`techo.borders`) en una zona simple, el render 3D muestra
  geometría de gotero/babeta visible en el borde correcto, coloreada según `_BORDER_COLOR`.
- **Fase 3a/3b:** dos zonas con encuentro Cumbrera explícito → se tocan sin hueco ni desnivel de
  altura en el render 3D; dos zonas con "continuo" implícito (sin configurar) siguen manteniendo el
  gap visual (no se sueldan por accidente).
- **Integración (Fase 4):** repetir el caso real del screenshot original (zonas 10.08×11m +
  5.6×6m, Cumbrera) end-to-end y confirmar que ya no flotan separadas.
