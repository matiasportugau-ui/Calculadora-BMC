# RECREATION-CHECKLIST — BMC Torre de Control

**SDD:** [`SDD.md`](./SDD.md) · **TARGET:** [`TARGET.md`](./TARGET.md)  
**Last verified:** 2026-08-27 Fase 1

- [x] Repo `calculadora-bmc`
- [x] `GET /api/torre/live` (`server/routes/torre.js`)
- [x] Pure board `src/utils/logistica/torreLiveView.js` + `tests/torreLiveView.test.js`
- [x] UI `TorreLiveBoard.jsx` on `/logistica?vista=torre` · alias `/torre`
- [x] `location_ping` + `presence` in `transportistaFsm.js`
- [x] GPS watch stops when `trip.status === closed`
- [ ] T5–T6 roster / assign to user (Fase 2)
- [ ] T7 Order ID (Fase 3)
- [ ] T8 AI Torre HITL (Fase 4)

Local: `doppler run -- npm run dev:full` → http://localhost:5173/logistica?vista=torre
