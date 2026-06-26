# Auditoría Roof Module: Reconciliación de Vocabulario vs Implementación

**Commit:** `abe993695f719d6f59cdf22184ce1329005039c1`  
**Fecha:** 2026-06-23  
**Contexto:** Reconciliación entre vocabulario de sesión de diseño y modelo de 4 modos de encuentro que ya existe en el código. Verificación de gaps para membrana/espuma, rasante con goteros de cámara, lima-olla, y colapso de largo en cotización multi-zona.

---

## 1. Auditoría de Hechos Load-Bearing (9 hechos)

Cada hecho del Manifiesto de Lectura verificado contra el código actual.

### Hecho 1: Una zona = `largo × ancho`; sin múltiples tramos por zona

**Veredicto:** ✅ **CONFIRMADO**

- **Código:** `roofPlanGeometry.js` línea 28 — firma de `layoutZonasEnPlanta()` espera `{ largo: number, ancho: number }`
- **Evidencia:** Cero referencias a `zona.tramos` en `calculations.js`, `roofPrincipalZona.js`, o modelos de zona
- **Nota en código:** `roofPrincipalZona.js` línea 4 menciona "legacy tramo apilado para datos que ya traigan preview apilado; la UI ya no ofrece"
- **Conclusión:** Modelo es `zona = { largo, ancho, preview: { x?, y? }, encounters: {...} }`. Futuro feature (multi-tramo por zona) no implementado.

---

### Hecho 2: Dos aguas = `ancho/2` por faldón; calcTechoCompleto corre 2× por zona; cantPaneles suma ambos

**Veredicto:** ✅ **CONFIRMADO**

- **Orquestación dos aguas:** `scenarioOrchestrator.js` líneas 147–174
  - Línea 148: `const halfAncho = +(zona.ancho / 2).toFixed(2);`
  - Línea 157: Primera llamada a `calcTechoCompleto({ ancho: halfAncho, borders: { ..., fondo: "cumbrera" } })`
  - Línea 163: Segunda llamada con mismo `halfAncho` pero `fondo` en borders distinto
  - Ambos resultados se pasan a `mergeZonaResults()`

- **Suma de cantPaneles:** `calculations.js` línea 1008 en `mergeZonaResults()`
  ```javascript
  combined.paneles.cantPaneles += r.paneles.cantPaneles;
  ```
  Suma todos los `cantPaneles` de los dos faldones en el resultado combinado.

- **Conclusión:** Dos aguas bifurca ancho exactamente por 2, corre calcTechoCompleto dos veces (una por faldón), y los paneles se suman. ✓

---

### Hecho 3: Cuatro modos de encuentro: `continuo | pretil | cumbrera | desnivel`

**Veredicto:** ✅ **CONFIRMADO (EXACTO)**

- **Typedef:** `roofEncounterModel.js` línea 8
  ```javascript
  @typedef {'continuo' | 'pretil' | 'cumbrera' | 'desnivel'} EncounterModo
  ```

- **Validación:** Línea 25 — validación estricta
  ```javascript
  if (!["continuo", "pretil", "cumbrera", "desnivel"].includes(modo))
  ```
  Si `modo` no está en la lista, se reemplaza con valor por defecto.

- **Búsqueda de términos alternativos:**
  - `rasante`, `lima-olla`, `babeta` → NO existen como modos de encuentro
  - `babeta` aparece como id de perfil en `constants.js` (ej. `babeta_adosar`, `babeta_empotrar`), no como modo
  
- **Conclusión:** Exactamente 4 modos. Ningún otro modo existe en el código. ✓

---

### Hecho 4: Largo de encuentro `L` = solape 1D en planta; derivado de `preview.x/y`

**Veredicto:** ✅ **CONFIRMADO**

