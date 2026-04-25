# Commit 9c5cf0a

- Fecha: 2026-04-25
- Hora: 03:45:46
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: pdf
- Commit: fix(pdf): runtime chromium discovery via which — resilient to Alpine path variance

## Resumen
runtime chromium discovery via which — resilient to Alpine path variance

## Descripción
Este cambio registra el commit `fix(pdf): runtime chromium discovery via which — resilient to Alpine path variance` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: server/routes/pdf.js.

Contexto del commit:
Replace hardcoded /usr/bin/chromium with runtime `which chromium` probe.
Alpine apk install path varies by version; `which` always finds it.
Fallback chain: CHROMIUM_PATH env → which chromium/chromium-browser → playwright bundled.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): server

## Archivos modificados
- server/routes/pdf.js

## Diff summary
```text
server/routes/pdf.js | 23 +++++++++++++----------
 1 file changed, 13 insertions(+), 10 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
