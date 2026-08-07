# BMC Truck Visual Recipe (as-built) → Calculadora-BMC remap

**Source workspace:** Grok Build 3D Viewer (this repo)  
**Target:** Calculadora-BMC `TruckVisual` (boxy MVP already shipped)  
**Extracted:** 2026-08-07 from real code (not guessed)  
**GLB primary:** NO — procedural only (`useGLTF` only sets Draco path; no cabin GLB mounted)

---

## A. File inventory

| Role | Path | Exists |
|------|------|--------|
| Truck mesh + cab/bed/wheels/driver | `src/components/viewer/TruckModel.tsx` | YES |
| Scene lighting + Canvas | `src/components/viewer/SceneCanvas.tsx` | YES |
| App shell / length UI | `src/components/viewer/ViewerApp.tsx` | YES |
| Fleet + axles | `src/lib/trucks.ts` | YES |
| Packing (do not port math) | `src/lib/packing.ts` | YES |
| Panelín texture | `public/bmo-mascot.png` | YES (175889 B) |
| Design ref image | `public/truck-bmc-design-ref.png` | YES |
| Port goal | `artifacts/goals/GOAL-port-truckmodel-calculadora-bmc.md` | YES |
| Draco path only | `SceneCanvas.tsx:10` `useGLTF.setDecoderPath("/draco/")` | YES — not used for cabin |

### Component tree (TruckModel.tsx)

```
TruckModel
├── BmcCab(rearX, width, cabLit)
├── CargoBed(lengthM, widthM, deckTop)
├── Wheel × front L/R
├── Wheel × mid L/R dual          [only if axles===3]
├── Wheel × rear L/R dual
├── group (cab hitbox + click)
│   ├── mesh (invisible raycast box)
│   ├── CabDriver(lit)
│   └── pointLight                 [if cabLit]
├── Headlight × 2                  [if cabLit]
└── group @ deckTop+0.01
    ├── DimensionRulers            [optional]
    ├── PlacedCargo                [sandbox only — Calculadora uses CargoBox]
    └── CargoVolume                [optional volume shell]
```

---

## B. Visual recipe (copy-ready constants + component tree)

### B.1 Constants — `TruckModel.tsx:8-23`

```js
const BMC_BLUE = "#1a4d7a";
const BMC_BLUE_LIT = "#2563a8";
const BMC_DARK = "#0f2a45";
const WOOD = "#9a6b42";
const WOOD_PLANK = "#7d5534";
const WOOD_DARK = "#5a3a22";
const METAL = "#3d4652";
const METAL_LIGHT = "#6a7480";
const CHROME = "#b8c0c8";
const RUBBER = "#1c1c1c";
const GLASS = "#9ec8e8";
const RULER = "#f87171";

const CABIN_LEN = 2.55;   // meters
const CABIN_WIDTH = 2.4;  // meters (clamped with bed width)
```

### B.2 Global layout — `TruckModel` (`TruckModel.tsx:527-628`)

```js
const deckTop = 1.15;
const wheelR = 0.52;
const wheelY = wheelR;

const halfL = lengthM / 2;
const halfW = widthM / 2;

const cabRearX = -halfL - 0.02;              // cab rear faces bed front
const cabCenterX = cabRearX - CABIN_LEN / 2;
const cabWidth = Math.min(widthM + 0.1, CABIN_WIDTH);

// −X = truck front (sandbox)
```

### B.3 BmcCab mesh tree — origin at **rear of cab**, `y0 = 0.48`

