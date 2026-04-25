# Commit e2ac5e0

- Fecha: 2026-04-25
- Hora: 03:20:32
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: fiscal
- Commit: feat(fiscal): BPS/IRAE tracking endpoint + dashboard card

## Resumen
BPS/IRAE tracking endpoint + dashboard card

## Descripción
Este cambio registra el commit `feat(fiscal): BPS/IRAE tracking endpoint + dashboard card` dentro del sistema de trazabilidad del proyecto. Se modificaron 10 archivos: .accessible-base/kb.json, docs/dev-trace/AUTOTRACE-CHANGELOG.md, docs/dev-trace/AUTOTRACE-STATUS.md, docs/dev-trace/AUTOTRACE-UNRELEASED.md, docs/dev-trace/commits/2026/04/43a9206.md y 5 más.

Contexto del commit:
Add GET /api/fiscal/bps-irae that derives IVA (22%), IRAE (25%) and BPS
estimates from the existing Ventas Sheets data for the current month.
Returns { mes, irae_estimado, bps_empleador, bps_dependiente, iva_ventas,
iva_compras, resultado_neto, estimated } with graceful degradation (200 +
estimated:true) when Ventas sheet is unavailable, 503 only when creds are
missing entirely.

Add BmcFiscalCard.jsx with traffic-light coloring (green/orange/red) and
wire it into /hub/admin via BmcAdminCotizacionesModule.jsx.

gate:local: 368 passed, 0 failed, 0 lint errors.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): .accessible-base, docs, server, src

## Archivos modificados
- .accessible-base/kb.json
- docs/dev-trace/AUTOTRACE-CHANGELOG.md
- docs/dev-trace/AUTOTRACE-STATUS.md
- docs/dev-trace/AUTOTRACE-UNRELEASED.md
- docs/dev-trace/commits/2026/04/43a9206.md
- docs/dev-trace/commits/index.json
- docs/dev-trace/worklog/2026/04/2026-04-25.md
- server/routes/bmcDashboard.js
- src/components/BmcAdminCotizacionesModule.jsx
- src/components/BmcFiscalCard.jsx

## Diff summary
```text
.accessible-base/kb.json                      |   4 +-
 docs/dev-trace/AUTOTRACE-CHANGELOG.md         |   1 +
 docs/dev-trace/AUTOTRACE-STATUS.md            |   8 +-
 docs/dev-trace/AUTOTRACE-UNRELEASED.md        |   1 +
 docs/dev-trace/commits/2026/04/43a9206.md     |  60 +++++++++
 docs/dev-trace/commits/index.json             |  37 ++++++
 docs/dev-trace/worklog/2026/04/2026-04-25.md  |  24 ++++
 server/routes/bmcDashboard.js                 |  94 +++++++++++++
 src/components/BmcAdminCotizacionesModule.jsx |   4 +
 src/components/BmcFiscalCard.jsx              | 184 ++++++++++++++++++++++++++
 10 files changed, 411 insertions(+), 6 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