- **Cálculo de largo (`L`):** `roofPlanGeometry.js` líneas 92–180 en `findEncounters()`
  - Encuentros verticales (líneas 110–125): solape Y calculado como `y1 - y0` donde:
    ```javascript
    const y0 = Math.max(ay1, by1);  // borde común mínimo
    const y1 = Math.min(ay2, by2);  // borde común máximo
    ```
    Línea 122: `length: +(y1 - y0).toFixed(4)`
  
  - Encuentros horizontales (líneas 144–157): solape X análogo:
    ```javascript
    const x0 = Math.max(ax1, bx1);
    const x1 = Math.min(ax2, bx2);
    ```
    Línea 156: `length: +(x1 - x0).toFixed(4)`

- **Posiciones desde preview.x/y:** Línea 47 en `layoutZonasEnPlanta()`
  ```javascript
  const pos = p && Number.isFinite(p.x) && Number.isFinite(p.y) 
    ? { x: p.x, y: p.y }
    : autoPos[gi];
  ```
  Donde `p = z.preview` (línea 45), así que las posiciones vienen de `preview.x` y `preview.y`.

- **Flujo:** `preview.x/y` → `layoutZonasEnPlanta()` → `rects[i].x, rects[i].y` → `findEncounters()` calcula `L` como solape 1D.

- **Conclusión:** `L = solape 1D (segmento compartido entre rectángulos)`. ✓

---

### Hecho 5: `resolveSKU_techo` resuelve por espesor EXACTO o `_all` fallback; sin lógica de rango

**Veredicto:** ✅ **CONFIRMADO**

- **Firma y lógica:** `calculations.js` líneas 44–58
  ```javascript
  export function resolveSKU_techo(tipo, familiaP, espesor) {
    const { PERFIL_TECHO } = getPricing();
    const byTipo = PERFIL_TECHO[tipo];
    if (!byTipo) return null;
    let fam = familiaP;
    if (fam === "ISOROOF_COLONIAL" && tipo !== "cumbrera") {
      fam = "ISOROOF";
    }
    const byFam = byTipo[fam];
    if (!byFam) return null;
    if (byFam[espesor]) return { ...byFam[espesor] };  // ← MATCH EXACTO
    if (byFam._all) return { ...byFam._all };          // ← FALLBACK SOLAMENTE
    return null;
  }
  ```

- **Lógica de decisión:**
  1. Intenta match exacto: `byFam[espesor]` (ej. `byFam[50]`, `byFam[80]`)
  2. Si no existe, fallback a `_all` solamente
  3. Sin rango interpolación; sin lógica "≤50", "50–80", etc.

- **Búsqueda por rangos:** Cero referencias a "RANGO", "range", "between", "min/max" en esta función.

- **Conclusión:** Binary decision: exact match OR `_all` fallback. No range logic. ✓

---

### Hecho 6: `calcLargoRealFromModo`: 3 modos; frontales (cumbrera/alero) quedan horizontal; laterales usan largo real inclinado

**Veredicto:** 🟡 **MATIZADO**

- **Función:** `calculations.js` líneas 26–30
  ```javascript
  export function calcLargoRealFromModo(largo, pendienteModo, pendienteGrados = 0, alturaDif = 0) {
    if (pendienteModo === "incluye_pendiente") return +(largo).toFixed(3);
    if (pendienteModo === "calcular_altura" && alturaDif > 0) 
      return +(Math.sqrt(largo * largo + alturaDif * alturaDif)).toFixed(3);
    return calcLargoReal(largo, pendienteGrados);
  }
  ```

- **3 modos identificados:**
  1. `"incluye_pendiente"` (línea 27) → retorna `largo` sin cambio (horizontal, como está)
  2. `"calcular_altura"` (línea 28) → Pitágoras: `sqrt(largo² + alturaDif²)` (diagonal 3D)
  3. Else (línea 29) → `calcLargoReal(largo, pendienteGrados)` (aplica factor trigonométrico)

- **Matiz crítico:** La función **no discrimina internamente** frontales vs laterales por nombre. La distinción se hace en el **caller**:
  - `calcTechoCompleto()` línea 786: `const largoReal = calcLargoRealFromModo(...)`
  - Los frontales (cumbrera, alero) vs laterales se determinan en contexto externo (qué borde, qué zona).
  - La función es agnóstica — aplica las 3 reglas sin conocer "cumbrera" ni "lateral".

