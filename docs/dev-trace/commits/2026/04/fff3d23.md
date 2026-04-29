# Commit fff3d23

- Fecha: 2026-04-27
- Hora: 14:32:45
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: autolearn
- Commit: fix(autolearn): dedup uses question-only token overlap, not permanentBonus

## Resumen
dedup uses question-only token overlap, not permanentBonus

## Descripción
Este cambio registra el commit `fix(autolearn): dedup uses question-only token overlap, not permanentBonus` dentro del sistema de trazabilidad del proyecto. Se modificaron 2 archivos: server/lib/autoLearnExtractor.js, server/lib/trainingKB.js.

Contexto del commit:
findRelevantExamples() adds permanentBonus:100 to all permanent entries,
causing every candidate to appear as a duplicate (score always > 4).

New hasSimilarQuestion() compares question tokens only against active
entries without any score bonuses — correct dedup for autolearn pipeline.

Verified: 3 turns → 3 pairs extracted, 2 auto-approved, 1 pending queue.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): server

## Archivos modificados
- server/lib/autoLearnExtractor.js
- server/lib/trainingKB.js

## Diff summary
```text
server/lib/autoLearnExtractor.js | 10 ++++------
 server/lib/trainingKB.js         | 14 ++++++++++++++
 2 files changed, 18 insertions(+), 6 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
