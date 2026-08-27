# GAP-PLAN — BMC Logística SDD v1.1 Final

**Composite:** 94 / 100 — **PASS** (≥90)  
**Date:** 2026-08-27

## Closed vs v1.0 (were worktree-only)

| ID | Gap | Resolution |
|----|-----|------------|
| G-MESA-OSRM | Leaflet + `POST /api/envios/route` | Ported to `main` (`RouteLeafletMap.jsx`, `osrmPolyline.js`, `envios.js`) |
| G-MESA-TETRIS | `tetrisPack.js` + Cargar Tetris | Ported; `DiagramPanel` `onLoadTetris` |
| G-MESA-ASSIGN | `driverAssign.js` one-tap WA | Ported; confirm `driver_url` already on main |
| G-MESA-AGENT | El Transportador + Grok Voice | Ported; `surface=logistica`; HITL only |
| G-MESA-YARD | WMS lanes + settle | Ported `settleYardPlaced` |
| G-MERGE | Ship mesa to `main` | This release |

## Residuals

| ID | Gap | Severity | Status |
|----|-----|----------|--------|
| G-D5-GPS | Customer GPS window fully productized | P2 | TARGET driver-loop |
| G-NATIVE | iOS/Android store | — | **Non-goal** D6 |
| G-OSRM-TRUCK | OSRM truck profile vs driving | P3 | public driving + fail-open haversine |
| G-VOICE-PROD | Grok Voice needs `XAI_API_KEY` on Cloud Run | P1 ops | secret already used by Live; verify logistica surface in prod |

## Non-goals

Merge remaining dirty mesa worktree wholesale · OSRM truck profile · auto-WA customers · native stores.
