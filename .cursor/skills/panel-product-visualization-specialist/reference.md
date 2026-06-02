# Panel Product Visualization Specialist — Scoring Matrix (100 points)

## How to use
Score each item as **pass (full points)** or **fail (0)** (or partial only if rubric explicitly allows 1-2 pts). Sum all. 
Items marked (H) = high impact for user perception / sales value, (M) = medium, (L) = low but required for quality.
Run this audit explicitly when the user shares evaluation info or before merging visual product changes.
Re-score after implementation and record delta + final score.

**Key evaluation input (user videos):** 8LBIMiYYnRs (2D CAD plans/TechDraw), IV-nv9ygZPM (BIM 3D architecture), RQW723n3DkU (Python data→geom automation), dQyLqMLfluw (BIM library objects). Raise bar for professional, parametric, data-driven output.

---

## 1. Geometric Fidelity — Thickness, Profile, Joints (20 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| H1 | Visible thickness in 3D product/assembly | 5 | Where product 3D is shown (isolated viewer or enhanced assembly), panel has clear top + bottom + edge faces; thickness proportional to chosen espesor (e.g. 50mm looks distinct from 30mm). Not just painted line. |
| H2 | Accurate au / joint spacing | 4 | Strip/joint repeat in 3D (and 2D plan strips) uses the same `au` value from calc + `buildAnchoStripsPlanta`. Joint lines align visually between planta 2D and 3D top view. |
| M1 | Basic side/lap representation | 3 | At zone encounters or panel edges in 3D, show simple lap or thickness step (not sharp knife edge). 2D section shows typical side lap or fixing zone. |
| M2 | 2D cross-section stack | 4 | If 2D product section exists: layers (chapa ext ~0.5mm, core = espesor, liner, foil if FOIL family) drawn to relative scale; total height matches chosen espesor. Labels + hatching for core. |
| L1 | Profile hints (ribs / waves) | 2 | For ISOROOF / colonial families, top face shows subtle rib or tile modulation (via normal map or light geometry) rather than perfectly flat. |
| L2 | Thickness callout | 2 | 3D or 2D product view includes visible "XX mm" label for core or total (via Html overlay or SVG text). |

## 2. Material & Appearance Fidelity (20 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| H3 | Correct catalog texture per family | 5 | Diffuse map chosen by `getRoofPanelMapUrl` / `pickBestMapUrlFromSlides` matches the selected familia (ISODEC vs ISOROOF_PLUS vs FOIL etc.). No generic or wrong-family image. |
| H4 | Color variant sync | 4 | When user picks or hovers `techoColor` (Blanco/Gris/Rojo/etc.), the 3D product and showcase reflect the matching Shopify image (or best scored variant) immediately. FOIL and colonial have distinct treatments. |
| M3 | PBR params sensible | 3 | roughness/metalness from `ROOF_PANEL_VISUAL_PROFILES` feel right (FOIL lower roughness ~0.4 / higher metal ~0.22; colonial more matte ~0.68 / low metal; EPS/PIR in between). Changes visible under Orbit lighting. |
| M4 | Normal / roughness map usage | 3 | When `normalMapUrl` or `roughnessMapUrl` present in profile, they are loaded, repeated consistently with diffuse, and affect lighting (not ignored). Fallback to constant params is clean. |
| L3 | FOIL / special finish | 2 | ISOROOF_FOIL shows distinct bright/reflective quality (specular or map) vs standard ISOROOF_3G/PLUS. |
| L4 | Colonial tile read | 2 | ISOROOF_COLONIAL texture reads as "simil teja" at typical viewer distance (not just red flat). |
| L5 | Lighting consistency | 1 | Same environment/lights used for product viewer and roof assembly 3D (no jarring difference when switching context). |

## 3. 2D Technical Product Drawings (15 pts) — applies when sections/details are present or added

**Target (from user videos 8LBIMiYYnRs series):** Professional CAD/TechDraw quality — clean sheets, controlled line weights, proper material hatching, precise annotations, no "sketchy" feel.

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| H5 | Layer legibility + labels | 4 | Clear separation of chapa / core / liner / foil (if applicable); material names or codes readable, not overlapping geometry. |
| M5 | Dimension accuracy | 3 | Core height labeled with actual chosen espesor (e.g. 50 mm); other layers have realistic mm values (0.5 chapa, etc.). Consistent with visual profile + constants. |
| M6 | Drawing standards (TechDraw/FreeCAD) | 3 | Line weights, typography, ticks, hatching follow or are compatible with roofPlanDrawingTheme / roofPlanSvgTypography (or explicit documented variant for product sections). `data-bmc-layer` tags present. Hatches visible and conventional for insulation/metal. |
| L6 | Typical details | 2 | Section includes at least one realistic detail (e.g. fixing point zone, side lap profile, or edge trim indication). Profiled sheets show rib/trapezoid geometry (not flat rect). |
| L7 | Multiple views | 2 | At minimum one cross-section (across au) + option or second view for longitudinal or joint detail. |
| L8 | Capture ready | 1 | The 2D product section SVG carries `data-bmc-capture="panel-section-2d"` (or per-family) so it can be snapped for PDF. |

