---
title: SDD — Visor 3D Estiba Interactiva
version: 0.3
date: 2026-08-08
status: Implemented (MVP) + TruckVisual con fallos abiertos
parent: docs/sdd/bmc-envios/SDD.md
related:
  - docs/sdd/bmc-envios/SDD-LOGISTICA-REVISION-2026-08-08.md
---

# Visor 3D Estiba — As-built MVP

## Features shipped

| Feature | Status |
|---------|--------|
| Resize height + drag handle (`ViewerChrome`) | DONE |
| Fullscreen + iOS pseudo-FS | DONE |
| 1-click = detail only | DONE |
| Double-click + hold = drag; release = fix | DONE |
| Buried block + multi-select Shift | DONE |
| Length-on-shorter confirm + LoadWarning | DONE |
| LoadWarnings in plan de carga | DONE |
| Descargar camión → yard piles | DONE |
| Free-Drag ON/OFF + persist | DONE |
| Camión procedural BMC (`TruckVisual`) | **SHIPPED CON FALLOS** — ver §Diagnóstico |

## Paths

- `src/components/logistica/ViewerChrome.jsx`
- `src/components/logistica/LogisticaCargoScene3d.jsx`
- `src/components/logistica/TruckVisual.jsx` — camión procedural (cabina, caja, ejes, luces)
- `src/utils/logistica/truckAxles.js` — `axleCount()`
- `src/utils/logistica/stackPhysics.js`
- `src/utils/logistica/loadWarnings.js`
- `src/utils/logistica/yardLayout.js`
- `src/utils/logistica/freeDragLayout.js`

## Contrato de coordenadas

`CONFIRMED` `src/components/logistica/TruckVisual.jsx:5-11`. Todo componente que se agregue a la escena debe respetarlo:

```
TRUCK_W = 2.4
Cargo X: [shiftX, shiftX + truckL]
Cargo Z: [0, TRUCK_W], centro = TRUCK_W / 2
Cabina:  X < shiftX  (a la izquierda de la carga)
```

`TruckVisual` es **visual puro**: no afecta packing, free-drag ni coordenadas de carga. Recibe solo `{ shiftX, truckL }`.

`axleCount(length)`: ≤6 m → 2 ejes; >6 m → 3 ejes (duales bajo la caja).

## Operator tips (ES)

1. **Fullscreen** / altura del visor: toolbar del 3D.
2. **Free-Drag ON** → 1 clic detalle; **doble-clic y mantener** para mover; soltar fija.
3. **Shift+clic** varios bultos → mover en grupo (incluye tapados si están todos arriba seleccionados).
4. **Descargar camión** → pedidos en pilas separadas (yard); rearmar arrastrando al camión.
5. Limitante largo sobre corto → diálogo; si aceptás, queda en **Avisos de estiba** del plan.
6. **Clic en la cabina** → enciende faros y luz interior por 10 s.

---

## Diagnóstico `TruckVisual` — 2026-08-08

