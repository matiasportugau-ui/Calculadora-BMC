# Commit 3cdcbde

- Fecha: 2026-04-24
- Hora: 05:23:29
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: kb
- Commit: feat(kb): add 5 missing KB entries for mantenimiento, comparativas, garantia, ROI, ampliacion

## Resumen
add 5 missing KB entries for mantenimiento, comparativas, garantia, ROI, ampliacion

## Descripción
Este cambio registra el commit `feat(kb): add 5 missing KB entries for mantenimiento, comparativas, garantia, ROI, ampliacion` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: data/training-kb.example.json.

Contexto del commit:
Audit of chat KB found training-kb.json was completely empty (0 entries),
meaning findRelevantExamples() always returned nothing and the CORRECCIONES
DE ENTRENAMIENTO block never appeared in the system prompt.

Added 5 permanent training entries covering the top uncovered categories:
- kb-001: mantenimiento post-instalación (product) — cleaning, sealers, rust on cuts
- kb-002: comparacion vs chapa/teja/losa/policarbonato (product) — honest comparison
- kb-003: ahorro energético / ROI / payback (sales) — R values, kWh estimates
- kb-004: cobertura exacta de garantia (sales) — what is/isn't covered, how to activate
- kb-005: ampliacion de instalacion existente (conversational) — compatibility checklist

Also updated data/training-kb.example.json (tracked seed) with the same entries
so new deployments can bootstrap the local KB via npm run panelin:train:import.

The data/knowledge/mantenimiento-y-comparativas.md doc was committed in the
prior session (fe9b447); this commit only adds the training KB seed entries.

Gates: lint 0 errors | 368 tests pass | roofVisualQuoteConsistency 10 ok

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): data

## Archivos modificados
- data/training-kb.example.json

## Diff summary
```text
data/training-kb.example.json | 62 ++++++++++++++++++++++++++++++++++++++++++-
 1 file changed, 61 insertions(+), 1 deletion(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
