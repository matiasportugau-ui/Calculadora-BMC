# Commit 8ccf8d8

- Fecha: 2026-04-23
- Hora: 06:53:14
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: -
- Commit: feat: add new JSON files for Admin Cotizaciones, CRM Operativo, KB, and Matriz Precios

## Resumen
add new JSON files for Admin Cotizaciones, CRM Operativo, KB, and Matriz Precios

## Descripción
Este cambio registra el commit `feat: add new JSON files for Admin Cotizaciones, CRM Operativo, KB, and Matriz Precios` dentro del sistema de trazabilidad del proyecto. Se modificaron 5 archivos: .accessible-base/admin_cotizaciones.json, .accessible-base/crm_operativo.json, .accessible-base/kb.json, .accessible-base/matriz_precios.json, docs/dev-trace/commits/2026/04/f2a5942.md.

Contexto del commit:
- Introduced `admin_cotizaciones.json` for managing quotes with 290 entries.
- Added `crm_operativo.json` to serve as the main hub for leads and responses, containing 297 entries.
- Created `kb.json` to document project details and status, enhancing traceability.
- Implemented `matriz_precios.json` for canonical pricing data with 170 entries.

These additions support the operational and pricing structure of BMC Uruguay, facilitating better data management and integration across platforms.

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): .accessible-base, docs

## Archivos modificados
- .accessible-base/admin_cotizaciones.json
- .accessible-base/crm_operativo.json
- .accessible-base/kb.json
- .accessible-base/matriz_precios.json
- docs/dev-trace/commits/2026/04/f2a5942.md

## Diff summary
```text
.accessible-base/admin_cotizaciones.json  | 2042 ++++++++++
 .accessible-base/crm_operativo.json       | 5981 +++++++++++++++++++++++++++++
 .accessible-base/kb.json                  |  235 ++
 .accessible-base/matriz_precios.json      | 1712 +++++++++
 docs/dev-trace/commits/2026/04/f2a5942.md |   45 +
 5 files changed, 10015 insertions(+)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
