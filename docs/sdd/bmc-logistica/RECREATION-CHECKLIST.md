# Recreation checklist — BMC Logística

An agent rebuilds ops+driver from this kit + cited modules. Do not invent APIs.

## Driver D1–D5

- [ ] D1 `POST /api/repartos/:id/confirm` JSON includes `driver_url` matching `conductorPublicUrl` (`/conductor?t=`, not `/calculadora/conductor`).
- [ ] D2 `/conductor/*` lazy `DriverApp` — no `BmcModuleNav` / Google header.
- [ ] D3 Routes: `/conductor` login/home, `/carga`, `/listo`, `/perfil` + Outdoor Night CSS.
- [ ] D4 Events via `transportista` / `trip_events` FSM (`factory_*`, `stop_*`, `delivery_*`).
- [ ] D5 Customer `/seguimiento/:token` — no other stops; GPS policy as driver-loop TARGET.

## Ops (main CONFIRMED)

- [ ] `/logistica` → `BmcLogisticaApp`
- [ ] Wizard `wizardState.js` Pedidos→Flota→Levantes→Ruta→Carga
- [ ] `placeCargo` only from `cargoPacking.js`
- [ ] `POST /api/envios/geocode`, drafts PUT/GET
- [ ] `POST /api/envios/ai-verify-stop` + Aplicar HITL
- [ ] Yard dump `buildYardDump` + 3D `LogisticaCargoScene3d`

## Mesa ops (CONFIRMED on main, 2026-08-27)

- [ ] `RouteLeafletMap` + `POST /api/envios/route` (OSRM fail-open)
- [ ] `buildYardLanes` / `settleYardPlaced`
- [ ] `tetrisPlaceCargo` + UI **Cargar Tetris (ruta)**
- [ ] `openDriverAssign` + **Asignar a chofer** (HITL WhatsApp; no auto-send)
- [ ] El Transportador `truckerAgent.js` + Grok Voice `surface=logistica` (no `setTecho` tool)

## Tests to run

```bash
cd ~/calculadora-bmc
node tests/conductorUrl.test.js
node tests/wizardState.test.js
node tests/tetrisPack.test.js
node tests/driverAssign.test.js
node tests/logisticaVoiceBootstrap.test.js
node tests/sddLogisticaScorecard.test.js
```
