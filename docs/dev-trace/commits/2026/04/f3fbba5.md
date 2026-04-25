# Commit f3fbba5

- Fecha: 2026-04-25
- Hora: 04:41:31
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: docker
- Commit: fix(docker): deps stage must match runtime — node:20-slim for glibc compat

## Resumen
deps stage must match runtime — node:20-slim for glibc compat

## Descripción
Este cambio registra el commit `fix(docker): deps stage must match runtime — node:20-slim for glibc compat` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: Dockerfile.bmc-dashboard.

Contexto del commit:
BREAKING BUG: deps stage used node:20-alpine (musl) while runtime used
node:20-slim (glibc). Native modules (pg, etc.) compiled for musl cannot
run on glibc — caused immediate server crash on startup.

Fix: deps stage now uses node:20-slim to match runtime ABI.
calc-build stays on Alpine (only produces static Vite assets, no native deps).

Also: replace wget HEALTHCHECK with node built-in http — wget not present
in node:20-slim Debian image.

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
Dockerfile.bmc-dashboard | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
