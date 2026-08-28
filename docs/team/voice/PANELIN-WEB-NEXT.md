# Panelin Web — next

SoT for `/panelin-web`. Keep this short. Update after each useful hop.

**Última:** 2026-08-28 (Admin VW persist — shipping)  
**Branch:** `fix/storefront-admin-vw`  
**Local:** http://127.0.0.1:3001/storefront-voice/  
**Shop:** silence-cut already on Cloud Run (`#1156`). VW write lands after this PR’s `deploy-calc-api`.

## Estado

- Identify vacío: `buildWaLeadAdminNotas` no existía → 200 falso. Fixed: helper + 502 unless `adminRow≥2` + wolfboard loopback.
- Informe: `docs/team/reports/PANELIN-WEB-CONVERSATION-REPORT-2026-08-28.md`

## Próximo prompt

```
/panelin-web shop
```

Tras Cloud Run: identify de prueba → fila `VW` visible en Admin 2.0 y `/log` en col J. Hard-refresh la tienda.

## No hacer ahora

- Mezclar Driver QR / KB injection / logística en este PR.
