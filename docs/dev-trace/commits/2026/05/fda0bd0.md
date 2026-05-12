# Commit fda0bd0

- Fecha: 2026-05-02
- Hora: 03:56:09
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: feat/ml-search-and-price-monitor-schema
- Tipo: fix
- Scope: ml
- Commit: fix(ml): update id validation in /api/ml/etl-run/:id

## Resumen
update id validation in /api/ml/etl-run/:id

## Descripción
Este cambio registra el commit `fix(ml): update id validation in /api/ml/etl-run/:id` dentro del sistema de trazabilidad del proyecto. Se modificaron 7 archivos: .accessible-base/kb.json, docs/dev-trace/AUTOTRACE-CHANGELOG.md, docs/dev-trace/AUTOTRACE-STATUS.md, docs/dev-trace/AUTOTRACE-UNRELEASED.md, docs/dev-trace/commits/2026/05/253ed7b.md y 2 más.

Contexto del commit:
Enhanced validation for IDs in the ETL run endpoint to ensure only positive integers are accepted, rejecting floats, negatives, and NaN values. Additionally, implemented encodeURIComponent on the interpolated ID to improve security and clarity of intent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): .accessible-base, docs

## Archivos modificados
- .accessible-base/kb.json
- docs/dev-trace/AUTOTRACE-CHANGELOG.md
- docs/dev-trace/AUTOTRACE-STATUS.md
- docs/dev-trace/AUTOTRACE-UNRELEASED.md
- docs/dev-trace/commits/2026/05/253ed7b.md
- docs/dev-trace/commits/index.json
- docs/dev-trace/worklog/2026/05/2026-05-02.md

## Diff summary
```text
.accessible-base/kb.json                     |  4 +--
 docs/dev-trace/AUTOTRACE-CHANGELOG.md        |  2 +-
 docs/dev-trace/AUTOTRACE-STATUS.md           |  8 ++---
 docs/dev-trace/AUTOTRACE-UNRELEASED.md       |  2 +-
 docs/dev-trace/commits/2026/05/253ed7b.md    | 44 ++++++++++++++++++++++++++++
 docs/dev-trace/commits/index.json            | 27 +++++++++++++++++
 docs/dev-trace/worklog/2026/05/2026-05-02.md | 17 +++++++++++
 7 files changed, 96 insertions(+), 8 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
