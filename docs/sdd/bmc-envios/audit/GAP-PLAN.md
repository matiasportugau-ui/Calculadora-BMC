# GAP-PLAN — BMC Envíos — 2026-08-05 (post U1/U2 ship + re-audit)

## Score actual: **98**/100 → Target: 100 (pass ≥90) — **PASS**

## Summary

Documentation and product U1/U2 are closed. Residual to 100 is optional product depth (U3 FSM, P5 server ENV), not missing schema or recreation blockers.

| ID | Gap | Severity | Status | Notes |
|----|-----|----------|--------|-------|
| G-01 | RECREATION-CHECKLIST | P0 | **[x]** | Present |
| G-02 | evidence/INDEX | P0 | **[x]** | E-01–E-24 |
| G-03–G-06 | §8, OpenAPI, C4, ADRs | P1 | **[x]** | evolution-loop |
| G-07 | Dual placeCargo in app | P1 product | **[x] 2026-08-04** | U1 shipped |
| G-08–G-10 | Auth, status, links | P2 | **[x]** | |
| G-U2 | Bridge quote→ops | P1 product | **[x] 2026-08-04** | bridgePayload + CTA |
| **G-U3** | FSM guards on STOP_STATUS | P2 product | **[ ] OPEN** | Next slice |
| **G-P2** | Geocode / Distance Matrix | P2 product | **[ ] OPEN** | Less especial ciego |
| **G-P3** | CBM non-panel only | P2 product | **[ ] OPEN** | Not panel-zone |
| **G-P5** | Server ENV persistence | P2 product | **[ ] OPEN** | localStorage today |
| **G-ENG** | Unify column/stack geometry | P3 optional | **[ ] OPEN** | Intentional dual engines |

## Remaining to 100

| Work | Est. score lift | Owner |
|------|-----------------|-------|
| U3 FSM enforcement + tests | +1 | implementer |
| P5 durable shipments | +1 | implementer |
| Doc polish only | ~0 | — |

## Non-goals (still)

Courier multi-modal, TSP, isochrones, live `POST /api/envios/*`.

## Re-score trigger

After U3 or P5 ships.
