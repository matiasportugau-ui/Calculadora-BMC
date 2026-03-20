# Report Solution/Coding — 2026-03-19 (run 16)

**Run:** Full team run (Invoque full team)  
**Handoff para:** Solution team, Coding team

---

## Resumen

Run ejecutado tras mejoras de UI en la Calculadora (2026-03-19). Cambios reflejados en DASHBOARD-INTERFACE-MAP, dependencies.md, service-map.md. Contract 4/4 PASS (runtime). Pendiente deploy.

---

## Cambios Calculadora (2026-03-19)

| Elemento | Descripción |
|----------|-------------|
| **RoofBorderSelector** | Accesorios perimetrales seleccionables sobre vista previa del techo (zonas integradas) |
| **Columnas costo/margen/ganancia** | Costo, % Margen y Ganancia en tabla de resultados |
| **Cargar desde MATRIZ** | Botón en Config para costo + venta desde MATRIZ de COSTOS y VENTAS 2026 |
| **Enter key** | Enter para avanzar en wizard (Siguiente) |
| **Display título dimensiones** | Corrección padding |
| **Costo en items** | Costo añadido a items de cálculo (pared, selladores, perfiles) |

---

## Estado por área (run 16)

- **Mapping:** DASHBOARD-INTERFACE-MAP actualizado con mejoras Calculadora 5173; planilla-inventory vigente (MATRIZ incluida).
- **Dependencies / Service map:** Calculadora actualizada con BMC_MATRIZ_SHEET_ID, /api/actualizar-precios-calculadora; MATRIZ-PRECIOS-CALCULADORA.md referenciado.
- **Contract:** 4/4 PASS (GET /api/kpi-financiero, proximas-entregas, audit, kpi-report).
- **Pendientes sin cambio:** tabs/triggers manual (Matias), deploy (Cloud Run/Vercel/Netuy), npm audit fix, kpi-report runtime, E2E, Repo Sync.

---

## Próximos pasos (Solution/Coding)

1. **Deploy Calculadora:** Vercel/Cloud Run/Netuy — pendiente Matias.
2. **E2E validation:** Ejecutar checklist docs/team/E2E-VALIDATION-CHECKLIST.md post-deploy.
3. **Report Study improvements §20:** Fases 1–3 (contract webhook, doPost, RegEx parser) para v4.0.

---

*Generado por: Reporter (bmc-implementation-plan-reporter)*
