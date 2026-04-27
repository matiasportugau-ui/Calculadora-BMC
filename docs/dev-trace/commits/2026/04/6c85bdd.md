# Commit 6c85bdd

- Fecha: 2026-04-27
- Hora: 04:08:09
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: vercel
- Commit: fix(vercel): proxy /api/* and /calc/* to Cloud Run

## Resumen
proxy /api/* and /calc/* to Cloud Run

## Descripción
Este cambio registra el commit `fix(vercel): proxy /api/* and /calc/* to Cloud Run` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: vercel.json.

Contexto del commit:
The catch-all rewrite /(.*) → index.html was swallowing all API
requests from the Vercel-hosted SPA. Added /api/:path* and /calc/:path*
rewrites above the catch-all so browser calls from calculadora-bmc.vercel.app
are proxied server-side to the Cloud Run API instead of returning HTML.

Fixes: PlanUploadModal, PlanInlineDropZone, and all other /api/* calls
returning 405 in production Vercel.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): -

## Archivos modificados
- vercel.json

## Diff summary
```text
vercel.json | 8 ++++++++
 1 file changed, 8 insertions(+)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