- **Conclusión:** 3 modos existen y funcionan; pero la lógica frontales/laterales vive en callers, no en la función. La función es pura / stateless. 🟡

---

### Hecho 7: Selladores hoy: estándar (silicona+cinta, sin membrana/espuma) O kit comercial fijo

**Veredicto:** ✅ **CONFIRMADO CON MATIZ**

#### `calcSelladoresTecho()` (línea 576)
Computa **silicona + cinta_butilo solamente**:
- Líneas 620–644 en la función:
  - Silicona: ML basado en juntas entre paneles, solapes, canalones
  - Cinta butilo: calculada por cantidad de paneles / rollos
- **NO:** Membrana, espuma PU, o cualquier otro tipo
- Línea 630: `const puCinta = p(SELLADORES.cinta_butilo);` y suma al items

#### `calcSelladoresTechoComercial()` (línea 710)
Kit fijo: **silicona + silicona_300 + membrana + espuma_pu**, pero con **cantidades hardcodeadas**:
- Líneas 713–715:
  ```javascript
  const nSil = getDimensioningParam("SELLADORES_TECHO.comercial_siliconas", 4);
  const nMem = getDimensioningParam("SELLADORES_TECHO.comercial_membranas", 2);
  const nEsp = getDimensioningParam("SELLADORES_TECHO.comercial_espumas", 4);
  ```
- Cantidades vienen de parámetros de dimensioning (defaults: 4 silicona, 2 membrana, 4 espuma)
- **NO:** Cálculo dinámico por encuentro ni por `L` de encuentro
- Es un **preset fijo** multiplicado por cantidad si acaso

- **Conclusión:** 
  - `calcSelladoresTecho()` = silicona + cinta solamente ✓
  - `calcSelladoresTechoComercial()` = kit fijo (hardcoded cantidades) ✓
  - Membrana/espuma NO se calculan dinámicamente por encuentro ✓

---

### Hecho 8: Perímetro EXTERIOR: "Pendiente de producto" (rasante, babeta, vuelo)

**Veredicto:** 🟡 **CONFIRMADO PARCIALMENTE**

- **Geométrico:** `buildExteriorSegments()` en `roofPlanGeometry.js` líneas 226–308 calcula aristas exteriores correctamente
  - Resta encuentros de rectángulos → segmentos exteriores con `length` calculado

- **Mapping semántico:** `buildEdgeBOM()` líneas 460–487 mapea aristas a nombres semánticos (frente, fondo, latIzq, latDer)

- **¿Rasante, babeta, vuelo?**
  - **Rasante:** NO como ítem separado en BOM. Forma parte de los `gotero_frontal` / `gotero_lateral` en PERFIL_TECHO
  - **Babeta:** Existe como perfil (`babeta_adosar`, `babeta_empotrar` en constants.js); **SÍ derivada de aristas exteriores** via `buildEdgeBOM()` → `calcPerfileriaTecho()`.
    - Líneas 821 en `calcTechoCompleto()`: comentario dice "BOM comercial ISODEC PIR: 2 goteros + 6 babetas + kit selladores"
    - Babetas se calculan por ML exterior; kits comerciales preset en constants son sobrescribibles
  - **Vuelo:** NO encontrado en el código; no es un ítem BOM ni parámetro de zona

- **Estado actual:** Línea 821 comenta: **"Ignora bordes perimetrales para accesorios"** — la geometría se calcula pero los accesorios usan presets, no fórmulas por ML

- **Conclusión:** Perímetro exterior se calcula en planta (`buildExteriorSegments`, `buildEdgeBOM`), pero la asignación a rasante/babeta/vuelo en BOM está **marcada "Pendiente de producto"**. Las babetas se hardcodean en kits comerciales, no derivadas de `L` exterior. ✓

