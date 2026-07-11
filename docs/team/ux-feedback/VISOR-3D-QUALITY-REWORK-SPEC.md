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

### 1.3 Arquitectura propuesta
- **Loader:** `useGLTF` (drei) ya trae `GLTFLoader`/`DRACOLoader` transitivos vía `three-stdlib`;
  agregarlo como dependencia directa y self-hostear el decoder Draco en `public/draco/` (mismo
  criterio "local-first" que `public/images/isoroof-colonial-texas-panel.png`).
- **Hosting:** `public/models/roof-panels/*.glb` local (no CDN remoto) — sin problemas de CORS, y
  `.glb` no está en el `globPatterns` del PWA precache (`vite.config.js`) así que no infla el bundle
  offline; solo se descarga bajo demanda (la sección arranca colapsada, `Roof3DSection.jsx:68`).
- **Mapeo familia → modelo (menos modelos que familias):** `PANELS_TECHO.*.fam` ya agrupa por perfil
  físico real: `ISOROOF_3G`/`PLUS`/`FOIL` comparten `fam:"ISOROOF"`. Recomendado: **como máximo 4
  perfiles distintos** (ISOROOF trapezoidal, ISODEC EPS, ISODEC PIR, ISOROOF Colonial) para 6
  familias. Nuevo archivo `src/data/roofPanelModelUrls.js` con el mapeo familia→key→URL+metadata de
  tiling (pitch de nervadura, largo nativo de tile).
- **Color:** un modelo por forma de perfil, sin textura embebida (solo geometría+UVs); en runtime se
  arma un `MeshStandardMaterial` con el mapa de `getRoofPanelMapUrl` — cero assets nuevos por color.
- **Tiling/escala:** modelar un tile de `au` metros de ancho × ~1m de largo, repetido con
  `THREE.InstancedMesh` a lo largo de `largo` (reemplaza el hack actual de `repeat`/`offset` de
  textura). Presupuesto: ≤1500 triángulos por tile, una `InstancedMesh` + un material compartido por
  combinación (familia-forma, color) — agrupando **todas las franjas de una zona**, no una
  `InstancedMesh` por franja, para minimizar draw calls. Con hasta ~700-1000+ instancias en una
  cotización multi-zona, `InstancedMesh` maneja esto sin problema en un solo draw call; el
  presupuesto de triángulos por tile es la variable real de performance, no la cantidad de
  instancias — medir en el spike de la Fase 1, no asumir.

### 1.4 De dónde salen los modelos reales (investigado, con fuentes actuales verificadas por web)
No hay ningún DWG ni asset 3D en el repo hoy — hay que conseguirlos. Tres caminos reales,
**secuenciados, no mutuamente excluyentes**:

| Opción | Qué es | Uso recomendado |
|---|---|---|
| **A. Marketplace stock** (CGTrader/TurboSquid/Sketchfab) | Modelos genéricos de chapa/panel corrugado, muchos gratis o de bajo costo; CGTrader ofrece conversión gratis a glTF a pedido. | **Spike de validación de pipeline** (Fase 1) — NO el asset final. Verificar licencia de redistribución comercial en app web viva antes de usar más allá del spike. |
| **B. Freelance/encargo** (Upwork/Fiverr/3D artist local UY) | Modelar el perfil real de BMC a partir de fotos + dimensiones reales (`au`/`esp` de `PANELS_TECHO`). Forma simple (chapa plegada paramétrica), turnaround/costo bajos en este rubro. | **El asset que efectivamente se shippea.** Lanzar en paralelo al spike de la opción A para no bloquear. |
| **C. Kingspan BIM library** (kingspan.com/us/en/services/insulated-panel-bim-tools, NBS BIM Library, BIMobject, ARCAT — gratis, LOD300) | Geometría real de un **competidor directo**, no de BMC. | **Solo referencia** para calibrar proporciones de nervadura al briefear al freelancer o evaluar un modelo stock. **Nunca** descargar/adaptar/shippear el mesh o textura de Kingspan — dejarlo explícito en el brief de quien consiga los modelos. |

No existe dato numérico de sección (cantidad/espaciado/alto de nervadura) en ningún lado — se define
como metadata nueva en `roofPanelModelUrls.js`, provista por quien construya/elija cada modelo.

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
  canal U/trapezoidal para canalón, cresta simétrica para cumbrera). Dimensiones en mm son
  **estimaciones placeholder explícitamente marcadas como tales** en el header del archivo —
  reemplazar cuando haya fichas técnicas reales del proveedor.
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
| **1** | Spike glTF con UN perfil (stock, opción A) — valida loader, InstancedMesh, escala, performance real | **Más incierto de toda la spec**, ~1 semana | Fase 0 no bloquea | Pendiente |
| **1b** | Encargo freelance (opción B) del perfil real BMC — en paralelo, no bloquea la Fase 1 | ~1-2 semanas turnaround (estimado) | — | Pendiente |
| **2** | Rollout glTF a las 4 formas de perfil restantes | 1-2 semanas | Fase 1 + assets de 1b | Pendiente |
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
| `src/data/roofPanelModelUrls.js` (nuevo) | Mapeo familia→modelo glTF + metadata de tiling |
| `src/data/roofPerfilCrossSections.js` (nuevo) | Secciones 2D placeholder por tipo de perfil |
| `src/utils/roofBorderTrimGeometry3d.js` (nuevo) | Extrusión + posicionamiento de trim desde `techoBorders`/`encounterByPair` |
| `src/components/roof3d/Roof3DSection.jsx` | Threading de `techoBorders`/`techoZonasBorders` |
| `src/components/PanelinCalculadoraV3_backup.jsx:7544-7553` | Agregar los 2 props al mount de `<Roof3DSection>` |
| `public/models/roof-panels/*.glb`, `public/draco/` (nuevos) | Assets |

---

## 6. Riesgos / decisiones abiertas

1. **La trigonometría de cumbrera Y-stack (§3.4) es el ítem de mayor riesgo de toda la spec** — el
   enfoque está validado en el papel, la fórmula exacta no. Spike aislado obligatorio antes de
   generalizar.
2. **Deuda técnica aceptada a propósito:** `resolveRoofZoneLayout3d` duplica parte de la lógica de
   `applyLateralAnnexLayout` — precio de no arriesgar `RoofBorderSelector`/plano 2D en producción.
3. **Licencia de assets stock (opción A):** verificar redistribución comercial en app web viva antes
   de usar más allá del spike de validación de pipeline.
4. **Kingspan es solo referencia** — dejarlo explícito en cualquier brief a freelancer para que nadie
   lo use como atajo (competidor directo).
5. **Dimensiones de sección placeholder (§2.2)** — marcadas como estimación, reemplazar con fichas
   reales del proveedor cuando existan; no dejar que "placeholder" se vuelva permanente por omisión.
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
