# Commit df65ada

- Fecha: 2026-04-27
- Hora: 04:24:50
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: feat/pdf-layout-selector
- Tipo: feat
- Scope: pdf-layouts
- Commit: feat(pdf-layouts): add template system + E-soft-modern layout + dropdown selector

## Resumen
add template system + E-soft-modern layout + dropdown selector

## Descripción
Este cambio registra el commit `feat(pdf-layouts): add template system + E-soft-modern layout + dropdown selector` dentro del sistema de trazabilidad del proyecto. Se modificaron 7 archivos: src/components/PanelinCalculadoraV3_backup.jsx, src/pdf-templates/blueprint.js, src/pdf-templates/construction-bold.js, src/pdf-templates/executive-dark.js, src/pdf-templates/index.js y 2 más.

Contexto del commit:
- src/pdf-templates/index.js: LAYOUT_OPTIONS, buildQuotationModel, getThemeTokens, renderPdfLayout dispatcher
- src/pdf-templates/soft-modern.js: full parametrized E layout (cover/plan/BOM 3 pages)
- src/pdf-templates/{executive-dark,blueprint,minimalist,construction-bold}.js: placeholders delegating to E
- PanelinCalculadoraV3_backup: pdfLayout state (localStorage bmc.pdfLayout), dropdown selector,
  handleClientePdf upgraded to build appendix + dispatch to layout renderer

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): src

## Archivos modificados
- src/components/PanelinCalculadoraV3_backup.jsx
- src/pdf-templates/blueprint.js
- src/pdf-templates/construction-bold.js
- src/pdf-templates/executive-dark.js
- src/pdf-templates/index.js
- src/pdf-templates/minimalist.js
- src/pdf-templates/soft-modern.js

## Diff summary
```text
src/components/PanelinCalculadoraV3_backup.jsx |  59 ++++++-
 src/pdf-templates/blueprint.js                 |   2 +
 src/pdf-templates/construction-bold.js         |   2 +
 src/pdf-templates/executive-dark.js            |   2 +
 src/pdf-templates/index.js                     | 125 ++++++++++++++
 src/pdf-templates/minimalist.js                |   2 +
 src/pdf-templates/soft-modern.js               | 224 +++++++++++++++++++++++++
 7 files changed, 407 insertions(+), 9 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