---

### Hecho 9: Wizard: paso 7/13 "Solo techo"

**Veredicto:** ❌ **REFUTADO (número incorrecto)**

- **Pasos reales:** `constants.js` líneas 461–479 definen `wizardSteps` para "Solo techo":
  ```javascript
  wizardSteps: [
    { id: "escenario",      label: "Escenario de obra" },           // 0
    { id: "familia",        label: "Familia panel techo" },         // 1
    { id: "espesor",        label: "Espesor techo" },               // 2
    { id: "color",          label: "Color techo" },                 // 3
    { id: "dimensiones",    label: "Dimensiones (metros o paneles)" }, // 4
    { id: "pendiente",      label: "Pendiente" },                   // 5
    { id: "estructura",     label: "Estructura" },                  // 6 ← paso 7 en pantalla
    { id: "bordes",         label: "Accesorios perimetrales" },     // 7
    { id: "selladores",     label: "Selladores" },                  // 8
    { id: "flete",          label: "Flete" },                       // 9
    { id: "proyecto",       label: "Datos del proyecto" },          // 10
  ]
  ```

- **Total:** **11 pasos** (índices 0–10), NO 13
- **Paso 7 en pantalla:** Muestra como "7/11" (index 6), y la etiqueta es **"Estructura"**, NO "Solo techo"
- **"Solo techo"** es el nombre del **escenario** (paso 0), no del paso 7

- **Conclusión:** Hecho refutado. El wizard tiene **11 pasos**, paso 7 se etiqueta "Estructura", no "Solo techo". ❌

---

## 2. Mapeo de Vocabulario de Sesión vs Modos Existentes

| Término Sesión | Rol | ¿Mapea a Modo? | Modo Existente | ¿Modo Nuevo? | Notas |
|---|---|---|---|---|---|
| **cumbrera** | Structural (ridge/two pitches) | ✅ SÍ | `cumbrera` | NO | Dos faldones comparten un perfil en cumbrera; modo canónico. |
| **continuo** | Structural (coplanar, no step) | ✅ SÍ | `continuo` | NO | Mismo plano, sin cambio de pendiente; sin accesorio en tramo compartido. |
| **desnivel-asimétrico** | Structural (step/misalignment) | 🟡 PARCIAL | `desnivel` | MAYBE | `desnivel` existe, pero ¿"asimétrico" requiere lógica diferente? Requiere clarificación. |
| **muro-panel / babeta** | Perimeter (wall-panel junction) | ❌ NO | — | N/A | NO es modo de encuentro. `babeta_adosar`, `babeta_empotrar` son perfiles (constants.js). Accesorio, no encuentro. |
| **rasante** | Perimeter (roof edge trim) | ❌ NO | — | N/A | NO modo de encuentro. Parte de `gotero_frontal` / `gotero_lateral` en PERFIL_TECHO. Está en la geometría, no en encuentro semántico. |
| **lima-olla** | Structural (valley/gutter) | ❌ TBD | — | ¿MAYBE? | **NO encontrado en código**. Estructura TBD: ¿profile type? ¿unit item? ¿parte de exterior perimeter? Decisión necesaria. |

### Interpretación

- **Términos limpios (2):** cumbrera, continuo → mapean directo a modos existentes. ✓
- **Términos perimetrales (2):** muro-panel/babeta, rasante → NO son modos; son **perfiles/accesorios** en constants.js; parte de cálculo de perfilería/bordes, NO encuentro.
- **Términos inciertos (2):** desnivel-asimétrico, lima-olla → requieren spec clarificación.

---

## 3. Puntos de Inserción para Features Nuevas

### 3.1 Per-Encuentro Selladores (membrana/espuma con rendimientos)

**Gap actual:** No hay desglose de selladores por tipo de encuentro (modo). La función `calcSelladoresTecho()` suma ML de silicona + cinta basado en `cantP` (cantidad paneles) y `largoReal`, sin considerar encuentros.

