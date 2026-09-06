# HANDOFF — Logística → Driver → Torre (Figma + feed)

**Date:** 2026-09-06  
**Branch:** `feat/logistica-driver-figma-loop` (from `origin/main`)  
**Do not mix:** `feat/storefront-voice-modes-demo` (stashed separately)

## Loop (locked)

`/logistica` plans the route → `POST /api/repartos/:id/confirm` / `joinRepartoToTrip` mints `driver_url` `/conductor?t=` → BMC Driver **consumes** `GET /api/driver/trips` + `plan_snapshot` → `POST /api/driver/events` → Torre `GET /api/torre/live`. Driver does not invent stops.

## Spec

- `docs/sdd/bmc-driver-loop/TARGET.md` D3 = SVG kit 390×844; **D7** = feed-binding. JPG pack is archival, not layout SoT.
- `DESIGN-UI.md` tab map: **Inicio / Carga / Listo / Perfil** (Listo has the same bar).
- Visual kit: `docs/sdd/bmc-driver-loop/evidence/svg-kit-2026-09-06/`

## Figma (official MCP, Pro · Full)

File: https://www.figma.com/design/iGZDe5LeC2ZDOdjbB3uH9q  
`fileKey` `iGZDe5LeC2ZDOdjbB3uH9q`

| Node | Name |
|------|------|
| `21:6` | BMC Driver / Conductor · Outdoor Night (board) |
| `21:12` | 01 Login (390×844) |
| `21:15` | 02 Home + Inicio tab |
| `21:18` | 03 Carga + Carga tab |
| `21:21` | 04 Listo + **Listo tab selected** |
| `21:24` | 05 Perfil + Perfil tab |

Home kit copy Montevideo→Pando is labeled **demo kit**; shipped PWA binds `projectDriverTripFeed`.

## Code

- `src/utils/logistica/driverTripFeed.js` — origin/dest/qty/remito from snapshot
- `src/utils/logistica/cargaFactoryStep.js` — 1:1 factory events, `N de 4`, CTA = current step
- `src/components/driver/*` — night profile, split Ver remitos / Nueva ruta, muted Carga 3D/Mapa
- Tests: `tests/cargaFactoryStep.test.js` + extended `tests/logisticaE2e.test.js` (join → list feed fields → factory_arrived still on Torre live)

## Remaining TARGET (out of this run)

Torre T5–T8 (roster, Order ID public lookup, Torre agent). No auto-WA. No packing rewrite.

## Next prompt

`Continue feat/logistica-driver-figma-loop: PR after gate:local green; do not merge storefront-voice.`
