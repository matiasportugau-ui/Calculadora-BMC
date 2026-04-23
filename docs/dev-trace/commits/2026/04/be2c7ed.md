# Commit be2c7ed

- Fecha: 2026-04-23
- Hora: 04:40:56
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: wolfboard
- Commit: feat(wolfboard): origen from CRM column F — enrich pendientes with canal via CRM join

## Resumen
origen from CRM column F — enrich pendientes with canal via CRM join

## Descripción
Este cambio registra el commit `feat(wolfboard): origen from CRM column F — enrich pendientes with canal via CRM join` dentro del sistema de trazabilidad del proyecto. Se modificaron 2 archivos: .env.example, docs/bmc-dashboard-modernization/sheets-api-server.js.

Contexto del commit:
- readCrmRows() now returns F (row[5]) as canal origen (WA/EM/CL/LO/LL)
- handleWolfboardPendientes() joins Admin + CRM to attach origen per row
- Removed orphaned WOLFB_ADMIN_ORIGEN_COL const and colLetterToIndex helper
  (linter had already rewritten readAdminRows to use correct I/J/K/L layout)
- .env.example: drop WOLFB_ADMIN_ORIGEN_COL (L is enviado, not Origen)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): docs

## Archivos modificados
- .env.example
- docs/bmc-dashboard-modernization/sheets-api-server.js

## Diff summary
```text
.env.example                                       |  2 --
 .../sheets-api-server.js                           | 32 ++++++++++++----------
 2 files changed, 17 insertions(+), 17 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
