# Screenshots 2026-08-07 — MVP findings

User-provided WebGL captures after PR #937 (boxy MVP):

| # | View | Confirmed OK | Gaps |
|---|------|--------------|------|
| 1 | Deck overview + chip | Chip, flat bed, duals, HeightGuides, free-drag | Cab = blue block; dark scene |
| 2 | Cab rear ¾ | Fuel tank cylinder, dual wheels | Solid rear wall, no multi-mesh FH |
| 3 | Front lights ON | Headlight glow works | Cube cab, weak glass/Panelín |

**Root cause:** MVP used 1–2 boxes for cab; sandbox recipe is multi-mesh FH.

**P0 response:** port BmcCab/CargoBed/Wheel/CabDriver recipe with remap §E; packing-aligned deck (hybrid).
