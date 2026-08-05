# GAP-PLAN — BMC Envíos — 2026-08-05 (post glory + U3)

## Score actual: **96**/100 → Target: ≥90 — **PASS**

## Summary

Doc lag closed in SDD **v1.4** (F1–F6 as-built). **U3 FSM** shipped on main via **#857** (`stopStatusFsm.js`). Residual OPEN: **P2/P3/P5** product only.

| ID | Gap | Severity | Status | Notes |
|----|-----|----------|--------|-------|
| G-DOC-01..08 | Parent SDD lag vs Ops UX | P0/P1 | **[x]** | SDD v1.4 + evidence E-25–E-36 |
| G-U3 | FSM STOP_STATUS guards | P2 product | **[x] DONE** | #857 `src/utils/logistica/stopStatusFsm.js` |
| G-P2 | Geocode | P2 product | **OPEN** | Deferred |
| G-P3 | CBM non-panel | P2 product | **OPEN** | Deferred |
| G-P5 | Server ENV | P2 product | **OPEN** | Deferred |
| G-ENG | Unify column/stack | P3 | **OPEN** | Intentional dual |

## Remaining to 100

| Work | Est. lift |
|------|-----------|
| P5 durable ENV | +1 |
| Optional U3 UI polish | ~0–1 |

## Non-goals

Courier multi-modal, TSP, live `POST /api/envios/*`.