| Part | Position (local) | Size (box unless noted) | Material |
|------|------------------|-------------------------|----------|
| Lower body | `[-L*0.48, y0+0.72, 0]` | `[L*0.96, 1.35, W]` | paint BMC_BLUE / BMC_BLUE_LIT, metalness 0.28, roughness 0.38; emissive `#1a3a5c` @0.28 when lit |
| Sleeper/high roof | `[-L*0.42, y0+1.85, 0]` | `[L*0.78, 0.95, W*0.96]` | paint |
| Roof cap | `[-L*0.42, y0+2.38, 0]` | `[L*0.72, 0.12, W*0.88]` | BMC_DARK |
| Roof fairing | `[-L*0.78, y0+2.2, 0]` rot Z −0.25 | `[0.55, 0.18, W*0.75]` | paint |
| Windshield | `[-L*0.92, y0+1.55, 0]` rot Z −0.38 | `[0.06, 1.05, W*0.88]` | GLASS, opacity 0.48 / 0.28 lit, depthWrite false |
| Windshield frame | `[-L*0.9, y0+1.55, 0]` rot Z −0.38 | `[0.04, 1.12, W*0.94]` | BMC_DARK |
| Side glass ±Z | `[-L*0.5, y0+1.55, ±(W/2∓0.02)]` | `[L*0.45, 0.7, 0.04]` | GLASS |
| Door panels ±Z | `[-L*0.48, y0+0.75, ±(W/2±0.02)]` | `[L*0.55, 1.2, 0.05]` | paint |
| Handles ±Z | `[-L*0.35, y0+0.95, ±(W/2±0.06)]` | `[0.16, 0.05, 0.04]` | CHROME metalness 0.85 |
| Bumper | `[-L*0.98, y0+0.28, 0]` | `[0.22, 0.38, W*0.98]` | METAL |
| Grille block | `[-L*0.98, y0+0.85, 0]` | `[0.1, 0.7, W*0.62]` | BMC_DARK |
| Grille bars ×5 | `[-L*1.01, y0+0.55+i*0.12, 0]` | `[0.04, 0.03, W*0.55]` | CHROME |
| Headlight mesh ±Z | `[-L*0.99, y0+0.55, ±W*0.34]` | `[0.12, 0.2, 0.28]` | `#fff7d6` emissive `#fde68a` intensity 0.55 / **2.8 lit** |
| Mirrors ±Z | `[-L*0.88, y0+1.7, ±(W/2±0.22)]` | `[0.12, 0.35, 0.18]` | BMC_DARK |
| Mirror arms | `[-L*0.88, y0+1.55, ±(W/2±0.12)]` | `[0.06, 0.06, 0.2]` | METAL |
| Steps ±Z | `[-L*0.5, y0+0.08, ±(W/2±0.08)]` | `[L*0.4, 0.08, 0.18]` | METAL |
| Rear wall | `[-0.04, y0+1.2, 0]` | `[0.1, 2.2, W*0.96]` | BMC_DARK |
| Fuel tank | `[-L*0.25, y0+0.35, W/2+0.05]` rot Z π/2 | cylinder r=0.28, h=0.9 | METAL |
| BMC labels | SpriteLabel doors | size 0.28 | white |

`W = Math.min(width + 0.1, CABIN_WIDTH)` · `L = CABIN_LEN`  
Refs: `TruckModel.tsx:366-524`

### B.4 CargoBed — flat, no barandas

| Part | Notes | Size / pos |
|------|-------|------------|
| Long beams ±Z | chassis | `[lengthM+0.2, 0.16, 0.14]` @ y=chassisY, z=±halfW*0.35 |
| Cross members | n = max(4, round(lengthM/1.2)) | `[0.1, 0.12, widthM*0.72]` |
| Deck slab | wood | `[lengthM, 0.12, widthM]` centerY = deckTop − 0.06 |
| Planks | count = max(8, round(lengthM*3)) | each `[plankW*0.92, 0.008, widthM*0.985]` alternating WOOD / WOOD_PLANK |
| Side sills only | **not rails** | `[lengthM, 0.02, 0.03]` @ deckTop+0.01, z=±(halfW−0.015) |
| Rear underrun | | `[0.12, 0.18, widthM*0.92]` @ halfL+0.08, deckTop−0.35 |
| Front bulkhead | against cab | `[0.1, 1.4, widthM*0.98]` @ −halfL+0.05, deckTop+0.7 |
| Bulkhead inset | | `[0.04, 1.25, widthM*0.7]` BMC_DARK |
| Length label | SpriteLabel | `${lengthM} m` |

