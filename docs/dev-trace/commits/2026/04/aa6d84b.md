# Commit aa6d84b

- Fecha: 2026-04-23
- Hora: 08:47:35
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: wolfboard
- Commit: feat(wolfboard): add local dev scripts + rebuild kb.json

## Resumen
add local dev scripts + rebuild kb.json

## Descripción
Este cambio registra el commit `feat(wolfboard): add local dev scripts + rebuild kb.json` dentro del sistema de trazabilidad del proyecto. Se modificaron 13 archivos: .accessible-base/kb.json, docs/dev-trace/AUTOTRACE-CHANGELOG.md, docs/dev-trace/AUTOTRACE-STATUS.md, docs/dev-trace/AUTOTRACE-UNRELEASED.md, docs/dev-trace/commits/2026/04/3c93ff7.md y 8 más.

Contexto del commit:
- scripts/wolfboard-cotizar-batch.mjs — direct pricing batch (constants.js, no AI)
- scripts/wolfboard-run.sh — start API + open admin UI
- package.json — wolfboard:run, wolfboard:cotizar, wolfboard:cotizar:force, wolfboard:batch-ia
- .accessible-base/kb.json — synced: 357 tests, 1 vuln, wolfboard live

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): .accessible-base, docs, scripts

## Archivos modificados
- .accessible-base/kb.json
- docs/dev-trace/AUTOTRACE-CHANGELOG.md
- docs/dev-trace/AUTOTRACE-STATUS.md
- docs/dev-trace/AUTOTRACE-UNRELEASED.md
- docs/dev-trace/commits/2026/04/3c93ff7.md
- docs/dev-trace/commits/2026/04/97123b1.md
- docs/dev-trace/commits/2026/04/d221654.md
- docs/dev-trace/commits/2026/04/db9b798.md
- docs/dev-trace/commits/index.json
- docs/dev-trace/worklog/2026/04/2026-04-23.md
- package.json
- scripts/wolfboard-cotizar-batch.mjs
- scripts/wolfboard-run.sh

## Diff summary
```text
.accessible-base/kb.json                     |   8 +-
 docs/dev-trace/AUTOTRACE-CHANGELOG.md        |   4 +
 docs/dev-trace/AUTOTRACE-STATUS.md           |  10 +-
 docs/dev-trace/AUTOTRACE-UNRELEASED.md       |   4 +
 docs/dev-trace/commits/2026/04/3c93ff7.md    |  60 +++++++++
 docs/dev-trace/commits/2026/04/97123b1.md    |  44 +++++++
 docs/dev-trace/commits/2026/04/d221654.md    |  43 ++++++
 docs/dev-trace/commits/2026/04/db9b798.md    |  37 ++++++
 docs/dev-trace/commits/index.json            | 115 ++++++++++++++++
 docs/dev-trace/worklog/2026/04/2026-04-23.md |  70 ++++++++++
 package.json                                 |   4 +
 scripts/wolfboard-cotizar-batch.mjs          | 187 +++++++++++++++++++++++++++
 scripts/wolfboard-run.sh                     |  85 ++++++++++++
 13 files changed, 662 insertions(+), 9 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Amarillo