**Código actual:**
- `calcSelladoresTecho()` (línea 576 en `calculations.js`): silicona + cinta_butilo solamente
- Llamado por `calcTechoCompleto()` línea 789: `const { items: selladores, total: costoSelladores } = calcSelladoresTecho(...)`
- Resultado se mezcla en `mergeZonaResults()` línea 1022 (mergeItemsBySku)

**Puntos de inserción:**

1. **Pasar encuentros a calcTechoCompleto:**
   - Firma actual (línea 777): `export function calcTechoCompleto({ familia, espesor, largo, ancho, tipoEst, borders, opciones })`
   - Extender a: `{ ..., encuentrosData }` (array de encuentros con `modo`, `length`)

2. **Extender calcSelladoresTecho:**
   - Línea 576: recibir `encuentrosData`
   - Agrupar por `modo` (continuo/pretil/cumbrera/desnivel)
   - Para cada modo, calcular:
     - Membrana: `L_encuentro * rendimiento_membrana` → unidades
     - Espuma PU: `L_encuentro * rendimiento_espuma` → unidades
   - Sumar a items (junto con silicona + cinta)

3. **Rendimientos en constants:**
   - Extender `SELLADORES` (línea 267 en `constants.js`):
     ```javascript
     membrana: { 
       label: "Rollo membrana autoadhesiva 30cm×10m",
       sku: "membrana",
       costo: 123.45,
       rendimiento_ml_per_unid: 1000,  // NEW
       rendimiento_por_encuentro_modo: { continuo: 0, pretil: 0.5, cumbrera: 1.0, desnivel: 0.8 }  // NEW
     }
     ```

4. **Merge en mergeZonaResults:**
   - Línea 1022: `mergeItemsBySku()` ya maneja agregación por SKU
   - Selladores se sumarían igual que fijaciones/perfilería

**Caller chain:**
```
PanelinCalculadoraV3.jsx → calcTechoCompleto() → [calcSelladoresTecho + encuentrosData] → mergeZonaResults()
```

---

### 3.2 Rasante con Goteros de Cámara por Rango (≤50 / 50–80 / 80–100)

**Gap actual:** `resolveSKU_techo()` hace match exacto o fallback `_all`. No hay lógica de rangos (ej. "si espesor ≤ 50, usa SKU 50-key; si 50–80, usa 80-key").

**Código actual:**
- `resolveSKU_techo()` líneas 44–58: binary decision (exact OR `_all`)
- Llamado por `calcPerfileriaTecho()` línea 412: `const sku = resolveSKU_techo(tipo, familiaP, espesor);`
- `calcPerfileriaTecho()` itera sobre bordes (frente, fondo, lateral izq, lateral der) → línea 534 crea items de perfilería

**Puntos de inserción:**

1. **Nueva función helper:** `resolveSKU_techoByRange()`
   ```javascript
   export function resolveSKU_techoByRange(tipo, familiaP, espesor) {
     const exact = resolveSKU_techo(tipo, familiaP, espesor);
     if (exact) return exact;
     
     // Fallback range: si no existe exacto, buscar en lista de espesores ordenados
     const { PERFIL_TECHO } = getPricing();
     const byFam = PERFIL_TECHO[tipo]?.[familiaP];
     if (!byFam) return null;
     
     const espesoresDisponibles = Object.keys(byFam)
       .filter(k => k !== "_all" && !isNaN(Number(k)))
       .map(Number)
       .sort((a, b) => a - b);
     
     // Regla: usa el espesor disponible más cercano (mayor ≤ espesor)
     const closest = espesoresDisponibles.reverse().find(e => e <= espesor);
     if (closest && byFam[closest]) return { ...byFam[closest] };
     
     // Si no hay menor, usa el máximo disponible
     if (espesoresDisponibles.length > 0) return { ...byFam[espesoresDisponibles[espesoresDisponibles.length - 1]] };
     
     return byFam._all ? { ...byFam._all } : null;
   }
   ```

