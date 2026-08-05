# TARGET — BMC Envíos (módulo unificado)

**Slug:** `bmc-envios`  
**Date:** 2026-08-05  
**Status:** As-built Core (U1/U2) + Ops UX F1–F6 DONE; residual U3/P2/P3/P5  
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
| U3 | **FSM map** | `STOP_STATUS` ↔ Draft/Scheduled/Dispatched/InTransit/Delivered documentado + guards mínimos |
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

## Non-goals (Core)

- SaaS courier multi-modal global  
- Distance Matrix / isochrones / TSP (roadmap P2–P4)  
- Microservicio o DB nueva obligatoria  
- Sustituir tarifa panel-zona por CBM puro sin ADR  

## Success metrics

- 0 dual packing engines in repo  
- Quote p95 &lt; 2s (local + FX cache)  
- Round-trip quote→ENV without re-keying panel dims  
- Agent can implement U1–U2 from `SDD.md` alone  

## Readers

Human operators (domain appendix), platform engineers, **AI coding agents** (primary consumer of contracts).