`deckTop = 1.15`, `deckThickness = 0.12`, `chassisY = deckTop − 0.32`  
Refs: `TruckModel.tsx:286-363`

### B.5 Wheel

```js
radius = 0.52
tireW = 0.28
axleRot = [Math.PI/2, 0, 0]   // Z-axis axle
// tire cylinder [r, r, tireW, 16] RUBBER roughness 0.95
// rim  [r*0.55, r*0.55, tireW*0.5, 12] METAL_LIGHT metalness 0.55
// dual: gap = tireW * 0.58; two tires along ±side * gap
```

Refs: `TruckModel.tsx:244-282`

### B.6 CabDriver / Panelín

```js
texture: useTexture("/bmo-mascot.png")  // clone + SRGBColorSpace
height = 0.95
width  = height * (392/528)   // image aspect
plane rotation [0, Math.PI/2, 0]  // face along ±X
seat box [0.4, 0.1, 0.38] under plane

// unlit: map + color #0a0c10 opacity 0.5 alphaTest 0.12
// lit:   map full, alphaTest 0.08, toneMapped false
// lit:   pointLight intensity 2.2 distance 2.6 decay 1.4 color #ffe6b0
```

Placement from TruckModel hit group:
- group @ `[cabCenterX, 1.7, 0]`
- CabDriver @ `[0.15, -0.4, cabWidth*0.08]` local

Refs: `TruckModel.tsx:189-241`, `595-613`

### B.7 Click / lights behavior

```js
// onClick cab hitbox → setCabLit(true); clearTimeout; setTimeout(false, 10_000)
// hitbox: box [CABIN_LEN+0.3, 2.9, cabWidth*1.2] opacity 0.001
// stopPropagation on click + pointerDown
// useCursor(hovered)

// when cabLit:
//   interior pointLight [0, 0.35, 0] intensity 3.2 distance 3.6 decay 1.25 #fff2d0
//   Headlight spots intensity 14 angle 0.42 penumbra 0.45 distance 22 decay 1.15 #fff5d6
//   headX = cabRearX - CABIN_LEN + 0.1
//   headY = 1.05
//   aimX = headX - 12
//   Z offsets ± cabWidth * 0.28
```

Refs: `TruckModel.tsx:160-187`, `557-619`

---

## C. Lighting recipe (SceneCanvas)

| Light | Params | File:line |
|-------|--------|-----------|
| Background | `#141922` | SceneCanvas:99 |
| Fog | `#141922`, near 32, far max(70, L*6) | :100 |
| ambient | intensity **0.9**, `#e0e8f4` | :101 |
| hemisphere | sky `#d0def2`, ground `#2e3648`, intensity **0.75** | :102 |
| directional key | pos `[9,16,7]` intensity **1.9** `#fff7ec` | :103 |
| directional fill | pos `[-8,8,-6]` intensity **0.55** `#a8c4e8` | :104 |
| point fill | pos `[0,4.5,0]` intensity **0.8** dist 22 decay 1.5 `#ffe8c8` | :105 |
| CargoFocusLight spot | pos `[L*0.12, deckTop+H+2.8, 3.4]` intensity **3.0** angle 0.72 penumbra 0.5 dist 28 decay 1.35 `#fff1d0` target deck cargo | :17-43 |
| ContactShadows | y=0.01 opacity 0.35 scale max(28,L*2.2) blur 2.2 far 10 | :113-118 |
| Ground plane | color `#1a2030` roughness 0.92 | :121-124 |

**Camera:** fov 40, pos `[dist*0.55, dist*0.42, dist*0.72]`, target `[-L*0.15, 1.5, 0.1]`, dist = max(10, L*0.9+5)

