# Commit bd2ab02

- Fecha: 2026-04-25
- Hora: 03:41:27
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: pdf
- Commit: fix(pdf): chromium path — Alpine uses /usr/bin/chromium not chromium-browser

## Resumen
chromium path — Alpine uses /usr/bin/chromium not chromium-browser

## Descripción
Este cambio registra el commit `fix(pdf): chromium path — Alpine uses /usr/bin/chromium not chromium-browser` dentro del sistema de trazabilidad del proyecto. Se modificaron 2 archivos: Dockerfile.bmc-dashboard, server/routes/pdf.js.

Contexto del commit:
Alpine's apk installs to /usr/bin/chromium. Updated Dockerfile ENV and
pdf.js now probes [/usr/bin/chromium, /usr/bin/chromium-browser] via
existsSync as fallback chain — resilient to Alpine version differences.
Added ls /usr/bin/chrom* in Dockerfile RUN for build-time visibility.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): server

## Archivos modificados
- Dockerfile.bmc-dashboard
- server/routes/pdf.js

## Diff summary
```text
Dockerfile.bmc-dashboard |  7 ++++---
 server/routes/pdf.js     | 13 +++++++------
 2 files changed, 11 insertions(+), 9 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
