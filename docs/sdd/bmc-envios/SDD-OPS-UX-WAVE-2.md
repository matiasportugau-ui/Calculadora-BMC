---
title: System Design Document — BMC Envíos Ops UX Wave 2 (F7–F11)
version: 1.0
date: 2026-08-05
status: As-Built (MVP)
author: glory + wave2
system_slug: bmc-envios-ops-ux-wave-2
parent: docs/sdd/bmc-envios/SDD.md
---

# SDD — Ops UX Wave 2 (F7–F11)

Parent SoT: [`SDD.md`](./SDD.md). Wave 1 (F1–F6): [`SDD-OPS-UX-WAVE.md`](./SDD-OPS-UX-WAVE.md).

## Goals

| ID | Goal | Status |
|----|------|--------|
| F7 | Button contrast on dark diagram (`variant=onDark`) | **DONE** |
| F8 | Package identity `k/N · #pedido · Cliente` | **DONE** |
| F9 | Click → highlight client group + detail drawer (contact, map, PDF, remito) | **DONE** |
| F10 | Stack above/below contiguous package (manual order) | **DONE** (DnD list deferred) |
| F11 | Ventas CSV proxy + clearer errors + diagramView persist | **DONE** |

## Module map

| Module | Path |
|--------|------|
| btnStyle | `src/utils/logistica/btnStyle.js` |
| packageIdentity | `src/utils/logistica/packageIdentity.js` |
| packageDrop (+ stack) | `src/utils/logistica/packageDrop.js` |
| ventas-csv proxy | `GET /api/envios/ventas-csv` |
| UI | `BmcLogisticaApp.jsx` DiagramPanel |
| 3D | `LogisticaCargoScene3d.jsx` |

## Tests

```bash
node tests/btnStyle.test.js
node tests/packageIdentity.test.js
node tests/packageDrop.test.js
```

## Residual

- F10b list DnD reorder
- Free 3D physics drag (non-goal)
- Theme Studio (other module)
