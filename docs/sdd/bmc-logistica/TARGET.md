# TARGET — BMC Logística (ops + Driver PWA)

**Slug:** `bmc-logistica`  
**Date:** 2026-08-27  
**Status:** As-Built Final v1.1 (mesa ops ported to `main`)  
**Repo:** `calculadora-bmc`  
**Children (do not replace):** [`../bmc-envios/`](../bmc-envios/) · [`../bmc-driver-loop/`](../bmc-driver-loop/)

## Product outcome

Un **solo producto**: el operador arma el envío en `/logistica` (pedidos, flota, levantes, ruta, carga 3D) → **Confirmar / Asignar a chofer** emite `driver_url` `/conductor?t=` → el chofer corre **BMC Driver** (PWA) → el cliente ve **solo su** `/seguimiento/:token`.

## Surfaces

| Surface | Route | Code | Evidence |
|---------|-------|------|----------|
| Ops Envíos | `/logistica` | `BmcLogisticaApp.jsx` | CONFIRMED main |
| Quote flete | Wizard paso 10/11 | `FleteCotizarPanel.jsx` | CONFIRMED sibling envíos |
| Driver PWA | `/conductor/*` | `DriverApp.jsx` | CONFIRMED main (#1078) |
| Legacy chofer path | `/calculadora/conductor` | `ConductorLegacyRedirect.jsx` | CONFIRMED redirect to `/conductor` |
| Customer | `/seguimiento/:token` | `CustomerTrackPage.jsx` | CONFIRMED (parked GPS policy D5) |
| Join API | `POST /api/repartos/:id/confirm` | `server/routes/repartos.js` | CONFIRMED `driver_url` |

## DoD — Driver (from bmc-driver-loop D1–D5)

| ID | Criterion | Main |
|----|-----------|------|
| D1 | Confirm REP creates trip + `driver_url` SPA `/conductor?t=` | CONFIRMED `conductorUrl.js` + confirm handler |
| D2 | `/conductor/*` has no operator Shell / Google header | CONFIRMED `DriverApp.jsx` |
| D3 | Five Outdoor Night screens (login, home, carga, listo, perfil) | CONFIRMED routes + DESIGN-UI sibling |
| D4 | Driver events FSM factory/stop/delivery + GPS | CONFIRMED `transportista` routes / trip_events |
| D5 | Customer tokens hashed; GPS only in transit ≤30 min | CONFIRMED TARGET driver-loop; customer page exists |
| D6 | No native store; ENV drafts stay | CONFIRMED non-goal |

## DoD — Ops complete functionality

| ID | Criterion | Where |
|----|-----------|--------|
| O1 | Wizard Pedidos→Flota→Levantes→Ruta→Carga | CONFIRMED main `wizardState.js` |
| O2 | Verificar con IA (HITL apply) | CONFIRMED main `aiVerifyStop.js` + `POST /api/envios/ai-verify-stop` |
| O3 | Geocode Nominatim + haversine legs | CONFIRMED main |
| O4 | Share Maps/WA/GPX | CONFIRMED main `routeExport.js` |
| O5 | Yard dump piles around truck | CONFIRMED main `yardLayout.js` (simple stacks) |
| O6 | Leaflet + OSRM polyline (map follows road) | CONFIRMED `RouteLeafletMap.jsx` + `POST /api/envios/route` + dep `leaflet` |
| O7 | Yard lanes WMS + settle-on-floor | CONFIRMED `yardLayout.js` `buildYardLanes` / `settleYardPlaced` |
| O8 | Tetris load following route + ledge fill | CONFIRMED `tetrisPack.js` + **Cargar Tetris (ruta)** on `DiagramPanel` |
| O9 | El Transportador HITL agent + Grok Voice | CONFIRMED `truckerAgent.js` + `LogisticaTruckerAgent` + `surface=logistica` + `SDD-EL-TRANSPORTADOR-VOICE.md` |
| O10 | One-tap Asignar a chofer → WA + Driver | CONFIRMED `driverAssign.js` + wizard / RepartoBar / DriverLoopPanel |

## Non-goals

Native iOS/Android · OSRM truck profile · auto-WA to customers · merging mesa dirty tree to `main` in this SDD cycle · replacing packing tariffs.
