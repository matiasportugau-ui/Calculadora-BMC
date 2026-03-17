# BMC Dashboard — Debug Report

**Fecha:** 2026-03-16  
**Origen:** bmc-dashboard-debug-reviewer (post Audit Runner)  
**Input:** .cursor/bmc-audit/latest-report.md, handoff.json

---

## Resumen

| Área | Estado | Acción |
|------|--------|--------|
| API /health | OK | — |
| API /api/* | OK (kpi 503 cuando Sheets no disponible) | Esperado |
| Contract validation | 3/3 passed | — |
| .env, service-account | OK | — |
| Sensibles en repo | Ninguno | — |
| npm audit | 7 vulns (5 low, 2 mod) | No bloqueante; revisar en mantenimiento |

---

## Logs analizados

- **Playwright:** 503 en localhost:3011 (puerto distinto; posible test antiguo).
- **Codebuddy:** Warnings de memoria, ENOSPC en codebase_analysis.db (externo al dashboard).
- **BMC server:** Pino a stdout; sin anomalías críticas en logs del proyecto.

---

## Recomendaciones

1. **kpi-financiero 503:** Verificar BMC_SHEET_ID, compartir workbook con service account, existencia de tab Pagos_Pendientes.
2. **npm audit:** Ejecutar `npm audit` periódicamente; `npm audit fix` puede requerir breaking changes (vite 8).
3. **Dashboard URL:** Documentar que /finanzas está en 3001 (no 5173 para el tab Finanzas integrado).

---

*Handoff desde Audit Runner completado.*
