# Evidence Index — BMC Envíos

**Protocol:** CONFIRMED = path:line or command output · INFERRED = reasonable from code · UNKNOWN = not found · TARGET = design not in code  

**Audit date:** 2026-08-04 · **Updated:** 2026-08-04 (U1 packing SoT + U2 bridge shipped)

| ID | Claim | Tag | Evidence |
|----|-------|-----|----------|
| E-01 | Quote UI exists | **CONFIRMED** | `src/components/FleteCotizarPanel.jsx` |
| E-02 | Quote engine | **CONFIRMED** | `src/utils/fleteEngine.js` (`quoteFreight`, `quoteFreightFromWizard`) |
| E-03 | Quote uses shared packing | **CONFIRMED** | `fleteEngine.js` imports `./logistica/cargoPacking.js`; `placeCargo` with **column** layoutEngine for tariffs |
| E-04 | Ops uses **shared** packing SoT | **CONFIRMED** | `BmcLogisticaApp.jsx` imports `placeCargo` from `src/utils/logistica/cargoPacking.js`; **no** local `function placeCargo` |
| E-05 | Single packing module (stack + column engines) | **CONFIRMED** | `cargoPacking.js` exports `placeCargo` (~L451); stack strategies + column freight path in same file |
| E-06 | Tariffs table | **CONFIRMED** | `src/data/constants.js:475` `TARIFAS_LOGISTICAS` |
| E-07 | FX fetch dolarapi | **CONFIRMED** | `src/utils/brouFx.js:56` URL `uy.dolarapi.com` |
| E-08 | Integer USD convert | **CONFIRMED** | `brouFx.js` `uyuToUsdInteger` |
| E-09 | STOP_STATUS enum | **CONFIRMED** | `BmcLogisticaApp.jsx` STOP_STATUS array |
| E-10 | Ops shell Liquid Glass | **CONFIRMED** | `BmcLogisticaApp.jsx` `className="envios-app"` |
| E-11 | Glass CSS wired | **CONFIRMED** | `src/main.jsx` imports `bmc-glass.css`, `bmc-envios-glass.css` |
| E-12 | Design tokens helper | **CONFIRMED** | `src/utils/enviosTheme.js` |
| E-13 | Route `/logistica` | **CONFIRMED** | `src/App.jsx` path `/logistica` |
| E-14 | No RequireGrant on logistica | **CONFIRMED** | Shell only, no `module=` grant |
| E-15 | Quote tests | **CONFIRMED** | `tests/fleteEngine.test.js` |
| E-16 | Plan export schema v1 | **CONFIRMED** | `src/utils/bmcLogisticaBedView.js` |
| E-17 | ENV- number helper | **CONFIRMED** | `BmcLogisticaApp` `envNo` |
| E-18 | Bridge quote→ops | **CONFIRMED** | `src/utils/logistica/bridgePayload.js`; CTA `FleteCotizarPanel.jsx` “Enviar a Logística”; import on mount in `BmcLogisticaApp.jsx`; tests `tests/bridgePayload.test.js` |
| E-19 | HTTP `POST /api/envios/quote` | **UNKNOWN / NOT DEPLOYED** | Sketch only in SDD Appendix D |
| E-20 | Maps Distance Matrix | **TARGET** P2 | Not Core |
| E-21 | Postgres shipments table | **TARGET** P5 | Not Core |
| E-22 | Legacy fletes SDD superseded | **CONFIRMED** | `docs/team/SDD-CALCULADORA-FLETES.md` |
| E-23 | DESIGN-UI Liquid Glass | **CONFIRMED** | `docs/sdd/bmc-envios/DESIGN-UI.md` |
| E-24 | Packing unit tests | **CONFIRMED** | `tests/cargoPacking.test.js` |

## Commands (re-verify)

```bash
cd ~/calculadora-bmc
rg -n "function placeCargo" src/components/BmcLogisticaApp.jsx   # expect 0
rg -n "export function placeCargo" src/utils/logistica
node tests/fleteEngine.test.js && node tests/cargoPacking.test.js && node tests/bridgePayload.test.js
```
