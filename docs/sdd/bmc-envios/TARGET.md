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
| P2b | Google Distance Matrix / TSP | **DEFERRED** 2026-Q4 (haversine + label “km aire”) |
| P5 | Durable draft by ENV number in PG | **DONE** `envios_drafts` + PUT/GET |
| P5 | UI Save/Load nube | **DONE** `/logistica` header |
| P5 | localStorage offline cache | **DONE** (primary offline) |
| P5b | Autosave + conflict UI + draft browser | **DONE** expectedRevision 409 + debounce |
| F10b | Package list DnD reorder | **DONE** `PackageLayoutList` + `packageListDnD.js` |
| P3 | CBM non-panel tariff | **DEFERRED** 2026-Q4 (panel-zona remains SoT) |

## Non-goals (Core)

- SaaS courier multi-modal global  
- Distance Matrix / isochrones / TSP (roadmap P2b)  
- Replacing transportista driver trips with ENV drafts  
- Sustituir tarifa panel-zona por CBM puro sin ADR  

## Success metrics

- 0 dual packing engines in repo  
- Quote p95 &lt; 2s (local + FX cache)  
- Round-trip quote→ENV without re-keying panel dims  
- Agent can implement U1–U2 from `SDD.md` alone  

## Readers

Human operators (domain appendix), platform engineers, **AI coding agents** (primary consumer of contracts).
