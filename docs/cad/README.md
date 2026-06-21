# Croquis → CAD (DXF + SVG/PDF profesional)

MVP **local** que convierte una huella de planta (corregida por el operador) en un
**plano 2D profesional acotado**, descargable como **DXF editable** (AutoCAD/QCAD/FreeCAD/
LibreCAD) y como **SVG** (→ PDF con el pipeline existente). Pensado para **operador interno**.

> Estado: desarrollado y verificado en local (no desplegado). Frontend pendiente de cableado.

## Dos flujos separados (UI)

- **Subir plano → Presupuesto** — `/hub/plan-import` (`BmcPlanImportModule.jsx`, ya existía):
  plano existente → interpretar → elegir panel → abrir en la calculadora → **cotización**.
- **Crear plano (CAD)** — `/hub/crear-plano` (`BmcCrearPlanoModule.jsx`, NUEVO): croquis o medidas
  → **plano profesional** (preview SVG + descarga DXF). Dos orígenes de forma:
  - *Subir croquis (IA):* `POST /api/plan/interpret` → `footprint` → preview/descarga.
  - *Ingresar medidas:* presets Rectángulo / L / T (sin IA — funciona sin API key).

## Pipeline (Crear plano)

```
[Croquis/PDF/foto]                            [Medidas a mano: presets]
  POST /api/plan/interpret  ── footprint ──┐  Rectángulo / L / T ──┐
  (Claude/Gemini visión)      (m, Y-up)     ├──▶ footprint [[x,y],…] ─▶ POST /api/plan/cad
                                            ┘                          │
                                                                       ├─▶ DXF (editable)
                                                                       └─▶ SVG (→ PDF Playwright)
```

- La **mitad de entrada ya existía**: `server/lib/planInterpreter.js` + `POST /api/plan/interpret`
  + UI `/hub/plan-import` (`src/components/PlanUploadModal.jsx`, `PlanInlineDropZone.jsx`,
  `BmcPlanImportModule.jsx`).
- Lo nuevo es la **mitad de salida CAD** (`server/lib/cad/*` + `POST /api/plan/cad`).

## Convención canónica de geometría

- **Unidades:** metros. **Ejes:** Y-up, origen abajo-izquierda (convención CAD/DXF).
- El **DXF** usa estas coordenadas directo (`$INSUNITS=6`). El **SVG invierte Y** en un único
  lugar (`svgExport.js`) — evita el bug clásico de doble-flip SVG↔CAD.
- Entrada: `footprint` = polígono rectilíneo de vértices `[x,y]` (cualquier orientación → se
  normaliza a CCW). Interior vacío (perímetro) en el MVP.

## Módulos

| Archivo | Rol |
|---|---|
| `server/lib/cad/planGeometry.js` | Modelo canónico: normaliza footprint, offset de muro interior, aristas, **cotas automáticas**, bbox, área (shoelace). |
| `server/lib/cad/dxfExport.js` | Geometría → DXF (`@tarikjabiri/dxf`). Capas AIA, cotas explotadas, muros doble línea. |
| `server/lib/cad/svgExport.js` | Geometría → SVG profesional (contorno, cotas rojas, norte, escala, cajetín). |
| `server/routes/planCad.js` | `POST /api/plan/cad` (JSON o descarga `?format=dxf|svg`). Montado en `server/index.js`. |
| `scripts/cad-demo.mjs` | Demo: genera `docs/cad/demo-plano.{dxf,svg,png}` y valida round-trip. |
| `tests/cad-export.test.js` | Test offline (19 asserts). `node tests/cad-export.test.js`. |

## API — `POST /api/plan/cad`

```jsonc
// body
{
  "footprint": [[5.5,0],[8.5,0],[8.5,9],[14,9],[14,15],[0,15],[0,9],[5.5,9]], // m, Y-up
  "wallThickness": 0.20,            // opcional (default 0.20)
  "title": { "titulo": "...", "subtitulo": "...", "pie": "...", "lamina": "Lám. 01" },
  "format": "json"                  // "json" (default) | "dxf" | "svg"
}
// resp (json): { ok, areaM2, bbox, dxf: "<texto DXF>", svg: "<svg…>" }
// resp (dxf|svg): descarga del archivo (Content-Disposition: attachment)
```

