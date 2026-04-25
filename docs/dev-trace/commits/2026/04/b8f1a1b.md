# Commit b8f1a1b

- Fecha: 2026-04-24
- Hora: 22:51:43
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: pdf+roofplan
- Commit: feat(pdf+roofplan): full profile names in 2D strips + 2D plan on page 1

## Resumen
full profile names in 2D strips + 2D plan on page 1

## Descripción
Este cambio registra el commit `feat(pdf+roofplan): full profile names in 2D strips + 2D plan on page 1` dentro del sistema de trazabilidad del proyecto. Se modificaron 4 archivos: src/components/RoofPreview.jsx, src/utils/helpers.js, src/utils/quotationPreviewSampleData.js, src/utils/quotationViews.js.

Contexto del commit:
RoofPreview.jsx:
- Border strips now show full catalog profile name (resolveFullLabel)
  instead of short abbreviation — centered and clipped within the band
- Font size reduced slightly (max 0.095→ from 0.115) to fit longer names

quotationViews.js:
- Page 1 of HOJA VISUAL CLIENTE now includes the 2D roof plan thumbnail
  between the "Producto / alcance" banner and the BOM table (when
  snapshotImages.roofPlan2d is available)
- Multi-zone support: buildPdfPlantaResumenPageHtml renders one SVG strip
  per zone when appendix.roofBlocks[] is provided (vs single roofBlock)

helpers.js (bomToGroups):
- Panel items enriched with cantPaneles × largoPanel in label
  ("ISODEC EPS 100mm · 13 paneles × 10.00 m")
- Falls back to "· N paneles" when largoPanel is undefined (multi-zone)

quotationPreviewSampleData.js:
- Updated to ISODEC EPS 100mm solo_techo demo case (Frigorífico del Norte)
- Two panel rows of different lengths to demonstrate multi-zone display

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): src

## Archivos modificados
- src/components/RoofPreview.jsx
- src/utils/helpers.js
- src/utils/quotationPreviewSampleData.js
- src/utils/quotationViews.js

## Diff summary
```text
src/components/RoofPreview.jsx          |   4 +-
 src/utils/helpers.js                    |  10 ++-
 src/utils/quotationPreviewSampleData.js | 117 ++++++++++++++++----------------
 src/utils/quotationViews.js             |  17 +++--
 4 files changed, 82 insertions(+), 66 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
