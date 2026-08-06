# Evidence Index — BMC Envíos

**Protocol:** CONFIRMED = path or command · INFERRED · UNKNOWN · TARGET  

**Audit date:** 2026-08-05 · **main tip context:** U1/U2 + Ops UX F1–F6 + #840 packing fix

| ID | Claim | Tag | Evidence |
|----|-------|-----|----------|
| E-01 | Quote UI | **CONFIRMED** | `src/components/FleteCotizarPanel.jsx` |
| E-02 | Quote engine | **CONFIRMED** | `src/utils/fleteEngine.js` |
| E-03 | Quote packing column | **CONFIRMED** | `fleteEngine` → `cargoPacking` column |
| E-04 | Ops shared packing | **CONFIRMED** | `BmcLogisticaApp` imports `placeCargo`; no local placeCargo |
| E-05 | Stack + column SoT | **CONFIRMED** | `cargoPacking.js` |
| E-06 | Tariffs | **CONFIRMED** | `constants.js` `TARIFAS_LOGISTICAS` |
| E-07 | FX | **CONFIRMED** | `brouFx.js` |
| E-08 | Integer USD | **CONFIRMED** | `uyuToUsdInteger` |
| E-09 | STOP_STATUS | **CONFIRMED** | `BmcLogisticaApp.jsx` |
| E-10–E-12 | Liquid Glass | **CONFIRMED** | `envios-app`, `bmc-envios-glass.css`, `enviosTheme.js` |
| E-13 | Route `/logistica` | **CONFIRMED** | `App.jsx` |
| E-14 | No RequireGrant logistica | **CONFIRMED** | Shell only |
| E-15 | flete tests | **CONFIRMED** | `tests/fleteEngine.test.js` |
| E-16 | Plan export JSON | **CONFIRMED** | `bmcLogisticaBedView.js` |
| E-17 | ENV- number | **CONFIRMED** | `envNo` |
| E-18 | Bridge U2 | **CONFIRMED** | `bridgePayload.js` + CTA + import + `tests/bridgePayload.test.js` |
| E-19 | HTTP `/api/envios` | **CONFIRMED** | `server/routes/envios.js` mounted in `server/index.js` |
| E-20 | Geocode P2 | **CONFIRMED** | `src/utils/logistica/geocode.js` + POST geocode + `tests/geocode.test.js` |
| E-21 | PG drafts P5 | **CONFIRMED** | `envios_drafts` + `server/lib/enviosDb.js` + PUT/GET drafts + `tests/enviosDraft.test.js` |
| E-38 | Distance Matrix / TSP | **TARGET** | P2b non-MVP |
| E-39 | Autosave cloud | **TARGET** | P5b |
| E-40 | onDark buttons F7 | **CONFIRMED** | `btnStyle.js` + DiagramPanel `variant=onDark` + `tests/btnStyle.test.js` |
| E-41 | Package identity F8 | **CONFIRMED** | `packageIdentity.js` + SVG/3D labels |
| E-42 | Client group F9 | **CONFIRMED** | highlightKeys + drawer contact/map/PDF/remito |
| E-43 | Stack above/below F10 | **CONFIRMED** | `moveRelativeToNeighbor` / `findStackNeighbors` |
| E-44 | Ventas proxy F11 | **CONFIRMED** | `GET /api/envios/ventas-csv` + client fallback |
| E-22 | Legacy SDD superseded | **CONFIRMED** | team SDD fletes |
| E-23 | DESIGN-UI | **CONFIRMED** | `DESIGN-UI.md` |
| E-24 | Packing tests | **CONFIRMED** | `tests/cargoPacking.test.js` |
| E-25 | pickColumnRow 1-fila | **CONFIRMED** | `cargoPacking.js` `pickColumnRow`; flete tests 9–16→280 |
| E-26 | mergeBridgeIntoStops | **CONFIRMED** | `bridgePayload.js`; hydrate gate in app |
| E-27 | Coordination chips | **CONFIRMED** | `coordinationStatus.js` + `tests/coordinationStatus.test.js` |
| E-28 | Ventas haystack search | **CONFIRMED** | `ventasSearch.js` + `tests/ventasSearchFilter.test.js` |
| E-29 | Stop collapse/reorder | **CONFIRMED** | `stopReorder.js` + `ui.collapsedStopIds` + HTML5 handle |
| E-30 | Remito Simple metrics | **CONFIRMED** | `remitoPackageMetrics.js` + remito UI class `remito-simple-page` |
| E-31 | Package fila override | **CONFIRMED** | `packageDrop.js` + DiagramPanel Fila A/B |
| E-32 | Load plan print model | **CONFIRMED** | `loadPlanPrintModel.js` + Plan carga view |
| E-33 | sPed/sCli on packages | **CONFIRMED** | `buildPkgs` / `buildAccessoryPkgs` |
| E-34 | 3D labels + cabin | **CONFIRMED** | `LogisticaCargoScene3d.jsx` Html + `TruckCabin` |
| E-35 | loadCharacteristics volumes | **CONFIRMED** | `loadCharacteristics.js` |
| E-36 | Ops UX SDD | **CONFIRMED** | `SDD-OPS-UX-WAVE.md` |
| E-37 | STOP_STATUS FSM U3 | **CONFIRMED** | `src/utils/logistica/stopStatusFsm.js`; PR #857 |

## Commands (re-verify)

```bash
cd ~/calculadora-bmc
rg -n "function placeCargo" src/components/BmcLogisticaApp.jsx   # expect 0
node tests/fleteEngine.test.js
node tests/cargoPacking.test.js
node tests/bridgePayload.test.js
node tests/coordinationStatus.test.js
node tests/ventasSearchFilter.test.js
node tests/stopReorder.test.js
node tests/remitoPackageMetrics.test.js
node tests/packageDrop.test.js
node tests/loadPlanPrintModel.test.js
```
