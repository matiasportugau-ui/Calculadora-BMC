---
title: SDD — Logística TruckVisual (procedural BMC cab/bed)
version: 1.1
date: 2026-08-07
status: Implemented (fidelity P0)
parent: docs/sdd/bmc-envios/SDD-3D-VISOR.md
---

# TruckVisual — System Design (as-built + target)

## 1. Context & goals

**Problem:** Ops need to read truck length, axle class, and cargo free volume in the WebGL estiba view without breaking packing.

**Goals**

1. Procedural BMC flatbed truck visual (no primary GLB).
2. Sacred packing contract untouched (`shiftX`, `truckL`, free-drag, HeightGuides).
3. Cab click → lights 10s + Panelín boost.
4. Axles: ≤6 m → 2; >6 m → 3 duals under bed.

**Non-goals:** window-wink animation, heavy GLB cabin, packing width changes.

## 2. C4 container

```
BmcLogisticaApp
  └─ ViewerChrome (chip toolbar)
       └─ LogisticaCargoScene3d
            ├─ TruckVisual { shiftX, truckL }     ← this system
            │    ├─ BmcCab (multi-mesh FH)
            │    ├─ CargoBed (planks + bulkhead + sills)
            │    ├─ Wheel × N
            │    └─ CabDriver (texture / fallback)
            ├─ TruckFloor (packing plane + saliente)
            ├─ HeightGuides
            └─ CargoBox[] (free-drag)
```

## 3. Coordinate contract (sacred)

| Axis | Calculadora |
|------|-------------|
| Cargo X | `[shiftX, shiftX + truckL]` |
| Cargo Z | `[0, TRUCK_W]` center `TRUCK_W/2` |
| Cab rear | `shiftX - 0.02` |
| Cab center | `shiftX - 0.02 - CABIN_LEN/2` (`CABIN_LEN=2.55`) |
| Props | `{ shiftX, truckL }` only |
| Width | `TRUCK_W = 2.4` (packing) |

Full remap: `evidence/grok-build-truckmodel-reply.md` §E.

## 4. Features

| Feature | Status |
|---------|--------|
| Multi-mesh BmcCab (body, sleeper, glass, grille×5, lights) | DONE (P0) |
| CargoBed planks + chassis + bulkhead, no barandas | DONE (P0) |
| Dual wheels + axle math | DONE |
| Cab click 10s lights + stopPropagation | DONE |
| Panelín texture `/bmo-mascot.png` → panelin fallback | DONE |
| Packing-aligned deck (hybrid, not sandbox 1.15 m) | DONE (ADR-001) |
| Scene ambient/hemisphere/cargo soft spot | DONE (P0) |
| UI chip luces 10s | DONE |
| Window wink / GLB cabin | OUT |

## 5. ADRs

### ADR-001 — Packing-aligned deck height

**Decision:** Use hybrid `DECK_TOP ≈ 0.055` so CargoBox (y≈0 packing) sits on visual deck.  
**Rejected:** Literal sandbox `deckTop=1.15` (boxes would float under bed).  
**Consequence:** Cab multi-mesh uses readable ops scale above low deck; not 1:1 sandbox absolute Y.

### ADR-002 — Procedural only, no primary GLB

**Decision:** Box/cylinder meshes only.  
**Why:** Perf, no asset pipeline, matches sandbox active path.

### ADR-003 — Visual never owns cargo

**Decision:** CargoBox remains external; TruckVisual has zero packing handlers.

## 6. Tests

- `tests/truckAxles.test.js` — `axleCount` + scene structural wire.
- Manual: 6m/8m axles, free-drag, cab lights, Panelín when lit.

## 7. Evolution

| Priority | Item |
|----------|------|
| P1 | Optional `bmo-mascot.png` ship in public/; BMC door decals |
| P1 | ContactShadows / soft ground match sandbox |
| P2 | Window-down + wink; optional GLB off-by-default |

## 8. References

- Recipe: `evidence/grok-build-truckmodel-reply.md`
- Goal: `docs/team/goal-prompts/GOAL-port-truckmodel-calculadora-bmc.md`
- Visor parent: `docs/sdd/bmc-envios/SDD-3D-VISOR.md`
