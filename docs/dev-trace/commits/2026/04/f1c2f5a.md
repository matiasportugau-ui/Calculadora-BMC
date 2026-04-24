# Commit f1c2f5a

- Fecha: 2026-04-24
- Hora: 06:40:28
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: test
- Scope: contracts
- Commit: test(contracts): handle null linkPresupuesto in cockpit row contract

## Resumen
handle null linkPresupuesto in cockpit row contract

## Descripción
Este cambio registra el commit `test(contracts): handle null linkPresupuesto in cockpit row contract` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: scripts/validate-api-contracts.js.

Contexto del commit:
Add contract check for GET /api/crm/cockpit/row/:rowNum that asserts
parsed.linkPresupuesto is null or a URL string starting with "http",
reflecting the parseCrmRowAtoAK fix (4b7da4b) where HYPERLINK formula
display labels now correctly resolve to null instead of a bare number.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): scripts

## Archivos modificados
- scripts/validate-api-contracts.js

## Diff summary
```text
scripts/validate-api-contracts.js | 46 +++++++++++++++++++++++++++++++++++++++
 1 file changed, 46 insertions(+)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
