# Commit dec007b

- Fecha: 2026-04-19
- Hora: 07:45:36
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: -
- Commit: fix: adjust positioning and dimensions in RoofPreview and RoofPlanDimensions components

## Resumen
adjust positioning and dimensions in RoofPreview and RoofPlanDimensions components

## Descripción
Este cambio registra el commit `fix: adjust positioning and dimensions in RoofPreview and RoofPlanDimensions components` dentro del sistema de trazabilidad del proyecto. Se modificaron 9 archivos: docs/dev-trace/AUTOTRACE-CHANGELOG.md, docs/dev-trace/AUTOTRACE-STATUS.md, docs/dev-trace/AUTOTRACE-UNRELEASED.md, docs/dev-trace/commits/2026/04/0a5667b.md, docs/dev-trace/commits/index.json y 4 más.

Contexto del commit:
Updated the positioning and dimensions in the RoofPreview and RoofPlanDimensions components to ensure correct placement and improve clarity in calculations. This includes changes to the handling of non-finite numbers and formatting compliance with ISO standards.

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): docs, src

## Archivos modificados
- docs/dev-trace/AUTOTRACE-CHANGELOG.md
- docs/dev-trace/AUTOTRACE-STATUS.md
- docs/dev-trace/AUTOTRACE-UNRELEASED.md
- docs/dev-trace/commits/2026/04/0a5667b.md
- docs/dev-trace/commits/index.json
- docs/dev-trace/worklog/2026/04/2026-04-19.md
- src/hooks/useRoofPreviewPlanLayout.js
- src/utils/panelLayout.js
- src/utils/roofPlanCotaObstacles.js

## Diff summary
```text
docs/dev-trace/AUTOTRACE-CHANGELOG.md        |  1 +
 docs/dev-trace/AUTOTRACE-STATUS.md           |  7 +++--
 docs/dev-trace/AUTOTRACE-UNRELEASED.md       |  1 +
 docs/dev-trace/commits/2026/04/0a5667b.md    | 44 ++++++++++++++++++++++++++++
 docs/dev-trace/commits/index.json            | 29 ++++++++++++++++++
 docs/dev-trace/worklog/2026/04/2026-04-19.md | 15 ++++++++++
 src/hooks/useRoofPreviewPlanLayout.js        |  2 +-
 src/utils/panelLayout.js                     |  4 ++-
 src/utils/roofPlanCotaObstacles.js           | 30 +++++++++++++++----
 9 files changed, 122 insertions(+), 11 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