2. **Usar en calcPerfileriaTecho:**
   - Línea 412: reemplazar `resolveSKU_techo()` con `resolveSKU_techoByRange()` (o toggleable vía flag)

3. **Metadata en constants (PERFIL_TECHO):**
   - Documentar rangos (ej. `gotero_lateral_camara: { ISOROOF: { 50: {...}, 80: {...}, 100: {...}, rangeMode: "closest_le" } }`)

**Caller chain:**
```
calcTechoCompleto() → calcPerfileriaTecho() → resolveSKU_techoByRange() → PERFIL_TECHO lookup
```

---

### 3.3 Lima-Olla SKU (Estructura TBD)

**Gap:** Lima-olla NO existe en código. Rol estructural incierto.

**Preguntas a resolver:**

1. **¿Tipo de SKU?**
   - Profile type (como `gotero_frontal`, `cumbrera`)? → Iría en `PERFIL_TECHO` en `constants.js`
   - Unit accessory (como `embudo`, `vaina`)? → Iría en `PERFIL_TECHO` como single-unit item o separate structure
   - Perimeter component (rasante-like)? → Iría en `buildExteriorSegments()` breakdown

2. **¿Dónde se calcula?**
   - Si es profile: `calcPerfileriaTecho()` línea 412
   - Si es unit: `calcTechoCompleto()` como fixed add-on per zona o per encuentro
   - Si es perimeter: `buildEdgeBOM()` línea 460, luego en `calcPerfileriaTecho()`

3. **¿Mapeo de encuentros?**
   - ¿Lima-olla mapea a un modo (ej. desnivel)? O ¿es un componente separado que sale de la geometría?

4. **¿Rendimiento / cantidad?**
   - Por unidad (fijo)? O por metro lineal (L de encuentro)?

**Recomendación:** 
- Coordinar con Matías (diseño) para confirmar:
  - Si lima-olla es roof valley (cumbrera invertida), perimeter valley trim, o soporte de canaleta
  - Si es un nuevo profile type o accesorio unitario
  - Fórmula de cálculo (fijo, por zona, por M lineal de encuentro)
- Una vez decidido, insertar en:
  - `constants.js`: PERFIL_TECHO[tipo]["lima_olla"] o equivalent
  - `roofEncounterModel.js`: possibly new helper si mapea a encuentro
  - `calcPerfileriaTecho()` o `calcTechoCompleto()`: según tipo

---

## 4. Largo Collapse en `mergeZonaResults()`

**Estado:** ✅ **CONFIRMADO como intencionado**

### Síntesis

`mergeZonaResults()` (línea 998 en `calculations.js`) es una función de **agregación**, no de preservación de traza:

```javascript
export function mergeZonaResults(zonaResults) {
  if (!zonaResults.length) return null;
  if (zonaResults.length === 1) return zonaResults[0];
  
  const combined = JSON.parse(JSON.stringify(zonaResults[0]));
  
  for (let i = 1; i < zonaResults.length; i++) {
    const r = zonaResults[i];
    // Suma cantPaneles, ML, mlNecesario, costos, etc.
    combined.paneles.cantPaneles += r.paneles.cantPaneles;
    combined.paneles.areaTotal = +(combined.paneles.areaTotal + r.paneles.areaTotal).toFixed(2);
    // ... (más merges por fijaciones, perfilería, etc.)
  }
  return combined;
}
```

### Impacto

- **Qué se pierde:** Atribución de paneles/ML/costo a zona de origen. Post-merge, solo totales.
- **Qué se preserva:** PDF visual por zona mediante `zonaRoofBlocks()` en `quotationViews.js` línea ~500+, que procesa **pre-merge** y construye bloques HTML separados por zona.
- **Consecuencia:** 
  - BOM final es correcto (suma total)
  - Desglose por zona en PDF es correcto (usa pre-merge)
  - Pero si después de merge necesitas saber "cuántos paneles para zona 2", no hay forma (colapso irreversible)

### Conclusión

