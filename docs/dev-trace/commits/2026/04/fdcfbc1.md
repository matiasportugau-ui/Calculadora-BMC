# Commit fdcfbc1

- Fecha: 2026-04-23
- Hora: 06:40:58
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: fichas
- Commit: feat(fichas): add Kingspan comparison section (TIPO 5)

## Resumen
add Kingspan comparison section (TIPO 5)

## Descripción
Este cambio registra el commit `feat(fichas): add Kingspan comparison section (TIPO 5)` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: src/components/FichasPreview.jsx.

Contexto del commit:
Add FichaComparacion component to FichasPreview with a module selector
(11 modules) and a color-coded comparison table using compareKingspanVsBMC(),
statusColor(), and statusLabel() from kingspanComparison.js.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): src

## Archivos modificados
- src/components/FichasPreview.jsx

## Diff summary
```text
src/components/FichasPreview.jsx | 85 +++++++++++++++++++++++++++++++++++++++-
 1 file changed, 84 insertions(+), 1 deletion(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