**Calculadora tip:** raise ambient from ~0.55 toward **0.75–0.9** and add a soft cargo spot; keep dark bg `#0b1628` / `#141922` family.

---

## D. Axle & bed math

### Axles — `trucks.ts:111-114`

```ts
export function axleCountForLength(lengthM: number): 2 | 3 {
  return lengthM <= 6 ? 2 : 3;
}
```

### Placement — `TruckModel.tsx:551-593`

```js
const frontAxleX = cabCenterX - 0.65;
const midAxleX   = -halfL + lengthM * 0.28;   // only if axles===3
const rearAxleX  = axles === 2 ? halfL - 1.0 : halfL - 0.75;
const dualZ      = halfW - 0.06;               // dual wheels under bed sides
const frontZ     = Math.min(halfW + 0.05, 1.15);

// Always: front L/R single (dual=false)
// Always: rear L/R dual
// If 3: mid L/R dual
```

### Fleet widths (for fidelity) — `trucks.ts:37-100`

| id | lengthM | widthM | heightM | axles |
|----|---------|--------|---------|-------|
| bmc-6m | 6 | **2.25** | 2.4 | 2 |
| bmc-7m | 7 | 2.4 | 2.5 | 3 |
| bmc-8m | 8 | 2.4 | 2.5 | 3 |
| bmc-9m | 9 | 2.45 | 2.5 | 3 |
| bmc-10m | 10 | 2.45 | 2.6 | 3 |
| bmc-12m | 12 | 2.45 | 2.6 | 3 |
| bmc-14m | 14 | 2.5 | 2.7 | 3 |

**Note:** Calculadora MVP hardcodes `TRUCK_W = 2.4` for all lengths. Visual bed should use `TRUCK_W` to match packing; do **not** change packing width without product decision.

### Bed vertical stack

```
wheelR = 0.52
deckTop = 1.15
deckThickness = 0.12
deck center Y = 1.09
chassis Y = 0.83
sills at deckTop+0.01 (low only — not barandas)
bulkhead height ~1.4 above deck
```

---

## E. Coordinate remap → Calculadora-BMC

### Sandbox (this workspace)

| Axis | Meaning |
|------|---------|
| Origin | **Bed center** |
| X | length, −front (cab) … +rear |
| Y | up from ground |
| Z | width, ±widthM/2 |
| Cab | `rearX = -halfL - 0.02` |
| Cargo boxes | centers in bed frame, Y from deck |

### Calculadora-BMC (real app)

| Axis | Meaning |
|------|---------|
| Origin | scene uses `shiftX` at **front of cargo bed** |
| X | cargo `[shiftX, shiftX+truckL]` |
| Z | cargo `[0, TRUCK_W]` center `TRUCK_W/2` |
| Y | up |
| Cab | **X < shiftX** |
| Props | `{ shiftX, truckL }` only |
| Packing / free-drag / HeightGuides | **DO NOT CHANGE** |

### REMAP table

| Sandbox field | Formula → Calculadora |
|---------------|----------------------|
| `lengthM` | `truckL` |
| `widthM` | `TRUCK_W` (2.4) — keep packing width |
| `halfL` | `truckL / 2` |
| `halfW` | `TRUCK_W / 2` |
| Bed center X | `shiftX + truckL / 2` |
| Bed center Z | `TRUCK_W / 2` |
| Point sandbox `(x,y,z)` on bed | `(shiftX + truckL/2 + x, y, TRUCK_W/2 + z)` |
| `cabRearX` (sandbox) | `shiftX - 0.02` (cab rear ≈ cargo front) |
| `cabCenterX` | `shiftX - 0.02 - CABIN_LEN/2` |
| `frontAxleX` | `cabCenterX - 0.65` |
| `midAxleX` | `shiftX + truckL * 0.28` |
| `rearAxleX` (2 axles) | `shiftX + truckL - 1.0` |
| `rearAxleX` (3 axles) | `shiftX + truckL - 0.75` |
| `dualZ` world Z | `TRUCK_W/2 + (halfW - 0.06)` and mirror → or place group at z=TRUCK_W/2 and use local ±(halfW−0.06) |
| `frontZ` | local ±min(halfW+0.05, 1.15) about TRUCK_W/2 |
| Deck top Y | keep **1.15** if wheels r=0.52; or scale if Calculadora floor is y=0 thin plane — match visually so boxes (y from packing) still sit on deck: **prefer leave packing Y; raise deck under boxes or keep TruckFloor as packing plane** |
| Hitbox / CabDriver group | world X = `cabCenterX`, Z = `TRUCK_W/2` |
| Headlight Z | `TRUCK_W/2 ± cabWidth*0.28` |

