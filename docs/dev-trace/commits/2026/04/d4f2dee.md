# Commit d4f2dee

- Fecha: 2026-04-23
- Hora: 07:00:18
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: feature/wolfboard-crm
- Tipo: fix
- Scope: -
- Commit: fix: re-apply hook guard + Kingspan comparison after force-push

## Resumen
re-apply hook guard + Kingspan comparison after force-push

## Descripción
Este cambio registra el commit `fix: re-apply hook guard + Kingspan comparison after force-push` dentro del sistema de trazabilidad del proyecto. Se modificaron 2 archivos: .githooks/post-commit, src/components/FichasPreview.jsx.

Contexto del commit:
Reapplied two changes lost when another session force-pushed main:
- .githooks/post-commit: guard to skip autotrace on dev-trace commits
- FichasPreview.jsx: TIPO 5 Kingspan comparison section (FichaComparacion
  with 11-module selector + color-coded comparison table)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): .githooks, src

## Archivos modificados
- .githooks/post-commit
- src/components/FichasPreview.jsx

## Diff summary
```text
.githooks/post-commit            |  6 +++
 src/components/FichasPreview.jsx | 84 +++++++++++++++++++++++++++++++++++++++-
 2 files changed, 89 insertions(+), 1 deletion(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
