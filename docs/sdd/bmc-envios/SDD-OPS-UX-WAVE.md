---
title: System Design Document — BMC Envíos Ops UX Wave (F1–F6)
version: 1.1
date: 2026-08-05
status: As-Built
author: sdd-architect + glory re-audit
system_slug: bmc-envios-ops-ux
parent: docs/sdd/bmc-envios/SDD.md
stack: React 18 + Vite + @dnd-kit/core + R3F + Sheets gviz CSV
evidence_policy: CONFIRMED | INFERRED | TARGET
---

# SDD — BMC Envíos Ops UX Wave (F1–F6)

**Agent brief:** Ops UX improvements on `/logistica`. Prefer reuse of packing meta, `loadCharacteristics`, manual overrides, and pure modules under `src/utils/logistica/`. Parent SoT: [`SDD.md`](./SDD.md) v1.4.

## Status

**As-Built** on `main` via PRs **#842** (F2), **#845** (F1/F3a), **#848** (F3b), **#849** (F4–F6).

## Goals (shipped)

| ID | Goal | Status |
|----|------|--------|
| F1 | Collapsible stop cards | **DONE** |
| F2 | Ventas search haystack + coordination chips | **DONE** |
| F3a | Stop list reorder | **DONE** |
| F3b | Remito Presupuesto Simple + package volumes | **DONE** |
| F4 | 3D labels cliente + pedido + detail + cabin | **DONE** |
| F5 | Package fila A/B override (manual layout) | **DONE** |
| F6 | Printable load plan multi-view | **DONE** |

## Module map (CONFIRMED)

| Module | Path |
|--------|------|
| coordinationStatus | `src/utils/logistica/coordinationStatus.js` |
| ventasSearch | `src/utils/logistica/ventasSearch.js` |
| stopReorder | `src/utils/logistica/stopReorder.js` |
| remitoPackageMetrics | `src/utils/logistica/remitoPackageMetrics.js` |
| packageDrop | `src/utils/logistica/packageDrop.js` |
| loadPlanPrintModel | `src/utils/logistica/loadPlanPrintModel.js` |
| 3D scene | `src/components/logistica/LogisticaCargoScene3d.jsx` |
| UI shell | `src/components/BmcLogisticaApp.jsx` |

## Tests

```bash
node tests/coordinationStatus.test.js
node tests/ventasSearchFilter.test.js
node tests/stopReorder.test.js
node tests/remitoPackageMetrics.test.js
node tests/packageDrop.test.js
node tests/loadPlanPrintModel.test.js
```

## ADRs

See parent SDD §10 ADR-012–014 and plan ADRs O1–O7 (search haystack, F/G chips, loadCharacteristics reuse, overrides not free physics, SVG-first layout, remito print CSS, decorative cabin).

## Residual (not this wave)

U3 FSM · P2 geocode · P5 server ENV · free 3D package drag physics.

## AI architecture

**N/A** — no LLM in this wave.
