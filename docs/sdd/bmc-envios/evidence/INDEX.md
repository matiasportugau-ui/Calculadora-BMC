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
| E-45 | P5b autosave + 409 | **CONFIRMED** | `enviosDraftSync.js` + PUT expectedRevision + tests |
| E-46 | F10b package list DnD | **CONFIRMED** | `packageListDnD.js` + `PackageLayoutList.jsx` |
| E-47 | safeExternalUrl | **CONFIRMED** | `safeExternalUrl.js` + tests |
| E-48 | P2b Matrix | **DEFERRED** | 2026-Q4 |
| E-49 | P3 CBM tariff | **DEFERRED** | 2026-Q4 |
| E-22 | Legacy SDD superseded | **CONFIRMED** | team SDD fletes |
| E-50 | Envío Setup Wizard SDD | **TARGET** | `SDD-ENVIO-WIZARD.md` v0.2 · W1–W12 · plan v2 pre-mortem |
| E-51 | Autocarga A–C–B live | **CONFIRMED** | #899 · `evidence/autocarga-training-2026-08-07.md` |
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
| E-34 | 3D labels + cabin | **CONFIRMED** | `LogisticaCargoScene3d.jsx` Html + cabina. **Nota 2026-08-08:** `TruckCabin` fue reemplazado por `TruckVisual.jsx` en #937 |
| E-35 | loadCharacteristics volumes | **CONFIRMED** | `loadCharacteristics.js` |
| E-36 | Ops UX SDD | **CONFIRMED** | `SDD-OPS-UX-WAVE.md` |
| E-37 | STOP_STATUS FSM U3 | **CONFIRMED** | `src/utils/logistica/stopStatusFsm.js`; PR #857 |

## Revisión 2026-08-08

| ID | Claim | Tag | Evidence |
|----|-------|-----|----------|
| E-38 | Tres routers de logística montados bajo `/api` | **CONFIRMED** | `server/index.js:1063-1065` |
| E-39 | `TruckVisual` montado en el mismo Canvas que OrbitControls y free-drag | **CONFIRMED** | `LogisticaCargoScene3d.jsx:519`, `:548`, `:375` |
| E-40 | V1 — captador de clic invisible con `stopImmediatePropagation` | **CONFIRMED** | `TruckVisual.jsx:285-300`, `:154-160` |
| E-41 | V2 — `truckL` restaurado sin coerción numérica | **CONFIRMED** | `BmcLogisticaApp.jsx:1961`; uso en `LogisticaCargoScene3d.jsx:449` |
| E-42 | V7 — único test del visor es un grep estructural | **CONFIRMED** | `tests/truckAxles.test.js` |
| E-43 | V8 — `preserveDrawingBuffer` + shadows + dpr 1.75 | **CONFIRMED** | `LogisticaCargoScene3d.jsx:645-648` |
| E-44 | `axleCount()` no valida entrada | **CONFIRMED** | `src/utils/logistica/truckAxles.js` |
| E-45 | Sin ruteo real: cero OSRM / Distance Matrix / Mapbox / ORS | **CONFIRMED** | Búsqueda en `src/` y `server/` → 0 hits |
| E-46 | Geocode Nominatim con rate gate de 1100 ms | **CONFIRMED** | `server/routes/envios.js:170`, `:196-199`, `:206` |
| E-47 | `haversineKm` duplicado en dos módulos | **CONFIRMED** | `geocode.js:128`, `routeSuggest.js:15` |
| E-48 | `RouteMapVisualizer` sin cartografía, solo proyección SVG | **CONFIRMED** | `wizard/RouteMapVisualizer.jsx:25` vía `projectRouteToSvg` |
| E-49 | `reparto_documents` creada y nunca escrita | **CONFIRMED** | DDL `server/lib/enviosDb.js:79`; único SELECT `server/routes/repartos.js:203` |
| E-50 | `RemitoView` es a nivel viaje, no por cliente | **CONFIRMED** | `BmcLogisticaApp.jsx:1666`, título en `:1734` |
| E-51 | `packageBultoCounts` ya resuelve la numeración k/N | **CONFIRMED** | `src/utils/logistica/packageIdentity.js:25` |
| E-52 | `buildRemitoPackageRows` ya es por parada | **CONFIRMED** | `src/utils/logistica/remitoPackageMetrics.js:54` |
| E-53 | `renderHtmlToPdfBuffer` honra `@page` vía `preferCSSPageSize` | **CONFIRMED** | `server/lib/quotePdf.js:164`, `:216` |
| E-54 | `POST /api/pdf/generate` sin auth | **CONFIRMED** | `server/routes/pdf.js:32` |
| E-55 | Tres tests de repartos fuera de todo script npm | **CONFIRMED** | 0 menciones de `repartoNumber`, `repartoStatus`, `repartos-api.integration` en `package.json` |
| E-56 | `DRIVE_REPARTOS_FOLDER_ID` referenciada pero nunca leída ni definida | **CONFIRMED** | `server/routes/repartos.js:319`; ausente en `config.js` y `.env.example` |
| E-57 | Cero código de etiquetas / encomiendas / agencias | **CONFIRMED** | Búsqueda en `src/` → 0 hits |
| E-58 | Superficie completa de env de logística | **CONFIRMED** | `server/config.js:251-256` |

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

### Revisión 2026-08-08

```bash
# E-38 routers
grep -n "createTransportistaRouter\|createEnviosRouter\|createRepartosRouter" server/index.js

# E-45 ausencia de ruteo real
grep -rniE "osrm|distance ?matrix|mapbox|openrouteservice" src/ server/ | grep -v node_modules

# E-49 reparto_documents nunca se escribe
grep -rn "reparto_documents" server/ scripts/ tests/

# E-55 tests huérfanos
for t in repartoNumber repartoStatus repartos-api.integration; do
  echo "$t: $(grep -c "$t" package.json)"
done

# E-57 ausencia de etiquetas
grep -rn "encomienda\|agencia" src/ --include="*.jsx" --include="*.js"
```
