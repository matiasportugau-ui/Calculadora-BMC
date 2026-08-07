---
title: System Design Document — Irregular Roof Panel Layout (BMC)
version: 1.1
date: 2026-08-07
status: As-Built operator MVP
author: rebuild 2026-08-07
system_slug: roof-irregular-panel-layout
---

# System Design Document: Irregular Roof Panel Layout

**Brief:** Stepped factory lengths for diagonal/irregular techos. Factory square ends only. Site diagonal = corte en obra. BOM = ordered m² when Modo irregular + cut/manual.

## 1. Introduction & Goals

Operators need per-strip order lengths when the roof plan is not rectangular. UI is Freeform-like (ruler + angle) on RoofPreview. Default mode **OFF**.

## 2–5. Architecture

- Pure engine: `src/utils/irregularRoofLayout.js` (`buildIrregularSchedule`)
- UI: `IrregularModeChrome` + `IrregularPlantOverlay` on `RoofPreview`
- BOM: `calcPanelesTechoFromOptionalIrregular` → `calcTechoCompleto` + `scenarioOrchestrator` zone 0
- Calculator state: `irregularLayout` in `PanelinCalculadoraV3_backup.jsx`

## 6. AI Architecture

**N/A** — geometry tool, not LLM.

## 7–12. Data / quality / ADRs

- Schema `bmc-irregular-layout-v1`
- Price ordered area; show waste
- Tests: `tests/irregularRoofLayout.test.js`

Residual: remnant tray, multi-zone, PDF schedule rows.
