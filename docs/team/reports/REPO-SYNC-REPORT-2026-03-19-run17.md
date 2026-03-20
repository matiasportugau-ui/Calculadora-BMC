# Repo Sync Report — 2026-03-19 (run 17)

**Run:** Full team run (Invoque full team)
**Objetivo:** Sincronizar bmc-dashboard-2.0 y bmc-development-team con artefactos cambiados.

---

## Artefactos a sincronizar

### bmc-dashboard-2.0 (desarrollo y funcionamiento del dashboard)

| Artefacto | Cambio |
|-----------|--------|
| `src/components/PanelinCalculadoraV3_backup.jsx` | Mejoras UI 2026-03-19 (RoofBorderSelector, costo/margen/ganancia, Cargar desde MATRIZ, Enter key) |
| `src/data/matrizPreciosMapping.js` | Mapeo SKU→path MATRIZ |
| `src/data/pricing.js` | Pricing overrides |
| `src/utils/pricingOverrides.js` | Lógica overrides |
| `server/routes/bmcDashboard.js` | Rutas API vigentes |
| `server/routes/calc.js` | Rutas calc |
| `docs/bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md` | Calculadora 5173 mejoras |
| `docs/bmc-dashboard-modernization/dependencies.md` | Calculadora MATRIZ flow |
| `docs/bmc-dashboard-modernization/service-map.md` | actualizar-precios-calculadora |
| `docs/google-sheets-module/planilla-inventory.md` | BMC_MATRIZ_SHEET_ID |
| `docs/google-sheets-module/MATRIZ-PRECIOS-CALCULADORA.md` | Flujo MATRIZ→Calculadora |

### bmc-development-team (equipo y artefactos)

| Artefacto | Cambio |
|-----------|--------|
| `docs/team/PROJECT-STATE.md` | Cambios recientes run17; pendientes |
| `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` | Vigente |
| `docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md` | Próximos prompts run17 |
| `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md` | Vigente |
| `docs/team/judge/JUDGE-REPORT-RUN-2026-03-19-run17.md` | Nuevo |
| `docs/team/judge/JUDGE-REPORT-HISTORICO.md` | Actualizado run17 |
| `docs/team/parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-19-run17.md` | Nuevo |
| `docs/team/reports/REPORT-SOLUTION-CODING-2026-03-19-run17.md` | Nuevo |
| `docs/team/reports/REPO-SYNC-REPORT-2026-03-19-run17.md` | Este reporte |

---

## Comandos para sincronizar

```bash
# Configurar repos en .env (si no están):
# BMC_DASHBOARD_2_REPO=/path/to/bmc-dashboard-2.0
# BMC_DEVELOPMENT_TEAM_REPO=/path/to/bmc-development-team

# bmc-dashboard-2.0
cd $BMC_DASHBOARD_2_REPO
git pull origin main
# Copiar artefactos desde Calculadora-BMC
git add -A
git commit -m "run17: Calculadora UI mejoras 2026-03-19; deploy prep"
git push origin main

# bmc-development-team
cd $BMC_DEVELOPMENT_TEAM_REPO
git pull origin main
# Copiar artefactos desde Calculadora-BMC
git add -A
git commit -m "run17: Full team run 2026-03-19; deploy calc; Judge, Reporter, Repo Sync"
git push origin main
```

---

## Estado

- **Repos configurados:** Ver `.env` (BMC_DASHBOARD_2_REPO, BMC_DEVELOPMENT_TEAM_REPO)
- **Sincronización:** Artefactos listados; commit y push requieren ejecución manual por Matias si no hay paths locales configurados.

---

*Generado por: Repo Sync (bmc-repo-sync-agent)*
