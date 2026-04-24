# Commit 835bdba

- Fecha: 2026-04-24
- Hora: 05:50:20
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: docs
- Scope: sheets
- Commit: docs(sheets): CRM column mapping validation 2026-04-24

## Resumen
CRM column mapping validation 2026-04-24

## Descripción
Este cambio registra el commit `docs(sheets): CRM column mapping validation 2026-04-24` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: docs/team/sheets/COLUMN-GAPS-2026.md.

Contexto del commit:
Cross-checked crmOperativoLayout.js, bmcDashboard.js mappers, accessible-base sync script, and live snapshots. Documents 5 gaps: admin_cotizaciones col shift in docs, CRM columns L-Q/U/X-AE absent from snapshot, monto_estimado not in colMap, link_presupuesto returns display label not URL, and three tabs failing sync due to name mismatch.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): docs

## Archivos modificados
- docs/team/sheets/COLUMN-GAPS-2026.md

## Diff summary
```text
docs/team/sheets/COLUMN-GAPS-2026.md | 120 +++++++++++++++++++++++++++++++++++
 1 file changed, 120 insertions(+)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
