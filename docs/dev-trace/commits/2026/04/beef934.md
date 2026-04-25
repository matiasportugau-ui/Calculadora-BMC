# Commit beef934

- Fecha: 2026-04-25
- Hora: 04:48:40
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: docker
- Commit: fix(docker): remove playwright install from runtime container

## Resumen
remove playwright install from runtime container

## Descripción
Este cambio registra el commit `fix(docker): remove playwright install from runtime container` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: Dockerfile.bmc-dashboard.

Contexto del commit:
Playwright + chromium install during Docker build was causing container
startup failure on Cloud Run. The /api/pdf/generate route already has
graceful error handling — returns 503 when Playwright unavailable, and
the client falls back to html2pdf.js (client-side raster PDF).

Server-side vectorial PDF via Playwright will require a dedicated service
or Cloud Run job rather than bundling into the main API container.

Runtime stays on node:20-slim (Debian, better ABI compatibility).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): -

## Archivos modificados
- Dockerfile.bmc-dashboard

## Diff summary
```text
Dockerfile.bmc-dashboard | 6 ------
 1 file changed, 6 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
