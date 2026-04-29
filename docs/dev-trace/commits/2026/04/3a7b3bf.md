# Commit 3a7b3bf

- Fecha: 2026-04-27
- Hora: 15:29:41
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: docker
- Commit: fix(docker): add system Chromium to Dockerfile.bmc-dashboard for PDF generation

## Resumen
add system Chromium to Dockerfile.bmc-dashboard for PDF generation

## Descripción
Este cambio registra el commit `fix(docker): add system Chromium to Dockerfile.bmc-dashboard for PDF generation` dentro del sistema de trazabilidad del proyecto. Se modificaron 2 archivos: Dockerfile.bmc-dashboard, tests/pdf-pipeline.test.mjs.

Contexto del commit:
Install chromium via apt-get in node:20-slim runtime stage + set
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium so puppeteer-core uses the
system binary instead of @sparticuz /tmp extraction which fails in Cloud Run.
Also update server/Dockerfile (Alpine variant) and test fixture accordingly.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **sí**
- Tests / validación tocados: **sí**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): tests

## Archivos modificados
- Dockerfile.bmc-dashboard
- tests/pdf-pipeline.test.mjs

## Diff summary
```text
Dockerfile.bmc-dashboard    | 10 +++++++---
 tests/pdf-pipeline.test.mjs |  7 ++++---
 2 files changed, 11 insertions(+), 6 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
