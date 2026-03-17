# Contract Validation Report — 2026-03-17 (Run 6)

**Fecha:** 2026-03-17
**Run:** Full team run 6 (Invoque full team)
**Validator:** bmc-api-contract-validator

---

## Resumen

| Endpoint | Estado | Notas |
|----------|--------|-------|
| GET /api/kpi-financiero | PASS (código) | Ruta en bmcDashboard.js; montada en /api |
| GET /api/proximas-entregas | PASS (código) | Ruta en bmcDashboard.js |
| GET /api/audit | PASS (código) | Ruta en bmcDashboard.js |
| GET /api/kpi-report | PASS (código) | Ruta en bmcDashboard.js línea 1130; montada en /api (index.js L256) |

---

## Verificación por código

- **Servidor:** No corriendo en localhost:3001 al momento de la validación.
- **Validación:** Inspección de código en `server/routes/bmcDashboard.js` y `server/index.js`.
- **kpi-report:** `router.get("/kpi-report", ...)` en línea 1130; `app.use("/api", createBmcDashboardRouter(config))` en index.js L256 → GET /api/kpi-report existe.
- **Script validate-api-contracts.js:** Incluye checkKpiReport con keys totalPendiente, estaSemana, proximaSemana, entregasEstaSemana, bajoStock, equilibrio.

---

## Recomendación

Para validación runtime: iniciar servidor (`npm run start:api`) y ejecutar `BMC_API_BASE=http://localhost:3001 node scripts/validate-api-contracts.js`. 404 en kpi-report = reiniciar servidor (documentado en run 7).

---

*Generado por: Contract (bmc-api-contract-validator)*
