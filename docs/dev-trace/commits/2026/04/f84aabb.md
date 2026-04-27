# Commit f84aabb

- Fecha: 2026-04-27
- Hora: 00:01:36
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: pdf
- Commit: fix(pdf): update PDF error handling and sample data

## Resumen
update PDF error handling and sample data

## Descripción
Este cambio registra el commit `fix(pdf): update PDF error handling and sample data` dentro del sistema de trazabilidad del proyecto. Se modificaron 24 archivos: .accessible-base/kb.json, docs/dev-trace/AUTOTRACE-CHANGELOG.md, docs/dev-trace/AUTOTRACE-STATUS.md, docs/dev-trace/AUTOTRACE-UNRELEASED.md, docs/dev-trace/commits/2026/04/1011293.md y 19 más.

Contexto del commit:
Enhanced error handling in pdf.js to return a 503 status on launch failure, ensuring proper client fallback mechanisms. Updated sample data in quotationPreviewSampleData.js and introduced a variable tracker script for improved monitoring. Adjusted build metadata in kb.json to reflect recent changes.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): .accessible-base, docs, public, src

## Archivos modificados
- .accessible-base/kb.json
- docs/dev-trace/AUTOTRACE-CHANGELOG.md
- docs/dev-trace/AUTOTRACE-STATUS.md
- docs/dev-trace/AUTOTRACE-UNRELEASED.md
- docs/dev-trace/commits/2026/04/1011293.md
- docs/dev-trace/commits/2026/04/1473bec.md
- docs/dev-trace/commits/2026/04/2cc04d9.md
- docs/dev-trace/commits/2026/04/351bc2f.md
- docs/dev-trace/commits/2026/04/3af1469.md
- docs/dev-trace/commits/2026/04/857cdba.md
- docs/dev-trace/commits/2026/04/be41d53.md
- docs/dev-trace/commits/index.json
- docs/dev-trace/worklog/2026/04/2026-04-25.md
- docs/team/knowledge/events-log.jsonl
- docs/team/knowledge/impact-map.json
- docs/team/knowledge/references-catalog.json
- docs/team/knowledge/reports/KNOWLEDGE-MAGAZINE-2026-04-25.html
- docs/team/knowledge/reports/KNOWLEDGE-MAGAZINE-2026-04-26.html
- docs/team/knowledge/reports/KNOWLEDGE-MAGAZINE-latest.html
- docs/team/knowledge/reports/KNOWLEDGE-REPORT-2026-04-25.md
- docs/team/knowledge/reports/KNOWLEDGE-REPORT-2026-04-26.md
- docs/team/knowledge/sources-registry.json
- public/quotation-preview/hoja-visual-cliente.html
- src/data/calculatorDataVersion.js

## Diff summary
```text
.accessible-base/kb.json                           |    4 +-
 docs/dev-trace/AUTOTRACE-CHANGELOG.md              |   14 +-
 docs/dev-trace/AUTOTRACE-STATUS.md                 |   12 +-
 docs/dev-trace/AUTOTRACE-UNRELEASED.md             |    7 +
 docs/dev-trace/commits/2026/04/1011293.md          |   43 +
 docs/dev-trace/commits/2026/04/1473bec.md          |   54 +
 docs/dev-trace/commits/2026/04/2cc04d9.md          |   35 +
 docs/dev-trace/commits/2026/04/351bc2f.md          |   35 +
 docs/dev-trace/commits/2026/04/3af1469.md          |   56 +
 docs/dev-trace/commits/2026/04/857cdba.md          |   63 +
 docs/dev-trace/commits/2026/04/be41d53.md          |   35 +
 docs/dev-trace/commits/index.json                  |  196 +++
 docs/dev-trace/worklog/2026/04/2026-04-25.md       |  123 ++
 docs/team/knowledge/events-log.jsonl               |   14 +
 docs/team/knowledge/impact-map.json                | 1689 ++++----------------
 docs/team/knowledge/references-catalog.json        |  275 +++-
 .../reports/KNOWLEDGE-MAGAZINE-2026-04-25.html     |  414 +++++
 .../reports/KNOWLEDGE-MAGAZINE-2026-04-26.html     |  404 +++++
 .../reports/KNOWLEDGE-MAGAZINE-latest.html         |  140 +-
 .../reports/KNOWLEDGE-REPORT-2026-04-25.md         |   75 +
 .../reports/KNOWLEDGE-REPORT-2026-04-26.md         |   63 +
 docs/team/knowledge/sources-registry.json          |   74 +-
 public/quotation-preview/hoja-visual-cliente.html  |    4 +-
 src/data/calculatorDataVersion.js                  |    2 +-
 24 files changed, 2295 insertions(+), 1536 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Amarillo
