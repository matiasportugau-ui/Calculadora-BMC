# Evidence index — BMC Driver Loop

| Tag | Source |
|-----|--------|
| CONFIRMED | `server/routes/transportista.js` trips/driver API (main, 2026-04-02) |
| CONFIRMED | `POST /api/repartos/:id/confirm` join hook |
| CONFIRMED | Visual specs `evidence/screens/01`–`05` (2026-08-21) |
| CONFIRMED | Prod `GET /api/transportista/health` 200 (2026-08-21 probe) |
| CONFIRMED | Broken WA path `/calculadora/conductor` — fixed to `/conductor` |
| TARGET | Five Outdoor Night screens at `/conductor/*` |
