# Commit 9acb23a

- Fecha: 2026-04-24
- Hora: 06:24:28
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: kb
- Commit: feat(kb): add kb-006/007/008 — instalación, plazos, cobertura geográfica

## Resumen
add kb-006/007/008 — instalación, plazos, cobertura geográfica

## Descripción
Este cambio registra el commit `feat(kb): add kb-006/007/008 — instalación, plazos, cobertura geográfica` dentro del sistema de trazabilidad del proyecto. Se modificaron 2 archivos: .accessible-base/kb.json, data/training-kb.example.json.

Contexto del commit:
Adds 3 permanent KB entries covering previously uncovered question categories:
- kb-006: technical installation process, tools, professional requirement, time per m²
- kb-007: delivery timelines, stock vs made-to-order, interior logistics
- kb-008: geographic coverage, shipments to Uruguay interior, regional installers

Entries added to both data/training-kb.example.json (seed) and data/training-kb.json (runtime).
KB rebuilt; 368 tests pass.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): .accessible-base, data

## Archivos modificados
- .accessible-base/kb.json
- data/training-kb.example.json

## Diff summary
```text
.accessible-base/kb.json      |  4 ++--
 data/training-kb.example.json | 36 ++++++++++++++++++++++++++++++++++++
 2 files changed, 38 insertions(+), 2 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
