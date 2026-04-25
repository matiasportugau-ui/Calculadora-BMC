# Commit db36ae8

- Fecha: 2026-04-24
- Hora: 21:20:38
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: ml-ui
- Commit: feat(ml-ui): add arcade instruction card explaining SYNC / FIRE! / COLA

## Resumen
add arcade instruction card explaining SYNC / FIRE! / COLA

## Descripción
Este cambio registra el commit `feat(ml-ui): add arcade instruction card explaining SYNC / FIRE! / COLA` dentro del sistema de trazabilidad del proyecto. Se modificaron 9 archivos: .accessible-base/kb.json, docs/dev-trace/AUTOTRACE-CHANGELOG.md, docs/dev-trace/AUTOTRACE-STATUS.md, docs/dev-trace/AUTOTRACE-UNRELEASED.md, docs/dev-trace/commits/2026/04/9a38ef6.md y 4 más.

Contexto del commit:
3-column panel below the buttons with icon, name, and description for each:
- ⟳ SYNC: trae preguntas nuevas de ML al CRM
- 🔴 FIRE!: ciclo completo sync+aprobar+enviar en 1 click
- ↺ COLA: recarga la tabla desde CRM sin sincronizar ML

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): .accessible-base, docs, src

## Archivos modificados
- .accessible-base/kb.json
- docs/dev-trace/AUTOTRACE-CHANGELOG.md
- docs/dev-trace/AUTOTRACE-STATUS.md
- docs/dev-trace/AUTOTRACE-UNRELEASED.md
- docs/dev-trace/commits/2026/04/9a38ef6.md
- docs/dev-trace/commits/index.json
- docs/dev-trace/worklog/2026/04/2026-04-24.md
- src/components/BmcMlOperativoModule.jsx
- src/data/calculatorDataVersion.js

## Diff summary
```text
.accessible-base/kb.json                     |  4 +-
 docs/dev-trace/AUTOTRACE-CHANGELOG.md        |  1 +
 docs/dev-trace/AUTOTRACE-STATUS.md           |  8 +--
 docs/dev-trace/AUTOTRACE-UNRELEASED.md       |  1 +
 docs/dev-trace/commits/2026/04/9a38ef6.md    | 49 ++++++++++++++
 docs/dev-trace/commits/index.json            | 35 ++++++++++
 docs/dev-trace/worklog/2026/04/2026-04-24.md | 15 +++++
 src/components/BmcMlOperativoModule.jsx      | 98 ++++++++++++++++------------
 src/data/calculatorDataVersion.js            |  4 +-
 9 files changed, 167 insertions(+), 48 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
