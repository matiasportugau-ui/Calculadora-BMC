# Commit eb48ea1

- Fecha: 2026-04-27
- Hora: 16:58:17
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: kb
- Commit: fix(kb): log GCS init error instead of silently swallowing

## Resumen
log GCS init error instead of silently swallowing

## Descripción
Este cambio registra el commit `fix(kb): log GCS init error instead of silently swallowing` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: server/lib/trainingKB.js.

Contexto del commit:
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): server

## Archivos modificados
- server/lib/trainingKB.js

## Diff summary
```text
server/lib/trainingKB.js | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