`TruckVisual.jsx` (388 líneas) aterrizó en `72cba1f` (#937) y se monta en `LogisticaCargoScene3d.jsx:519`, **dentro del mismo `<Canvas>`** que `OrbitControls` (`:548`) y que los bultos con free-drag (`:375`). Hasta la v0.2 de este documento no figuraba en ningún SDD; el handoff del mismo día (`docs/team/HANDOFF-2026-08-07-0827.md`) lo marca dos veces como WIP a no tocar.

| # | Hallazgo | Evidencia | Severidad |
|---|---|---|---|
| **V1** | **Captador de clic invisible de volumen completo.** Un `mesh` con `meshBasicMaterial` `opacity={0}` cubre toda la cabina y llama `stopPropagation` + `stopImmediatePropagation` en `onPointerDown`, `onPointerUp` y `onPointerOver`. Sigue siendo raycasteable: ningún puntero sobre la zona de cabina llega a `onPointerMissed` (`:653`) ni a OrbitControls. Orbitar o arrastrar empezando sobre la cabina se traga el evento. | `TruckVisual.jsx:285-300`, `:154-160` | **Alta** |
| **V2** | **`truckL` sin coerción numérica al restaurar borrador.** `if (parsed.truckL) setTruckL(parsed.truckL)` acepta lo que venga en el JSON. La cadena 3D mezcla `*` y `/` (que coercionan a número) con `+` (que **concatena strings**): con `truckL = "8"`, `HeightGuides` evalúa `shiftX + truckL` → `"08"` → coordenada string → NaN en three.js. | `BmcLogisticaApp.jsx:1961`; `LogisticaCargoScene3d.jsx:449` | **Alta** |
| **V3** | **Luces agregadas dinámicamente.** El clic en cabina monta 2 `spotLight` + 2 `pointLight` por 10 s. Cambiar la **cantidad** de luces fuerza recompilación de shaders de todos los materiales de la escena — congelamiento visible con muchos bultos, cada 10 s. | `TruckVisual.jsx:256-282`, `CAB_LIGHTS_MS` | Media |
| **V4** | **`key` con float.** `rearAxles.map((x) => <Wheel key={x} …/>)`: con `truckL` inválido las dos posiciones colapsan al mismo valor → keys duplicadas. | `TruckVisual.jsx:383-385` | Baja |
| **V5** | **Cursor global mutado.** `document.body.style.cursor` se escribe en `onPointerOver`/`onPointerOut`; si el componente desmonta con el puntero encima, el cursor queda en `pointer` para toda la app. | `TruckVisual.jsx:290-296` | Baja |
| **V6** | **Textura sin caché ni `dispose`.** `new THREE.TextureLoader()` por montaje, nunca liberada. Tiene fallback a silueta emisiva, así que **no crashea**. | `TruckVisual.jsx:79-99` | Baja |
| **V7** | **Sin cobertura de comportamiento.** El único test es un grep estructural que verifica el import y la forma del JSX — no ejecuta nada. | `tests/truckAxles.test.js` | Media |
| **V8** | **Presión de memoria WebGL.** `preserveDrawingBuffer: true` + `shadows` + `dpr [1,1.75]`. Ya hay antecedente registrado de `WebGL context lost (buffer)`. | `LogisticaCargoScene3d.jsx:645-648`; `docs/team/ux-feedback/LIVE-DEVTOOLS-NARRATIVE-REPORT-2026-04-02-localhost-5173.md:52` | Media |

Complemento: `axleCount()` **no valida su entrada** — `axleCount(undefined)` devuelve 3 en silencio porque `undefined <= 6` es `false` (`CONFIRMED` `src/utils/logistica/truckAxles.js`).

### Orden sugerido de corrección

**V1 → V2 → V7 → V3.** V1 y V2 explican solos la mayoría de los síntomas de "el visor no responde" o "el camión se dibuja mal". V7 es lo que evita que vuelva: hoy el único test no ejecuta nada del componente.

Notas para quien lo arregle:

- **V1** — la corrección natural es dejar el captador de clic sin `stopPropagation` en `onPointerDown`/`onPointerUp` (que son los que necesita OrbitControls) y conservarlo solo en `onClick`. Alternativa: `raycast={null}` en el mesh y mover el handler a la carrocería.
- **V2** — coercionar en el borde: `setTruckL(Number(parsed.truckL) || 8)`. Conviene además un guard en la escena que no renderice geometría con `truckL` no finito.
- **V7** — un test que monte la escena con `truckL` string, `truckL` `undefined` y `truckL` `0`, y verifique que no salen coordenadas NaN.

## ADRs

Ver ADR-021–025 del SDD padre (constraints, free-drag, yard, load warnings) y **ADR-028** (`TruckVisual` visual-only y su contrato de puntero).

## Changelog

| Versión | Fecha | Cambio |
|---|---|---|
| 0.3 | 2026-08-08 | Alta de `TruckVisual.jsx` y `truckAxles.js` en Paths (faltaban); contrato de coordenadas explícito; diagnóstico V1–V8 con orden de corrección. |
| 0.2 | 2026-08-07 | Free-Drag, yard, load warnings. |
