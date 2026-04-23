# Commit 38dffaf

- Fecha: 2026-04-23
- Hora: 07:50:33
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: roof-plan
- Commit: feat(roof-plan): segment-level encounter selection in 2D plan

## Resumen
segment-level encounter selection in 2D plan

## Descripción
Este cambio registra el commit `feat(roof-plan): segment-level encounter selection in 2D plan` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: src/components/RoofPreview.jsx.

Contexto del commit:
Clicking a segment line now highlights that segment in the encounter
prompt panel (blue border + tint). Active segment gets thicker stroke
on the SVG line. Boundary markers (white circles with gray border)
appear between segments when a pair has more than one segment.

All three changes are additive — no behaviour change for single-segment
pairs or when onEncounterPairChange is not provided.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): src

## Archivos modificados
- src/components/RoofPreview.jsx

## Diff summary
```text
src/components/RoofPreview.jsx | 29 +++++++++++++++++++++++++----
 1 file changed, 25 insertions(+), 4 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
