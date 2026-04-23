# Commit a22ce4e

- Fecha: 2026-04-23
- Hora: 06:37:52
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: wolfboard
- Commit: feat(wolfboard): add pendientes, sync, row, enviados, export routes

## Resumen
add pendientes, sync, row, enviados, export routes

## Descripción
Este cambio registra el commit `feat(wolfboard): add pendientes, sync, row, enviados, export routes` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: server/routes/wolfboard.js.

Contexto del commit:
Implements the 5 missing GET/POST endpoints that BmcAdminCotizacionesModule
calls. Previously the module rendered but all data loads returned 404.

Routes added:
  GET  /api/wolfboard/pendientes  — list Admin 2.0 rows with a consulta
  POST /api/wolfboard/sync        — propagate Admin.J → CRM_Operativo.AF
  POST /api/wolfboard/row         — save respuesta/link or approve a row
  POST /api/wolfboard/enviados    — move row to Enviados tab + delete from Admin
  GET  /api/wolfboard/export      — CSV download (Bearer or ?token= auth)

All write paths respect WOLFB_DRY_RUN=1. CRM propagation is best-effort.

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
server/routes/wolfboard.js | 362 +++++++++++++++++++++++++++++++++++++++++++--
 1 file changed, 350 insertions(+), 12 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
