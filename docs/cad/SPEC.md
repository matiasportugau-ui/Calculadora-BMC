# Especificación completa — Sistema de Planos BMC (Croquis → CAD / Presupuesto)

> Versión 1.0 · Estado: **en producción** (PR #422 mergeado a `main`).
> Documento canónico de especificación. Complementa `docs/cad/README.md` (guía operativa).

---

## 1. Resumen y objetivos

El sistema agrega a Calculadora BMC **un único módulo «Planos»** (`/hub/planos`,
`BmcPlanosModule`) que, desde un mismo motor, produce **ambas** salidas a partir de cualquier
origen. Las rutas antiguas `/hub/crear-plano` y `/hub/plan-import` redirigen a `/hub/planos`.

| Origen | Entrada | Salidas disponibles |
|--------|---------|---------------------|
| **Croquis a mano (IA)** | foto/PDF de un dibujo rústico | Exportar plano (DXF/SVG) · Cotizar |
| **Plano del cliente (IA)** | plano definido (JPG/PNG/PDF/DXF) | Cotizar · Exportar plano |
| **Medidas** | presets Rectángulo / L / T | Exportar plano (DXF/SVG) · Cotizar |

**Principio rector:** un mismo input se **interpreta una vez** y habilita las dos salidas
co-iguales — el **plano** (editable por software de arquitectura) y el **presupuesto** (carga en la
calculadora para seguir editando). Arquitectura compartida, no dos flujos paralelos.

### Objetivos no funcionales
- **Interoperabilidad CAD:** salida DXF abierta, nomenclatura **AIA/NCS**, unidades métricas.
- **Determinismo:** el motor de geometría/exportación es puro y testeable sin red ni IA.
- **Resiliencia IA:** funciona con cualquiera de 4 proveedores; degrada con fallback en cadena.
- **Usuario:** operador interno BMC (auth + grants existentes, módulo `plan-import`).

---

## 2. Arquitectura

```
┌────────────────────────── FRONTEND (React/Vite) ──────────────────────────┐
│  /hub/crear-plano  BmcCrearPlanoModule  ── subir croquis | medidas ──┐     │
│  /hub/plan-import  BmcPlanImportModule  ── subir plano ──┐           │     │
└──────────────────────────────────────────────────────────┼───────────┼─────┘
                                                            │           │
              POST /api/plan/interpret ◄───────────────────┘           │
                 │  (multipart: file, provider?, model?, hints?)        │
                 ▼                                                       │
        server/lib/planInterpreter.js ── extractVisionJSON ──► visionExtract.js
                 │   (footprint, rooms, openings, zonas)        (Claude/Gemini/
                 │                                               OpenAI/Grok chain)
                 ├── Opción 2: bmcPayload → localStorage → PanelinCalculadoraV3
                 │             (applyQuoteSnapshot) → cotización editable
                 │
              POST /api/plan/cad ◄─────────────────────────────────────┘
                 │  (footprint, rooms, openings, scale, title, format)
                 ▼
        server/lib/cad/planGeometry.js  (modelo canónico, metros Y-up)
                 ├──► dxfExport.js  → DXF (capas AIA, cotas explotadas, cajetín ISO)
                 └──► svgExport.js  → SVG (flip Y) → PDF (pipeline Playwright)
```

**Convención geométrica canónica:** metros, **Y-up**, origen abajo-izquierda (convención CAD).
El DXF usa estas coordenadas directo (`$INSUNITS=6`); el **SVG invierte Y** en un único lugar
(`svgExport.js`) para evitar el doble-flip.

---

## 3. Modelo de datos canónico

`buildPlanGeometry(input)` → objeto geometría (fuente de verdad para DXF y SVG).

### 3.1 Entrada
```ts
{
  footprint: [number, number][],   // ≥3 vértices [x,y] en metros, Y-up (cualquier orientación)
  wallThickness?: number,          // m, default 0.20
  rooms?: { name, x, y, w, h }[],  // ambientes (rectángulos, m, Y-up)
  openings?: {                     // aberturas (segmentos sobre muro)
    type: "door" | "window", x1, y1, x2, y2, swing?: 1 | -1
  }[],
  scale?: number,                  // factor de calibración (default 1) aplicado a footprint/rooms/openings
  title?: {
    titulo, subtitulo, proyecto, cliente, lamina, escala, fecha, dibujo, pie
  }
}
```

### 3.2 Salida
```ts
{
  units: "m", convention: "Y-up",
  footprint: [x,y][],              // normalizado a CCW
  innerWall: [x,y][],              // offset interior (espesor de muro)
  wallThickness: number,
  edges: { a, b, len, dir, outward, orient:"H"|"V", mid }[],
  dims:  { kind:"edge"|"overall", orient, x1,y1,x2,y2, tx,ty, value, label }[],
  bbox:  { minX, minY, maxX, maxY },
  areaM2: number,                  // shoelace, |área|
  rooms:    { name, x, y, w, h, areaM2, cx, cy }[],
  openings: { type, x1,y1,x2,y2, len, mid, dir, swing }[],
  title: { ...campos del cajetín ISO }
}
```

### 3.3 Algoritmos
- **`signedArea`/`ensureCCW`** — orientación CCW (interior a la izquierda de cada arista).
- **`offsetInward(polyCCW, dist)`** — desplaza cada arista por su normal interior y corta
  consecutivas (juntas miter). Robusto para polígonos rectilíneos (incluye vértices reflex).
- **`buildEdges`** — normal exterior = rotar dir −90° (CCW); orientación H/V por |dx| vs |dy|.
- **`buildDims`** — una cota por arista (offset hacia afuera) + 2 de conjunto (ancho/alto bbox).
- **`fmtM`** — formato arquitectónico (coma decimal, 2 decimales).

---

## 4. API

### 4.1 `POST /api/plan/interpret` — interpretación de plano (multi-IA)
Rate limit 10/h. `multipart/form-data`.

**Request**
| Campo | Tipo | Notas |
|-------|------|-------|
| `file` | binario | JPG/PNG/WebP/PDF/DXF, ≤10 MB. DWG rechazado (→ exportar a DXF). |
| `provider` | string? | `claude`\|`gemini`\|`openai`\|`grok` (override; sino recomendado + chain). |
| `model` | string? | modelo específico para ese proveedor (validado contra allowlist). |
| `hints` | JSON? | `{ familia, espesor, escenario }` para completar gaps. |

**Response 200**
```jsonc
{
  "ok": boolean,                       // true si no quedan gaps
  "bmcPayload": {
    "scenario": "solo_techo"|"techo_fachada"|"solo_fachada"|null,
    "techo": { zonas, tipoAguas, pendiente, familia, espesor, color, tipoEst, borders, opciones } | null,
    "pared": { alto, perimetro, aberturas, numEsqExt, numEsqInt, ... } | null,
    "footprint": [x,y][] | null,        // perímetro para CAD (Opción 1)
    "footprintSource": "vision_polygon"|"single_rect"|null,
    "rooms": { name,x,y,w,h }[],         // ambientes detectados
    "openings": { type,x1,y1,x2,y2 }[]   // aberturas detectadas
  },
  "gaps": string[],                      // ["familia","espesor", ...]
  "warnings": string[],
  "extractedRaw": { ...esquema de visión },
  "ai": { provider, providerLabel, model }   // proveedor que resolvió
}
```
**Errores:** `400` (archivo no soportado / hints inválido), `422` (sin JSON interpretable / truncado),
`502` (ningún proveedor pudo, con detalle por proveedor), `503` (sin proveedor configurado).

### 4.2 `GET /api/plan/ai-options` — modelos disponibles + recomendación
```jsonc
{
  "ok": true,
  "autoOrder": ["claude","grok","gemini","openai"],   // proveedores con key, orden preferido
  "providers": [{ "id","label","defaultModel","models":[{ "id","label" }] }],
  "task": "vision_plan",
  "recommended": { "provider","providerLabel","model","reason" } | null
}
```

### 4.3 `POST /api/plan/cad` — geometría → CAD
Rate limit 60/h. `application/json`.

**Request**
```jsonc
{
  "footprint": [[x,y],...],   // requerido, m, Y-up
  "wallThickness": 0.20,      // opcional
  "rooms": [...], "openings": [...], "scale": 1,   // opcionales
  "title": { "titulo","proyecto","cliente","lamina","escala","fecha","dibujo" },
  "format": "json" | "dxf" | "svg"   // default json
}
```
**Response** — `json`: `{ ok, areaM2, bbox, dxf:"<texto>", svg:"<svg>" }`.
`dxf`/`svg`: descarga del archivo (`Content-Disposition: attachment`).
**Errores:** `400` (footprint inválido), `500`.

---

## 5. Capa de IA (multi-proveedor)

`server/lib/visionExtract.js` — extracción de JSON estructurado con **fallback en cadena**.

### 5.1 Proveedores y modelos de visión
| Proveedor | SDK | Modelo (imagen) | Imagen | PDF | Texto/DXF |
|-----------|-----|-----------------|:---:|:---:|:---:|
| Claude | `@anthropic-ai/sdk` | `anthropicPlanModel \|\| chatModel` | ✅ | ✅ | ✅ |
| Gemini | `@google/generative-ai` | `geminiChatModel` | ✅ | ✅ | ✅ |
| OpenAI | `openai` | `gpt-4o` | ✅ | ❌ | ✅ |
| Grok | `openai` (baseURL x.ai) | `grok-2-vision-1212` | ✅ | ❌ | ✅ |

### 5.2 Orden y recomendación
- `VISION_PROVIDER_PREFERENCE = [claude, gemini, openai, grok]`.
- **Recomendado** = primer disponible según esa preferencia (`recommendedVision()`).
- La cadena efectiva = `orderChain(getProviderChain(), preferProvider || recomendado)`; se saltean
  proveedores que no soportan el tipo de entrada; el primero que devuelve JSON válido gana.
- Override de modelo solo aplica al proveedor explícitamente elegido (validado por allowlist).
- Config central: `server/lib/aiProviderConfig.js` (keys, modelos permitidos, costos, etiquetas).

### 5.3 Esquema de visión (`extractedRaw`)
```jsonc
{
  "techoZonas": [{ "largoM","anchoM" }],
  "footprintPoligono": [[x,y]] | null,
  "ambientes": [{ "nombre","x","y","w","h" }],
  "aberturasPlano": [{ "tipo":"door"|"window","x1","y1","x2","y2" }],
  "tipoAguas": "una_agua"|"dos_aguas"|null, "pendienteGrados": number|null,
  "paredAltoM": number|null, "paredPerimetroM": number|null,
  "aberturas": [{ "anchoM","altoM","cant" }],
  "escenarioDetectado": "...", "confianza": "alta"|"media"|"baja", "notas": [string]
}
```
`resolveFootprint()`: prioriza `footprintPoligono` (válido si **todos** los vértices son finitos —
si alguno es inválido se descarta el polígono entero, no se deforma); si no, arma rectángulo cuando
hay exactamente una zona; sino `null` + warning (operador define el perímetro).

---

## 6. Exportación

### 6.1 DXF (`dxfExport.js`)
- Librería **`@tarikjabiri/dxf`** (MIT). Salida **UTF-8 (R2007+)** → acentos español OK; nombres de
  capa/STYLE en ASCII. Unidades metros (`$INSUNITS=6`, `$MEASUREMENT=1`). Solo *model space*.
- **Capas AIA/NCS:** `A-WALL · A-DOOR · A-GLAZ · A-ANNO-DIMS · A-ANNO-TEXT · A-AREA-IDEN ·
  A-ANNO-TTLB · A-GRID`.
- **Muros:** footprint + innerWall (doble línea). **Ambientes:** LWPOLYLine cerrada + nombre + área.
- **Aberturas:** puerta = hoja + **arco de barrido** (`addArc`, 90°, sentido por `swing`);
  ventana = doble línea.
- **Cotas = primitivas explotadas** (LINE + ticks + TEXT), **NO entidades `DIMENSION`**
  (AutoCAD no las renderiza sin el *anonymous content block*; las primitivas se ven idénticas en
  AutoCAD/QCAD/FreeCAD/LibreCAD).
- **Cajetín ISO:** marco + divisores + campos PROYECTO / CLIENTE / LÁMINA / ESCALA·FECHA / dibujó.

### 6.2 SVG (`svgExport.js`)
- Mismo modelo, con **flip Y** único. Render: muros doble línea, ambientes (rect punteado + nombre +
  área), aberturas (puerta arco / ventana doble línea), cotas rojas ISO, norte, escala gráfica,
  cajetín ISO con campos. → PDF vía pipeline Playwright existente (`server/routes/pdf.js`).

---

## 7. Frontend

### 7.1 `BmcPlanosModule` (`/hub/planos`) — módulo unificado
- **Paso 1 — Origen:** pestañas *Croquis a mano (IA)* | *Plano del cliente (IA)* | *Medidas*.
  Las dos primeras comparten subir+interpretar (`isUpload`); la tercera usa presets.
  - *Croquis:* **selector de IA** (proveedor + modelo, "Automático = recomendado", ★ sugerido) →
    `POST /api/plan/interpret` → `footprint` + `rooms` + `openings`. Muestra con qué IA se interpretó.
  - *Medidas:* presets **Rectángulo / L / T** (`presetFootprint`) — funciona **sin API key**.
- **Paso 2 — Generar:** Título/Proyecto, Cliente, Lámina + **calibración de escala**
  (medida en el dibujo → medida real ⇒ factor) → `POST /api/plan/cad`.
- **Paso 3 — Resultado:** preview SVG embebido + **Descargar DXF** / **Descargar SVG** + área +
  **«Cotizar este plano»** → bridge `bmc_pending_plan_import` → calculadora (presupuesto).

> **Interconexión (clave):** un mismo input (croquis/medidas) produce **ambas** salidas desde el
> mismo motor: el **plano** (export DXF/SVG/PDF) y el **presupuesto** (cotizar). `interpret`
> devuelve a la vez `footprint` (para CAD) y `techo.zonas` (para cotizar); el preset rústico se
> descompone en zonas exactas (`presetZonas`). Así el dibujo a mano se vuelve plano **y** cotización
> sin re-cargar nada — misma arquitectura compartida que «Subir plano».

### 7.2 Bridge a la calculadora
- **«Cotizar este plano»** y **«Abrir en calculadora»** guardan `bmc_pending_plan_import` en
  `localStorage` → `PanelinCalculadoraV3_backup.jsx` lo aplica con `applyQuoteSnapshot` →
  cotización editable. Las zonas vienen de la IA (`techo.zonas`) o de `presetZonas` (descomposición
  exacta de los presets); se les aplica la calibración de escala.
- Los módulos previos `BmcCrearPlanoModule.jsx` y `BmcPlanImportModule.jsx` fueron **removidos y
  fusionados** en `BmcPlanosModule.jsx`. Lo único "legado" son las **rutas** `/hub/crear-plano` y
  `/hub/plan-import`, que **redirigen** a `/hub/planos`.
- **Caso plano del cliente (zonas sin perímetro):** si la IA devuelve `techo.zonas` pero no
  `footprint`, el módulo **igual permite Cotizar** (no fuerza modo manual ni descarta las zonas);
  «Generar plano CAD» queda deshabilitado hasta tener perímetro (subir contorno claro o ingresar
  medidas).

### 7.3 Routing / grants
- `src/App.jsx`: ruta `/hub/planos` con `RequireGrant module="plan-import"`. `/hub/crear-plano` y
  `/hub/plan-import` → `<Navigate to="/hub/planos" />`.
- `BmcWolfboardHub.jsx`: una sola tarjeta "Planos".
- `ActivityTracker.jsx`: `/hub/planos` (+ legados) mapean a `plan-import`.

---

## 8. Inventario de archivos

| Archivo | Rol |
|---|---|
| `server/lib/cad/planGeometry.js` | Modelo canónico, offset muro, cotas, área, rooms/openings, título. |
| `server/lib/cad/dxfExport.js` | Geometría → DXF (capas AIA, cotas explotadas, aberturas, cajetín ISO). |
| `server/lib/cad/svgExport.js` | Geometría → SVG profesional (flip Y). |
| `server/lib/visionExtract.js` | Extracción JSON multi-proveedor con fallback + recomendación. |
| `server/lib/planInterpreter.js` | Esquema/prompt de visión; `mapToBmc`; `resolveFootprint`. |
| `server/routes/planCad.js` | `POST /api/plan/cad`. |
| `server/routes/planInterpret.js` | `POST /api/plan/interpret` + `GET /api/plan/ai-options`. |
| `server/lib/aiProviderConfig.js` | Config central de proveedores/modelos (reusado). |
| `src/components/BmcPlanosModule.jsx` | UI unificada «Planos»: 3 orígenes, export DXF/SVG + cotizar. |
| `tests/cad-export.test.js` | 29 asserts (geometría, capas, aberturas, escala, round-trip). |
| `tests/cad-pipeline-e2e.test.js` | 10 asserts (interpret→footprint→CAD, robustez). |
| `scripts/cad-demo.mjs` | Demo + render `docs/cad/demo-plano.{dxf,svg,png}`. |
| `docs/cad/README.md` | Guía operativa. |

---

## 9. Pruebas y verificación

- **Offline (CI, `test:core`):** `cad-export.test.js` + `cad-pipeline-e2e.test.js` (incluidos en
  `npm test`). Round-trip del DXF con el reader `dxf`.
- **Caso de referencia:** huella en T (cuerpo 14×6 + brazo 3×9) = **111 m²**, 8 capas AIA, cajetín ISO.
- **Producción (verificado):** `GET /api/plan/ai-options` → 200 (`autoOrder:[claude,grok,gemini,
  openai]`, recomendado claude/claude-opus-4-7); `POST /api/plan/cad` con cuadro 5×3 → 200
  (`areaM2:15`, dxf+svg).
- **Aceptación manual:** abrir `demo-plano.dxf` en QCAD/FreeCAD/LibreCAD (muros, cotas, capas, cajetín).

---

## 10. Seguridad

- Subida: límite 10 MB, allowlist de extensión/MIME, DWG rechazado, rate-limit (10/h interpret,
  60/h cad).
- **Pendiente (hardening recomendado):** validación de **magic bytes** (`file-type`) y re-encode de
  imágenes (recompresión JPEG + filtro) para mitigar prompt-injection multimodal en archivos de
  clientes. La salida atada a esquema (Structured Outputs) limita el daño.

---

## 11. Decisiones de diseño (log)

1. **Cotas explotadas, no `DIMENSION`** — AutoCAD no renderiza DIMENSION sin content block.
2. **Geometría canónica metros/Y-up**, flip único para SVG; `$INSUNITS=6`.
3. **Capas AIA/NCS** para interoperar con flujos de arquitectos.
4. **Offset de muro pure-JS** (rectilíneo) — sin WASM; clipper opcional para no-ortogonal.
5. **DXF R2007+ UTF-8** para acentos; capas en ASCII.
6. **IA multi-proveedor con fallback** + recomendación por tarea de visión; override por proveedor.
7. **Structured/validación estricta de footprint** — descartar polígono si algún vértice es inválido.
8. **Calibración de escala** (medida conocida) para croquis sin cotas.
9. **Dos flujos separados** (plano vs presupuesto) — outputs inversos, módulos independientes.

---

## 12. Roadmap

- **Export PDF** directo desde el módulo Crear plano (reusar pipeline Playwright).
- **Selector de IA** también en Subir plano → Presupuesto.
- **PDF vectorial directo** (`pdfjs-dist`) cuando el archivo subido ya es CAD.
- **Canvas de corrección** arrastrable (reusar `RoofPreview`) para editar footprint/ambientes.
- **DWG** (LibreDWG/ODA) e **IFC/BIM** (web-ifc) on-demand.
- **Hardening de seguridad** (magic bytes + re-encode).
- **Más fidelidad:** hatch de muros, mobiliario, capas A-FLOR/A-FURN, paper space + viewport.
