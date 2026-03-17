# API Contract Validator — Reference

## Endpoints to Validate

| Endpoint | Required fields |
|----------|-----------------|
| GET /api/kpi-financiero | ok, pendingPayments, calendar, byPeriod, byCurrency, currencies, metas |
| GET /api/proximas-entregas | ok, data |
| GET /api/coordinacion-logistica | ok, text, count |
| GET /api/audit | ok, headers, data |
| GET /api/pagos-pendientes | ok, data |
| GET /api/metas-ventas | ok, data |

## Error Semantics

- 503 = Sheets backend unavailable (expected when no creds)
- 200 + empty arrays = no data (valid)
- 200 + wrong shape = contract drift (fail)

## Related

- Mapa defines contract; Validator enforces it
- Vista consumes; Validator ensures Vista gets what it expects
