# Commit 857cdba

- Fecha: 2026-04-25
- Hora: 06:18:17
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: floor-plan
- Commit: feat(floor-plan): Gap A-D expansion — tipoAguas, per-zone roofBlocks, borders, labels

## Resumen
Gap A-D expansion — tipoAguas, per-zone roofBlocks, borders, labels

## Descripción
Este cambio registra el commit `feat(floor-plan): Gap A-D expansion — tipoAguas, per-zone roofBlocks, borders, labels` dentro del sistema de trazabilidad del proyecto. Se modificaron 2 archivos: src/utils/quotationPreviewSampleData.js, src/utils/quotationViews.js.

Contexto del commit:
Gap A — tipoAguas derivation from per-zone dosAguas flags (same logic as
derivedTipoAguas in the component; techo.tipoAguas="" deprecated in saved state).

Gap B — per-zone roofBlocks: reconstruct per-zone strip data from zone
dimensions + panelAu. Each zone now has its own strip diagram in the
appendix page (zonaRoofBlocks), replacing the single merged block.

Gap C — slopeMark in sample data (along_largo_pos for Z0/Z1, along_largo_neg
for Z2). Zone title shortening helper (_fpZoneTitle) for zones with rh<58px.

Gap D — Border profile color stripes on exterior edges:
- Merges globalBorders (techo-level) with per-zone preview.borders
- Only appears on genuinely exterior segments (via extLines, same-body
  junctions are already suppressed by buildZoneBorderExteriorLines)
- Color-coded: gotero=cyan, babeta=violet, canalon=blue, pretil=orange
- Abbreviated label rotated along the stripe

Also: globalBorders threaded through buildPdfAppendixPayload →
generateClientVisualHTML → svgFloorPlan → _svgFloorPlanGeometric.

Sample data updated to BMC-2026-0112 T-shape with slopeMark + globalBorders.
368 tests pass, lint clean.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): src

## Archivos modificados
- src/utils/quotationPreviewSampleData.js
- src/utils/quotationViews.js

## Diff summary
```text
src/utils/quotationPreviewSampleData.js |  10 ++-
 src/utils/quotationViews.js             | 139 ++++++++++++++++++++++++++++----
 2 files changed, 130 insertions(+), 19 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