## Librerías open-source

- **`@tarikjabiri/dxf`** (MIT) — writer DXF en TS; capas, LINE/LWPOLYLINE/TEXT, salida UTF-8.
- **`dxf`** (dev) — reader para validar round-trip en tests.
- **`@resvg/resvg-js`** (dev) — rasteriza SVG→PNG para previsualización del demo.
- Pipeline PDF y geometría: **reutiliza** lo existente (`server/routes/pdf.js`, `roofPlanGeometry.js`).

## IA de interpretación (multi-proveedor)

`server/lib/visionExtract.js` interpreta imagen/PDF/DXF usando **todos los proveedores
configurados con fallback en cadena**: **Claude · Gemini · OpenAI (gpt-4o) · Grok
(grok-2-vision-1212)**. Reusa `aiProviderConfig.js` (keys, modelos permitidos, orden).

- `interpretPlan(buf, mime, name, { provider, model })` — proveedor/modelo opcional; sino usa el
  **recomendado para visión** (`VISION_PROVIDER_PREFERENCE = claude → gemini → openai → grok`) y
  cae al siguiente si falla. Soporte por tipo: imagen = los 4; PDF = Claude/Gemini; DXF/texto = los 4.
- `GET /api/plan/ai-options` → `{ providers, autoOrder, recommended:{provider,model,reason} }`.
- El módulo **Crear plano** trae un **selector de modelo** (Automático/recomendado o
  proveedor+modelo) y muestra con qué IA se interpretó.
- Sin API key real, el endpoint responde un 502 con el detalle por proveedor (fallback correcto).

## Decisiones clave (del research log del plan)

1. **Cotas explotadas (LINE+TEXT), no entidades `DIMENSION`.** AutoCAD no renderiza `DIMENSION`
   sin el *anonymous content block*; las primitivas se ven idénticas en todos los CAD.
2. **Capas AIA/NCS** (`A-WALL`, `A-ANNO-DIMS`, `A-ANNO-TEXT`, `A-AREA-IDEN`, `A-ANNO-TTLB`).
3. **Y-up canónico**, flip único para SVG; `$INSUNITS=6` (metros).
4. **DXF UTF-8 (R2007+)** → acentos español OK (BAÑO, EXTENSIÓN); nombres de capa en ASCII.
5. **Offset de muro pure-JS** (sin WASM) — suficiente para huellas rectilíneas.

## Verificación

```bash
NODE_ENV=  npm i --include=dev        # asegura dev deps (dxf, resvg)
node tests/cad-export.test.js         # 19 asserts (geometría, capas, round-trip, SVG)
node scripts/cad-demo.mjs             # genera docs/cad/demo-plano.{dxf,svg,png}
# abrir docs/cad/demo-plano.dxf en QCAD/FreeCAD/LibreCAD para aceptación visual
```

Resultado de referencia (huella en T de Dolores): **área 111 m²**, DXF ~10 KB con 61 entidades y
las 5 capas AIA; SVG/PNG con cotas de perímetro completas (14 · 6 · 5,50 · 9 · 3) + conjunto.

## Pendiente (futuro)

- **Frontend (mejoras):** canvas de corrección arrastrable (reusar `RoofPreview`) + calibración
  de escala (una medida conocida / puerta ≈ 0,90 m) + export PDF desde el módulo. (El módulo
  base `BmcCrearPlanoModule` ya está: subir croquis IA / presets + preview SVG + descarga DXF/SVG.)
- **Seguridad:** validar magic-bytes (`file-type`) y re-encodear imágenes antes de visión.
- **PDF vectorial directo** (`pdfjs-dist`) cuando el PDF subido ya es CAD.
- **DWG** (LibreDWG / ODA) e **IFC** (web-ifc) on-demand.
- **Análisis BMC:** alimentar el cómputo de cubiertas/BOM desde la misma geometría.
