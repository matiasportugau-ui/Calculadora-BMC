# HANDOFF — Envío Setup Wizard implementation (goal)

**Date:** 2026-08-07  
**Branch:** `feat/envio-setup-wizard`  
**SDD:** `docs/sdd/bmc-envios/SDD-ENVIO-WIZARD.md` v0.2  

## Done (this goal)

### Pure modules + tests
- `src/utils/logistica/pickupCatalog.js` — seed Kingspan/Montfrío/Ecopaneles, merge, CRUD, localStorage
- `src/utils/logistica/wizardState.js` — step gates, Continuar, summaries
- `src/utils/logistica/routeSuggest.js` — base → pickups → deliveries
- Tests: `pickupCatalog`, `wizardState`, `routeSuggest` (all green)

### UI
- `src/components/logistica/wizard/EnvioWizardShell.jsx`
- Steps: Pedidos, Flota, Levantes, Ruta
- Wired in `BmcLogisticaApp` with Vista clásica toggle
- Draft localStorage: `ui.wizard` + `route`
- `enviosDraft.js` additive parse/build for wizard + route

## How to try
1. Open `/logistica` (hard refresh)
2. Wizard should show for empty/new ENV
3. Add pedidos via Ventas below → Continuar
4. Flota: transportista + camión + base (+ nueva base)
5. Levantes: seed pickups or +nuevo
6. Ruta: Generar ruta sugerida
7. Carga: Formulario/Remito/3D as before

## Residual
- Step Pedidos search is still the classic Ventas block (linked by copy); full multi-select-only UI optional
- OSRM road km not wired (haversine when geo exists)
- Cloud draft browser may need explicit wizard fields in cloud PUT path (payload already carries via local buildEnviosDraft if used)
- Disk was critically full during implement — free space before large builds

## Next
- PR + ship when ready
- Playwright O1–O12 smoke
- Sticky CTA polish P6