### Critical packing safety

- HeightGuides already use `shiftX` + `truckL` + `TRUCK_W` + `MAX_H`.
- CargoBox positions already correct.
- TruckVisual must **not** own cargo meshes.
- If visual deck fights TruckFloor: lower visual deck by 0.01–0.02 or hide only the dark floor box of TruckFloor, **keep** saliente/ground.

### Why MVP looks “Minecraft”

Screenshot (Calculadora): solid blue cab box, flat orange bed, black wheel discs, headlights work, Panelín often invisible. Missing: multi-part BmcCab proportions, wood planks, dual tire geo, bulkhead detail, silhouette texture + emissive ladder.

---

## F. P0 port checklist (max 8 steps) — fix cube-cab without packing risk

1. **Branch** `feature/bmc-truck-visual-fidelity` in Calculadora-BMC.
2. **Copy asset** `bmo-mascot.png` → `public/bmo-mascot.png` (fallback: emissive boxes if 404).
3. **Rewrite** `TruckVisual.jsx` internals: port constants + `BmcCab` + `CargoBed` + `Wheel` + `CabDriver` + lights; **props stay** `{ shiftX, truckL }`.
4. **Apply remap** §E for every world position (bed center group + cab group).
5. **Wire** Scene: keep `<TruckVisual shiftX truckL />` + HeightGuides + CargoBox; resolve z-fight with TruckFloor only if needed.
6. **Match scene lights** partially: ambient ≥0.55→~0.75, optional cargo spot (SceneContent) — do not blow out free-drag UX.
7. **Verify matrix:** 6m=2 axles; 8m+=3; pack; free-drag; cab click 10s; Panelín visible when lit; no console errors.
8. **Commit** `feat(logistica): upgrade TruckVisual to BMC procedural cab/bed recipe (no packing change)`.

---

## G. Snippets (adapted to shiftX / truckL)

### G.1 Axle helper + wheel (JSX)

```jsx
const TRUCK_W = 2.4;
const CABIN_LEN = 2.55;
const deckTop = 1.15;
const wheelR = 0.52;

function axleCount(truckL) {
  return truckL <= 6 ? 2 : 3;
}

function Wheel({ position, dual = false }) {
  const tireW = 0.28;
  const axleRot = [Math.PI / 2, 0, 0];
  const side = position[2] >= 0 ? 1 : -1;
  const gap = tireW * 0.58;
  const Tire = ({ zOff }) => (
    <group position={[0, 0, zOff]}>
      <mesh rotation={axleRot}>
        <cylinderGeometry args={[wheelR, wheelR, tireW, 16]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.95} />
      </mesh>
      <mesh rotation={axleRot}>
        <cylinderGeometry args={[wheelR * 0.55, wheelR * 0.55, tireW * 0.5, 12]} />
        <meshStandardMaterial color="#6a7480" metalness={0.55} roughness={0.35} />
      </mesh>
    </group>
  );
  return (
    <group position={position}>
      {dual ? (<><Tire zOff={side * gap} /><Tire zOff={-side * gap} /></>) : <Tire zOff={0} />}
    </group>
  );
}
```

