# Commit db0c9ce

- Fecha: 2026-04-23
- Hora: 07:12:28
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: -
- Commit: feat: wire real calculator engine into quote-batch

## Resumen
wire real calculator engine into quote-batch

## Descripción
Este cambio registra el commit `feat: wire real calculator engine into quote-batch` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: server/routes/wolfboard.js.

Contexto del commit:
quote-batch now runs a two-step AI process per consultation:
1. Claude Haiku extracts structured params (escenario, dims, familia, espesor) as JSON
2. If dims present, runs calcTechoCompleto/calcParedCompleto with real BOM engine and
   formats response with actual USD totals + IVA from constants.js
3. Falls back to text-only generation when dimensions are missing

Also fixes GET /pendientes to expose `origen` + `sheetUrl` fields the admin UI expects.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): server

## Archivos modificados
- server/routes/wolfboard.js

## Diff summary
```text
server/routes/wolfboard.js | 104 ++++++++++++++++++++++++++-------------------
 1 file changed, 61 insertions(+), 43 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