## 4. 3D Product Viewer / Experience (15 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| H6 | Isolated / focused product view | 4 | There is a clear way (in showcase, visor, or dedicated) to see a single panel or small representative module (not only full roof assembly). Camera starts with good angle showing thickness + surface. |
| H7 | Interaction quality | 3 | OrbitControls (or constrained) + zoom/pan work smoothly; double-click or button resets to sensible default; no control fighting with page scroll on mobile. |
| M7 | Annotations in 3D | 3 | Key specs visible as non-intrusive overlays (drei Html or equivalent): familia, espesor, au, color/finish. Optional toggle for more (R-value hint, weight, etc.). |
| M8 | Section / cut mode | 2 | Viewer offers a way to see internal construction (cut plane, opacity on one face, or dedicated 2D-linked section). |
| L9 | Context toggle | 2 | User can switch between "product only", "product + minimal roof context", "in assembly". |
| L10 | Performance / loading | 1 | Progressive (Suspense + useProgress), sensible fallback if texture fails, no jank on typical hardware. |

## 5. 2D ↔ 3D ↔ Calc Coherence (10 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| H8 | au / strip count match | 4 | Number and spacing of visual joints in 2D plan, 3D strips, and new product viewer exactly follow the same `buildAnchoStripsPlanta(ancho, panelAu)` result. |
| M9 | espesor drives visuals | 3 | Changing espesor in wizard (or in a product viewer control) visibly affects 3D thickness (and 2D section height) without requiring page reload. |
| M10 | Family drives appearance + data | 2 | Switching familia updates texture family, PBR params, default thickness, and any 2D section layer stack from the same source objects. |
| L11 | Color propagation | 1 | Color chosen for the quote flows to all product visual surfaces (3D, 2D section tint if applicable, showcase). |

## 6. Integration & Traceability (10 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| H9 | Showcase upgrade | 3 | PanelFamilyShowcase (or successor) surfaces the best available viz for the family (live 3D product or high-quality section) in addition to or replacing the old static img/iframe. Still supports Sketchfab env as opt-in. |
| M11 | Visor / quote integration | 2 | QuoteVisualVisor or equivalent can render product-level visuals (not only full roof 3D + planta). Useful in "producto" or line-item context. |
| M12 | PDF / snapshot support | 2 | Product 2D sections and/or 3D product stills are captured and appear in generated PDFs (via existing capture pipeline or explicit rows in quotationViews). |
| L12 | Client visuals | 1 | If `generateClientVisualHTML` or similar uses product imagery, it pulls from the same resolved maps/profiles (no drift). |
| L13 | data-bmc-capture & ids | 2 | All new capture targets have stable `data-bmc-capture` attributes. 3D canvases that need snapshot keep `preserveDrawingBuffer: true`. |

## 7. Performance, Fallbacks & Polish (10 pts)

| # | Item | Pts | Pass criteria |
|---|------|-----|---------------|
| H10 | Graceful degradation | 3 | Missing map → solid color + label or clear "textura no disponible". No Sketchfab env var → clean catalog image (no broken iframe). No WebGL → readable fallback image or 2D section. |
| M13 | Mobile / small viewport | 2 | Product cards and viewers remain usable and legible at 375-768 px widths (no clipped controls, readable labels, reasonable touch targets). |
| M14 | Legend / explanation | 2 | When advanced viz is shown, there is minimal help text or legend ("Vista referencial del panel", "Corte constructivo — no a escala estructural"). |
| L14 | No visual artifacts | 2 | No z-fighting, texture stretching at edges, floating labels, or obvious tiling seams in normal use. |
| L15 | Consistency with roofplan theme | 1 | Where 2D product drawings coexist with roof plans, shared colors/typography/line conventions feel part of one system (or deliberate, documented contrast). |

## Score ranges & targets
- **90-100**: Excellent — ready for production visual upgrade or client demos. Minor polish only.
- **75-89**: Good — shippable with a couple of tracked follow-ups (list the failing items).
- **60-74**: Acceptable for internal / beta — must fix all (H) items before wider exposure.
- **<60**: Do not ship visual changes. Re-audit after fixes.

Record the scored items + total + date + commit/context in the session notes or a `docs/team/visual/product-render-audit-YYYY-MM-DD.md` when doing serious work.

## Quick start commands (for auditor)
```bash
# After changes touching visuals
npm run lint
npm test
# Then manual: open calc, pick families, go through dimensiones → visor 3D, generate PDF, check mobile.
# Re-score this matrix.
```

Update this reference.md when new high-value items are identified (e.g. after user shares specific evaluation criteria).
