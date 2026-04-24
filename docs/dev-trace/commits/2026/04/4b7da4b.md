# Commit 4b7da4b

- Fecha: 2026-04-24
- Hora: 06:38:13
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: sheets
- Commit: fix(sheets): treat non-URL link_presupuesto values as null instead of returning display text

## Resumen
treat non-URL link_presupuesto values as null instead of returning display text

## Descripción
Este cambio registra el commit `fix(sheets): treat non-URL link_presupuesto values as null instead of returning display text` dentro del sistema de trazabilidad del proyecto. Se modificaron 8 archivos: .accessible-base/kb.json, docs/dev-trace/AUTOTRACE-CHANGELOG.md, docs/dev-trace/AUTOTRACE-STATUS.md, docs/dev-trace/AUTOTRACE-UNRELEASED.md, docs/dev-trace/commits/2026/04/25fc842.md y 3 más.

Contexto del commit:
sheets.values.get returns the display label of HYPERLINK formula cells
(e.g. "44", "45") instead of the actual href. Add extractPdfUrl() in
crmRowParse.js so parseCrmRowAtoAK only sets linkPresupuesto when the
raw cell value starts with http:// or https://; otherwise returns null.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): .accessible-base, docs, server

## Archivos modificados
- .accessible-base/kb.json
- docs/dev-trace/AUTOTRACE-CHANGELOG.md
- docs/dev-trace/AUTOTRACE-STATUS.md
- docs/dev-trace/AUTOTRACE-UNRELEASED.md
- docs/dev-trace/commits/2026/04/25fc842.md
- docs/dev-trace/commits/index.json
- docs/dev-trace/worklog/2026/04/2026-04-24.md
- server/lib/crmRowParse.js

## Diff summary
```text
.accessible-base/kb.json                     |  4 +--
 docs/dev-trace/AUTOTRACE-CHANGELOG.md        |  1 +
 docs/dev-trace/AUTOTRACE-STATUS.md           |  8 ++---
 docs/dev-trace/AUTOTRACE-UNRELEASED.md       |  1 +
 docs/dev-trace/commits/2026/04/25fc842.md    | 51 ++++++++++++++++++++++++++++
 docs/dev-trace/commits/index.json            | 36 ++++++++++++++++++++
 docs/dev-trace/worklog/2026/04/2026-04-24.md | 16 +++++++++
 server/lib/crmRowParse.js                    | 15 +++++++-
 8 files changed, 125 insertions(+), 7 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
