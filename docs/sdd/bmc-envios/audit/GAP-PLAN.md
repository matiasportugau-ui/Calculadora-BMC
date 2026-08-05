# GAP-PLAN — BMC Envíos — 2026-08-05 (post glory doc evolution)

## Score actual: **96**/100 → Target: ≥90 — **PASS**

## Summary

Doc lag (F1–F6 as TARGET while code shipped) closed in SDD **v1.4**. Residual OPEN rows are **product** backlog only (U3/P2/P3/P5), not recreation blockers.

| ID | Gap | Severity | Status | Notes |
|----|-----|----------|--------|-------|
| G-DOC-01 | F1–F6 labeled TARGET in parent SDD | P0 | **[x]** | v1.4 CONFIRMED |
| G-DOC-02 | C4 bridge TARGET U2 | P0 | **[x]** | AS-BUILT |
| G-DOC-03 | Gherkin/evidence U2 target | P1 | **[x]** | Fixed |
| G-DOC-04 | evidence missing F1–F6 modules | P0 | **[x]** | E-25–E-36 |
| G-DOC-05 | RECREATION missing F1–F6 | P1 | **[x]** | §7b |
| G-DOC-06 | Ops ADRs missing parent | P1 | **[x]** | ADR-011–014 |
| G-DOC-07 | pickColumnRow undocumented | P1 | **[x]** | ADR-011 + E-25 |
| G-DOC-08 | OPS-UX-WAVE status Target | P1 | **[x]** | As-Built 1.1 |
| G-U3 | FSM STOP_STATUS guards | P2 product | **[x] 2026-08-05** | `stopStatusFsm.js` + UI select |
| G-DND | Drag-down insert index | P1 product | **[x] 2026-08-05** | `stopReorder.js` fix + tests |
| G-P2 | Geocode | P2 product | **OPEN** | Deferred |
| G-P3 | CBM non-panel | P2 product | **OPEN** | Deferred |
| G-P5 | Server ENV | P2 product | **OPEN** | Deferred |
| G-ENG | Unify column/stack | P3 | **OPEN** | Intentional dual |

## Remaining to 100

| Work | Est. lift | Owner |
|------|-----------|-------|
| U3 FSM + tests | +1–2 | **done** |
| DnD drag-down | — | **done** |
| P5 durable ENV | +1 | implementer |

## Non-goals

Courier multi-modal, TSP, live `POST /api/envios/*`.

## Re-score trigger

After U3 or P5 product ships, or major packing change.