### G.2 Layout math inside TruckVisual

```jsx
export default function TruckVisual({ shiftX, truckL }) {
  const halfL = truckL / 2;
  const halfW = TRUCK_W / 2;
  const bedCenterX = shiftX + halfL;
  const bedCenterZ = halfW; // TRUCK_W/2

  const cabRearX = shiftX - 0.02;
  const cabCenterX = cabRearX - CABIN_LEN / 2;
  const cabWidth = Math.min(TRUCK_W + 0.1, 2.4);
  const axles = axleCount(truckL);

  const frontAxleX = cabCenterX - 0.65;
  const midAxleX = shiftX + truckL * 0.28;
  const rearAxleX = axles === 2 ? shiftX + truckL - 1.0 : shiftX + truckL - 0.75;
  const dualZLocal = halfW - 0.06;
  const frontZLocal = Math.min(halfW + 0.05, 1.15);

  // Render:
  // <group position={[bedCenterX, 0, bedCenterZ]}>
  //   <CargoBed lengthM={truckL} widthM={TRUCK_W} deckTop={deckTop} />  // local coords ±halfL ±halfW
  // </group>
  // <BmcCab rearX={cabRearX} width={cabWidth} cabLit={lightsOn} /> // BmcCab already positions from rearX on X, z=0 → wrap:
  // Better: <group position={[0,0,bedCenterZ]}><BmcCab rearX={cabRearX} ... /></group>
  // Wheels in world X, Y=wheelR, Z = bedCenterZ ± frontZLocal / dualZLocal
}
```

### G.3 Cab click lights (10s)

```jsx
const [lightsOn, setLightsOn] = useState(false);
const tRef = useRef(null);
const onCabClick = (e) => {
  e.stopPropagation();
  setLightsOn(true);
  if (tRef.current) clearTimeout(tRef.current);
  tRef.current = setTimeout(() => setLightsOn(false), 10_000);
};
// hit mesh + CabDriver as in TruckModel.tsx:595-613
// Headlight spots only when lightsOn
```

### G.4 Minimal BmcCab call (reuse body from TruckModel)

Port function `BmcCab` **verbatim** from `TruckModel.tsx:366-524` (local coords). Wrap:

```jsx
<group position={[0, 0, TRUCK_W / 2]}>
  <BmcCab rearX={shiftX - 0.02} width={Math.min(TRUCK_W + 0.1, 2.4)} cabLit={lightsOn} />
</group>
```

CargoBed port **verbatim** `TruckModel.tsx:286-363` inside:

```jsx
<group position={[shiftX + truckL / 2, 0, TRUCK_W / 2]}>
  <CargoBed lengthM={truckL} widthM={TRUCK_W} deckTop={1.15} />
</group>
```

---

## Diff summary: sandbox recipe vs Calculadora MVP

| Topic | Sandbox (recipe) | Calculadora MVP (screenshot) |
|-------|------------------|------------------------------|
| Cab | Multi-mesh FH cab | Single blue cube |
| Bed | Wood planks + bulkhead + sills | Flat orange plane |
| Wheels | Dual cylinder tires + rims | Black torus/discs |
| Panelín | Textured plane + lit boost | Often invisible |
| Lights | Spots 14 + interior 3.2 + emissive lamps | Works (headlights) |
| Origin | Bed center | shiftX corner |
| Packing | Local PlacedCargo | CargoBox external — keep |

---

## Epistemic

- **[CONFIRMED]** All sizes/materials/axles/lights quoted from `TruckModel.tsx` + `SceneCanvas.tsx` + `trucks.ts`.
- **[CONFIRMED]** No primary GLB cabin in active render path.
- **[CONFIRMED]** Calculadora screenshot shows boxy MVP + working free-drag UI.
- **[ASSUMPTION]** Calculadora `TruckVisual.jsx` already exists as MVP; replace internals only.

END RECIPE
