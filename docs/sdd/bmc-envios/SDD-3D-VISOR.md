---
title: SDD — Visor 3D Estiba Interactiva
version: 0.2
date: 2026-08-07
status: Implemented (MVP)
parent: docs/sdd/bmc-envios/SDD.md
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

## Paths

- `src/components/logistica/ViewerChrome.jsx`
- `src/components/logistica/LogisticaCargoScene3d.jsx`
- `src/components/logistica/TruckVisual.jsx` — procedural BMC cab/bed (**see** `docs/sdd/logistica-truck-visual/SDD.md`)
- `src/utils/logistica/truckAxles.js`
- `src/utils/logistica/stackPhysics.js`
- `src/utils/logistica/loadWarnings.js`
- `src/utils/logistica/yardLayout.js`
- `src/utils/logistica/freeDragLayout.js`

## Operator tips (ES)

1. **Fullscreen** / altura del visor: toolbar del 3D.
2. **Free-Drag ON** → 1 clic detalle; **doble-clic y mantener** para mover; soltar fija.
3. **Shift+clic** varios bultos → mover en grupo (incluye tapados si están todos arriba seleccionados).
4. **Descargar camión** → pedidos en pilas separadas (yard); rearmar arrastrando al camión.
5. Limitante largo sobre corto → diálogo; si aceptás, queda en **Avisos de estiba** del plan.

## ADRs

See parent SDD ADR-021–025 (constraints, free-drag, yard, load warnings).
