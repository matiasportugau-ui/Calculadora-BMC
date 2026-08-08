# TARGET — BMC Envíos (módulo unificado)

**Slug:** `bmc-envios`  
**Date:** 2026-08-05  
**Status:** As-built Core (U1/U2/U3) + Ops UX F1–F6 + P2/P5 MVP DONE; residual P3 + Matrix/TSP + autosave  
**Repo:** `calculadora-bmc`  
**Surfaces (must stay one product):**

| Surface | Route / location | Role |
|---------|------------------|------|
| **Quote** | Wizard paso **Flete 10/11** · `FleteCotizarPanel` | Cotizar flete → precarga FLETE USD + costo |
| **Ops** | [`/logistica`](https://calculadora-bmc.vercel.app/logistica) · `BmcLogisticaApp` | ENV-…, paradas, empaque, estatus, diagrama |

## Product outcome

Operadores BMC cotizan y ejecutan el **mismo envío de paneles** en Uruguay sin motor de empaque doble, sin tarifas divergentes y sin copiar datos a mano entre calculadora y logística.

## Core DoD (unification)

| ID | Criterion | Measure |
|----|-----------|---------|
| U1 | **Single packing SoT** | **DONE** `cargoPacking.js` (stack ops + column freight); 0 local `placeCargo` in app |
| U2 | **Quote → Ops bridge** | **DONE** `bridgePayload.js` + CTA + sessionStorage import on `/logistica` |
| U3 | **FSM map** | **DONE** #857 `stopStatusFsm.js` — guards on STOP_STATUS transitions |
| U4 | **Quote UX** | Destino vacío explica gap; sync proyecto↔paso; filas 0 / sin paneles explícito |
| U5 | **Shared design tokens** | **DONE** Liquid Glass DESIGN-UI.md + `bmc-envios-glass.css` + `enviosTheme.js` |
| U6 | **Contracts** | Gherkin + OpenAPI sketch (NOT DEPLOYED) + evidence INDEX; tests `fleteEngine` |
| U7 | **Doc SoT** | **DONE** kit path + RECREATION-CHECKLIST + audit loop |

## Ops UX Wave (F1–F6) — see [`SDD-OPS-UX-WAVE.md`](./SDD-OPS-UX-WAVE.md)

| ID | Criterion | Status |
|----|-----------|--------|
| F1 | Collapsible stop/section cards | **DONE** (PR-2) |
| F2 | Ventas search haystack + Enviado/Coordinado/Por coordinar chips | **DONE** (#842) |
| F3a | Stop list DnD reorder | **DONE** (PR-2) |
| F3b | Remito Presupuesto Simple + package volumes | **DONE** (PR-3) |
| F4 | 3D labels cliente + pedido + rich detail | **DONE** (PR F4–F6) |
| F5 | Package DnD → manual layout overrides | **DONE** (fila A/B via select + override) |
| F6 | Load-plan print multi-view + translucent cabin | **DONE** (plan sheet + 3D cabin) |

## P2 / P5 MVP DoD

| ID | Criterion | Status |
|----|-----------|--------|
| P2 | Geocode stop → `stop.geo` + map pin | **DONE** `geocode.js` + `POST /api/envios/geocode` |
| P2 | Parse lat,lng / Maps URL without API | **DONE** |
| P2 | Trip air-km legs (haversine) | **DONE** `tripLegDistances` |
| P2b | Road route + optimize (OSRM; was “Matrix/TSP”) | **SPEC** → [`SDD-GEO-MAPS.md`](./SDD-GEO-MAPS.md) (Leaflet + MapPicker + RouteOptimizer) |
| P2c | Quote paso 10 MapPicker / MiniMap / DeliveryPoint | **SPEC** → [`SDD-GEO-MAPS.md`](./SDD-GEO-MAPS.md) |
| P5 | Durable draft by ENV number in PG | **DONE** `envios_drafts` + PUT/GET |
| P5 | UI Save/Load nube | **DONE** `/logistica` header |
| P5 | localStorage offline cache | **DONE** (primary offline) |
| P5b | Autosave + conflict UI + draft browser | **DONE** expectedRevision 409 + debounce |
| F10b | Package list DnD reorder | **DONE** `PackageLayoutList` + `packageListDnD.js` |
| P3 | CBM non-panel tariff | **DEFERRED** 2026-Q4 (panel-zona remains SoT) |

## Envío Setup Wizard (W1–W12) — see [`SDD-ENVIO-WIZARD.md`](./SDD-ENVIO-WIZARD.md)

| ID | Criterion | Status |
|----|-----------|--------|
| W1 | Accordion Pedidos → Flota → Levantes → Ruta → Carga | **TARGET** |
| W2 | Collapse-on-complete + summary strip | **TARGET** |
| W3 | Per-order / default pickup (levante) | **TARGET** |
| W4 | Catalogs pickups + bases + vehicles | **TARGET** |
| W5 | Seed Kingspan / Montfrío / Ecopaneles + nuevo | **TARGET** |
| W6 | Route suggest base → pickups → deliveries | **TARGET** |
| W7 | Trip resume / list previous configs | **TARGET** |
| W8 | Trackpad/mobile pointer DnD | **TARGET** (list pattern #906) |
| W9 | Autocarga intact in Step Pedidos | **TARGET** |
| W10 | Compatible REP + drafts + free-drag | **TARGET** |
| W11 | Pure tests wizardState/catalog/routeSuggest | **TARGET** |
| W12 | Faster multi-stop setup vs classic | **TARGET** |

## Documentación de entrega (D — revisión 2026-08-08)

| ID | Outcome | Status |
|----|---------|--------|
| D1 | Inventario as-built completo de logística, sección por sección | **DONE** — `SDD-LOGISTICA-REVISION-2026-08-08.md` |
| D2 | Diagnóstico citable del visor `TruckVisual` | **DONE** — V1–V8 en `SDD-3D-VISOR.md` v0.3 |
| D3 | Estado real de geo/rutas, separando as-built de diseño | **DONE** — §7.4 + verificación fechada en `SDD-GEO-MAPS.md` |
| D4 | Deuda del modelo de datos registrada | **DONE** — §8.3 + `audit/GAP-PLAN.md` |
| D5 | Índice de la familia SDD | **DONE** — `README.md` |

## Etiquetas de bulto y encomienda (E — TARGET)

Diseño en [`SDD-ETIQUETAS-BULTOS.md`](./SDD-ETIQUETAS-BULTOS.md).

| ID | Outcome | Status |
|----|---------|--------|
| E1 | Etiquetas de bulto imprimibles en A4, con líneas de corte | **TARGET** |
| E2 | Numeración k/N por cliente reutilizando `packageBultoCounts()` | **TARGET** |
| E3 | Etiqueta de encomienda con remitente y destinatario completos | **TARGET** |
| E4 | Etiquetar N bultos sin pasar por la estiba | **TARGET** |
| E5 | Cero hardware nuevo (impresora A4 de oficina) | **TARGET** |
| E6 | Cero dependencias npm nuevas (Code128 en SVG puro) | **TARGET** |

## Remito POD por cliente (R — TARGET)

Diseño en [`SDD-REMITO-CLIENTE.md`](./SDD-REMITO-CLIENTE.md).

| ID | Outcome | Status |
|----|---------|--------|
| R1 | Un documento por parada, no por viaje | **TARGET** |
| R2 | Bloque de firma, aclaración, C.I. y fecha/hora | **TARGET** |
| R3 | Dos copias en la misma hoja (Original cliente / Duplicado BMC) | **TARGET** |
| R4 | Detalle de bultos vía `buildRemitoPackageRows()` | **TARGET** |
| R5 | Observaciones de recepción desde `stop.recepcionDetalle` | **TARGET** |
| R6 | Emisión registrada en `reparto_documents` | **TARGET** |
| R7 | Declara explícitamente que no tiene valor fiscal | **TARGET** |

## Non-goals (Core)

- Emisión de e-Remito fiscal (CFE / DGI) — exige emisor habilitado y firma electrónica avanzada  
- Integración por API con agencias de encomienda — ninguna publica API abierta  
- Impresora térmica de rollo day-1 (la arquitectura la admite; la primera entrega es A4)  
- Códigos QR (fase 2 — suman dependencia)  
- SaaS courier multi-modal global  
- Isochrones / multi-vehicle VRP / live GPS tracking  
- Google Distance Matrix billing (superseded by OSRM in SDD-GEO-MAPS unless ADR-017 reversed)  
- Replacing transportista driver trips with ENV drafts  
- Sustituir tarifa panel-zona por CBM puro sin ADR  

## Success metrics

- 0 dual packing engines in repo  
- Quote p95 &lt; 2s (local + FX cache)  
- Round-trip quote→ENV without re-keying panel dims  
- Agent can implement U1–U2 from `SDD.md` alone  

## Readers

Human operators (domain appendix), platform engineers, **AI coding agents** (primary consumer of contracts).
