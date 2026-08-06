# GAP-PLAN — BMC Envíos — 2026-08-05 (post Wave 2 F7–F11)

## Score actual: **96**/100 → Target: ≥90 — **PASS**

## Summary

U1–U3 + Ops UX F1–F6 + P2/P5 MVP + **Wave 2 F7–F11** (buttons, identity, client highlight, stack above/below, Ventas proxy). Residual product: P3, P2b, P5b, F10b DnD list.

| ID | Gap | Severity | Status | Notes |
|----|-----|----------|--------|-------|
| G-DOC-01..08 | Parent SDD lag vs Ops UX | P0/P1 | **[x]** | SDD v1.4+ |
| G-U3 | FSM STOP_STATUS | P2 | **[x]** | #857 |
| G-P2 / G-P5 | Geocode + drafts MVP | P2 | **[x]** | v1.5 |
| G-F7 | Ghost buttons on dark panel | P0 | **[x]** | `btnStyle` onDark |
| G-F8 | Package identity k/N | P0 | **[x]** | `packageIdentity.js` |
| G-F9 | Client group + drawer docs | P0 | **[x]** | DiagramPanel drawer |
| G-F10 | Stack above/below | P1 | **[x]** | packageDrop moveRelative |
| G-F10b | List DnD reorder packages | P2 | **OPEN** | Deferred |
| G-F11 | Ventas fetch harden | P0 | **[x]** | proxy + errors + persist view |
| G-P2b | Distance Matrix / TSP | P3 | **OPEN** | — |
| G-P3 | CBM non-panel | P2 | **OPEN** | — |
| G-P5b | Autosave cloud | P3 | **OPEN** | — |

## Non-goals

Courier multi-modal, free 3D physics drag, Theme Studio (other module).
