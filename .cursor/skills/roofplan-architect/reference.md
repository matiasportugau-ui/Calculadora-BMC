# RoofPlan Architect — 100-Point ISO Scoring Matrix

## How to use

Score each item as **pass (full points)** or **fail (0)**. Sum all items.
Items marked (H) = high impact, (M) = medium, (L) = low.

---

## 1. Dimensioning — ISO 129 (25 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| H1 | Extension line gap | 3 | Gap ≥ `extGap` (default 0.04 m) between zone edge and extension line start |
| H2 | Extension line overshoot | 3 | Extension line extends `extOvershoot` (default 0.06 m) beyond dimension line |
| H3 | Overall envelope dimension | 4 | Multi-zone: one horizontal + one vertical dim spanning all zones, color `envelopeColor` (#0D47A1), stacked beyond per-zone dims |
| M6 | Stacking clearance | 3 | Per-side chain dims don't overlap; each chain offset by `CHAIN_STEP` (0.14 m) |
| H1b | 45° tick terminators | 3 | All dim lines use 45° ticks (not arrows), length ~dimFont×0.7 |
| M6b | Single-zone envelope | 3 | 1-zone: envelope dim still renders (same as zone dim, different color) |
| H3b | Arch dims present | 3 | Per-segment architectural dims render with `dimFontSecondary` |
| L6 | Dim line weight | 3 | All dimension lines use `LINE_WEIGHTS.dimMain` (0.032 m) |

## 2. Visual Hierarchy — ISO 128 (20 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| M1 | 5-tier line weights | 5 | Inspect SVG: 5 distinct `strokeWidth` values matching `LINE_WEIGHTS` |
| M2 | Poché diagonal hatch | 5 | All zone rects have `fill="url(#poche-hatch)"` overlay with 45° lines at ≤0.06 opacity |
| H4 | AABB collision avoidance | 5 | No dim text label overlaps an encounter label (test with multi-zone + encounters) |
| M5 | Encounter line weight | 5 | Encounter edges use `LINE_WEIGHTS.encounter` (0.055), not `zoneBorder` |

## 3. Typography — ISO 3098 (15 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| M3 | Font family | 3 | Share Tech Mono loaded (Google Fonts `<link>` in `index.html`), used as primary font |
| L3 | 3 font tiers | 4 | Exactly 3 distinct font sizes in SVG: `dimFontPrimary`, `dimFontSecondary` (×0.82), `dimFontTertiary` (×0.72) |
| M4 | Font weight 500 | 3 | Dimension text uses `fontWeight: 500` |
| L3b | Tier usage correct | 3 | Primary→envelope/overall, Secondary→chain/arch, Tertiary→encounter/scalebar/datum |
| L3c | Mobile legibility | 2 | At 375px viewport, smallest text ≥ 6px equivalent |

## 4. Symbols & Annotation (10 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| H5 | Scale bar | 2.5 | Alternating black/white blocks, auto-selects 0.5m/1m/5m, positioned bottom-left |
| L1 | Orientation mark | 1.5 | "PLANTA" label + north arrow at top-left, always visible |
| L4 | Datum mark | 1.5 | Inverted triangle + ±0.000 label at bottom-left of envelope |
| L4b | 3D dim annotations | 2 | drei `Html` overlays show `{w} × {l} m` per zone in 3D scene |
| L4c | 3D encounter lines | 2.5 | drei `Line` segments color-coded: green/orange/blue/red by encounter mode |

## 5. Organization — Layers (10 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| O1 | `data-bmc-layer` tags | 4 | All annotation groups have `data-bmc-layer` attribute (scale-bar, orientation-mark, datum-mark, dims, encounter-labels) |
| O2 | Envelope layer | 3 | Envelope dimension group has `data-bmc-layer="envelope-dims"` |
| O3 | Capture attributes | 3 | SVG has `data-bmc-capture="roof-plan-2d"`, 3D wrapper has `data-bmc-capture="roof-3d"` |

## 6. Quality / Traceability (10 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| Q1 | 2D plan in PDF | 3 | `buildSnapshotSectionHtml` includes "Plano 2D de cubierta" row with captured SVG PNG |
| Q2 | 3D snapshot in PDF | 3 | `buildSnapshotSectionHtml` includes "Vista 3D de cubierta" row with canvas PNG |
| Q3 | Collision-free labels | 2 | No overlapping text in PDF snapshots (visual check) |
| Q4 | `preserveDrawingBuffer` | 2 | 3D Canvas has `preserveDrawingBuffer: true` for reliable capture |

## 7. Color / Presentation (10 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| C1 | Print theme exists | 3 | `PRINT_THEME` in `roofPlanDrawingTheme.js` with grayscale values |
| C2 | `getTheme(mode)` selector | 2 | `getTheme('print')` returns `PRINT_THEME`, `getTheme('screen')` returns screen defaults |
| C3 | 3D encounter colors | 3 | `ENCOUNTER_COLORS` constant with 4 modo→color mappings, applied to `<Line>` in 3D scene |
| C4 | DIM_THEME consistency | 2 | `chainColor`, `overallColor`, `envelopeColor` are distinct and used correctly |

---

## Score ranges

| Range | Assessment |
|-------|------------|
| 95–100 | ISO-compliant, production ready |
| 85–94 | Minor gaps, acceptable for beta |
| 70–84 | Significant gaps, needs improvement |
| <70 | Major rework needed |

---

## SVG Code Patterns

### Extension line with gap + overshoot

```jsx
<line
  x1={x} y1={dimY - extOvershoot}
  x2={x} y2={edgeY + extGap}
  strokeWidth={LINE_WEIGHTS.dimMain}
  stroke={color}
/>
```

### 45° tick terminator

```jsx
const half = dimFont * 0.35;
<line
  x1={x - half} y1={dimY + half}
  x2={x + half} y2={dimY - half}
  strokeWidth={LINE_WEIGHTS.dimMain * 1.2}
  stroke={color}
/>
```

### Poché hatch pattern

```jsx
<defs>
  <pattern id="poche-hatch" width={spacing} height={spacing}
    patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2={spacing}
      stroke={color} strokeWidth={LINE_WEIGHTS.hatch} />
  </pattern>
</defs>
```

### 3D encounter line

```jsx
<Line
  points={[[x1, y1, z1], [x2, y2, z2]]}
  color={ENCOUNTER_COLORS[modo]}
  lineWidth={3}
/>
```