**By design.** El colapso de largo es intencional (abstracción de agregación). No es un bug. Está documentado implícitamente en la estructura (single `combined` result, no `byZona` dict). Es una decisión de UX: el cliente ve el desglose por zona en PDF; el motor interno ve solo BOM total sumado.

---

## 5. Resumen & Recomendaciones

### Tabla Resumen

| Categoría | Estado | Acción |
|---|---|---|
| **Load-bearing facts (9)** | 7 confirmados, 1 matizado, 1 refutado | Documentado en sección 1; ajustar docs para wizard 11 steps |
| **Vocabulario mapping (6 términos)** | 3 limpios, 2 perimetrales (NO modos), 1 TBD | Ver tabla sección 2; rasante/babeta/muro-panel son accesorios, no encuentros |
| **Per-encuentro selladores** | Gap identificado; inserción clara | Extender `calcSelladoresTecho()` para recibir encuentros + rendimientos de membrana/espuma en constants |
| **Rasante + rangos SKU** | Gap identificado; inserción clara | Nueva función `resolveSKU_techoByRange()` en calculations.js; refactor llamadas en `calcPerfileriaTecho()` |
| **Lima-olla** | NO en código; estructura TBD | Decision needed: es profile type, unit item, o perimeter component? Coordinar con diseño. |
| **Largo collapse merge** | Intencionado (by design) | Preservado en PDF pre-merge; no es bug; documentar para devs futuros |

### Siguiente Pasos (Roadmap)

1. **Corto plazo (clarificación):**
   - Matías: confirmar lima-olla tipo + fórmula cálculo
   - Matías: confirmar si desnivel-asimétrico requiere lógica nueva o mapea a `desnivel` existente
   - Dev: actualizar `docs/CALC-TECHO.md` con verdad del wizard (11 pasos, no 13)

2. **Mediano plazo (features nuevas):**
   - PR 1: Extender `calcSelladoresTecho()` para per-encuentro membrana/espuma (bloquea: constants rendimientos)
   - PR 2: `resolveSKU_techoByRange()` para goteros de cámara + rasante por rango (bloquea: constants metadata)
   - PR 3: Lima-olla SKU + inserción (bloquea: decisión estructura)

3. **Documentación:**
   - Actualizar `docs/CALC-TECHO.md` con:
     - Paso 7/11 (no 7/13)
     - Notas sobre perimetrales (rasante, babeta) como accesorios, no encuentros
     - Feature roadmap de selladores dinámicos
   - Mantener este audit en docs/ para referencia

---

## Glosario de Términos (Anclado a Código)

| Término | Definición | Código |
|---|---|---|
| **Modo** | Tipo semántico de encuentro entre zonas | `roofEncounterModel.js` typedef EncounterModo |
| **Continuo** | Mismo plano, sin accesorio | `normalizeEncounter()` línea 20 |
| **Pretil** | Terminación tipo pretil, dos perfiles posibles | `normalizeEncounter()` línea 22 |
| **Cumbrera** | Ridge compartida entre dos faldones, un perfil único | `normalizeEncounter()` línea 21 |
| **Desnivel** | Dos alturas / dos cubiertas, perfiles alto/bajo | `normalizeEncounter()` línea 22 |
| **Encuentro** | Segmento compartido entre dos rectángulos en planta | `findEncounters()` línea 92 |
| **Largo (`L`)** | Longitud del encuentro (1D overlap) | `findEncounters()` línea 122 / 156 |
| **Rasante** | Accesorio de borde delantero/trasero | `PERFIL_TECHO.gotero_frontal` |
| **Babeta** | Accesorio de junta muro-panel | `PERFIL_TECHO.babeta_adosar / babeta_empotrar` |
| **Lima-olla** | ??? | — (NO EXISTE) |
| **Perímetro Exterior** | Aristas libres del techo (menos encuentros) | `buildExteriorSegments()` línea 226 |

---

**Documento generado por auditoría code-blind (read-only) contra commit `abe9936`.  
Sin modificaciones de código. Sin commits.**

