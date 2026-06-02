---
name: panel-product-visualization-specialist
description: >
  Skill + 100-point rubric for 2D technical product drawings and 3D product renders
  of BMC/Panelin panels. Covers geometry (thickness, profile), material fidelity
  (PBR + catalog textures), 2D/3D coherence, integration in calc/visor/PDF/showcase,
  and asset pipeline. Complements roofplan-architect skill (assembly vs product focus).
---
# Panel Product Visualization Specialist — Skill

## When to use this skill

- User asks to "improve 2D/3D of products", "renderizacion de paneles", "mejorar visuales de ISODEC/ISOROOF", "add thickness to 3D", "secciones 2D de panel", "mejorar showcase 3D".
- Before/after any change to `PanelFamilyShowcase`, `RoofPanelRealisticScene` (product aspects), `roofPanelVisualProfiles`, map resolvers, or new product viz components.
- Running the quality rubric as a gate.
- Designing or implementing isolated product viewers, cross sections, better PBR, per-product visuals in quotes/PDFs.
- Evolving `PanelRendering/` sync or Shopify family mapping for visuals.
- User references FreeCAD tutorials for "planos profesionales", "BIM", "secciones técnicas", "automatización con Python".

## 8-Domain Checklist (before shipping visual product work)

1. **Geometric Accuracy** — thickness visible and to-scale in 3D where relevant; 2D sections show correct layer stack + real mm dims from data.
2. **Material Fidelity** — correct catalog texture per familia + color variant; PBR params (roughness/metalness) sensible per finish (FOIL lower roughness, colonial more diffuse); normal/roughness maps used when available.
3. **2D Product Drawings** — if adding sections/details: clean SVG, proper line weights/typography (coordinate with roofplan-architect standards), labeled layers, parametric from constants/espesor.
4. **3D Product Experience** — OrbitControls or constrained, good default camera, annotations (drei Html) for key specs, optional section/cut, graceful on mobile, loading states.
5. **Coherence** — au strip spacing, chosen espesor, familia, color must be consistent between calc, 2D plan strips, 3D texture repeat + any new product 3D/2D.
6. **Integration** — reusable in showcase, QuoteVisualVisor (product or assembly context), PDF capture/snapshots or appendix, client visuals if applicable. Capture paths (`data-bmc-capture`) preserved or extended.
7. **Asset Pipeline** — images/manifest in PanelRendering up to date or script run; fallbacks work; env-driven Sketchfab still supported as enhancement.
8. **Polish / Performance / QA** — no WebGL artifacts, good contrast/legibility, no overlap of annotations, `npm run lint` + `npm test` + manual verification in browser (familia choice + visor + PDF gen) + re-score rubric.

## Scoring Rubric (summary — full matrix in reference.md)

| Domain | Max | Focus |
|--------|-----|-------|
| Geometric Fidelity (thickness, profile, joints) | 20 | 3D volume + edges; 2D stack accuracy |
| Material & Appearance Fidelity | 20 | Texture choice/tiling, PBR, color variants, FOIL/colonial special cases |
| 2D Technical Product Drawings | 15 | New cross-sections, details, labels, ISO-ish drawing quality |
| 3D Product Viewer / Experience | 15 | Isolated viewer UX, annotations, controls, cutaways, coherence with assembly 3D |
| 2D ↔ 3D ↔ Calc Coherence | 10 | au, espesor, fam, strips, visual scale all agree |
| Integration & Traceability (showcase, visor, PDF, capture) | 10 | Reusable components, snapshots, data-bmc-capture, PDF rows |
| Performance, Fallbacks & Polish | 10 | Load perf, no crash on missing maps, mobile, fallbacks (no Sketchfab), legibility |
| **TOTAL** | **100** | |

Full per-item matrix with pass criteria (H/M/L items): see `reference.md` in this skill folder.

## Key Constants & Patterns (keep in sync)

```js
// src/data/roofPanelVisualProfiles.js
ROOF_PANEL_VISUAL_PROFILES[ FAMILIA ] = {
  mapUrl: ..., normalMapUrl?, roughnessMapUrl?, roughness: 0.4-0.7, metalness: 0.05-0.25, thicknessMm: 30|40|50|80|...
}
getRoofPanelVisualProfile(fam, chosenEspesor) // returns effective thicknessMm
```

- Texture repeat in 3D currently uses `buildAnchoStripsPlanta` + repeat.set( stripW / au , ... ) for panel joint simulation.
- For new isolated product 3D: prefer a small module (e.g. 1-2 au wide × 1-2 m largo) on a neutral base or with minimal context (eave detail optional). Use same material construction as RoofStripMesh but with actual thickness (e.g. two offset planes + side faces, or ExtrudeGeometry for simple profile).
- 2D sections: create under `src/components/panelViz/` or similar (e.g. `PanelCrossSection.jsx`). Output SVG in meters or mm (document choice). Use similar typography/line utils from roofPlan* where it helps consistency (import, don't duplicate).

## Implementation Patterns

**Adding thickness / volume to a product 3D view:**
1. In a new or extended mesh group, create top face (current plane logic), bottom face (offset by thickness * sin/cos for slope), and thin side/lap faces.
2. Share the same material (or slight variation for liner side) and UV logic.
3. Expose `showThickness` or `cutSection` prop for viewer modes.
4. Keep the "strips" for joint lines on the top face (visual continuity with planta).

**Adding a 2D product cross-section:**
1. New component receives `familiaKey, espesorMm, color?`.
2. Renders `<svg>` with layers as rects or paths (chapa ext 0.5mm, core full espesor, foil if FOIL family, etc.).
3. Pull real-ish layer thicknesses from profiles or a new `PANEL_LAYER_SPECS` (mm) in data (coordinate with pricing/calc owners).
4. Add labels, hatch for core, dimension lines (reuse or adapt roof plan dim style).
5. Tag with `data-bmc-layer` and `data-bmc-capture="panel-section-2d"` for PDF.
6. Mount in showcase (on select or hover), in a "Ficha visual" tab, or in PDF product appendix.

**Improving asset selection:**
- Extend `pickBestMapUrlFromSlides` / scoreTextureUrl logic for new families or color variants.
- When adding normal/roughness support: update visual profile, clone + repeat in material setup (see RoofStripMesh), dispose in cleanup.
- Run `npm run panel:rendering:sync` (or the script) after Shopify catalog changes; update manifest expectations.

**Wiring a product viewer into existing surfaces:**
- Showcase: replace or augment the img/iframe with a small live Canvas (lazy) or SVG section on hover/select.
- QuoteVisualVisor: add an accordion or tab "Producto" that mounts the 2D section + small 3D product (besides the roof assembly 3D).
- PDF: extend `buildSnapshotSectionHtml` or add a product visuals section that captures the new elements (or generates static SVG/HTML).

## Verification Workflow

1. `npm run lint` (src/ changes).
2. `npm test` (any shared calc/visual logic; add/update suites if geometry/counting affected).
3. Browser manual (or MCP): 
   - Select different families + espesores in wizard.
   - Open QuoteVisualVisor / 3D areas.
   - Generate PDF and inspect snapshots + any new product visuals.
   - Mobile viewport for legibility.
4. Re-score the rubric (reference.md). Target: no regressions on existing items; net positive on new domains.
5. For larger changes: `npm run gate:local:full`.
6. If assets changed: re-run panel rendering sync and verify fallback paths still work.

## References

- Agent definition: `.cursor/agents/bmc-panel-product-visualization-specialist.md`
- Full scoring matrix: `reference.md` (this folder)
- Complementary: `roofplan-architect` skill (for roof assembly 2D/3D drawing quality)
- Related: `sketchup-sketchfab-docs-architecture` skill (for sourcing better 3D references)
- Knowledge: `docs/team/knowledge/KINGSPAN-BIM-3D-DOWNLOAD-SOURCES.md`
- Current product visuals entry points: `PanelFamilyShowcase.jsx`, `RoofPanelRealisticScene.jsx`, `roofPanelVisualProfiles.js`
- New: `src/data/panelConstructionSpecs.js` (authoritative layer specs from fichas), `src/components/panelViz/PanelCrossSection.jsx` (2D CAD sections)
- Roadmap: `docs/team/visual/PANEL-PRODUCT-VIZ-ROADMAP-FROM-FREECAD.md` (phased plan driven by the FreeCAD videos)
- Capture/PDF: `captureDomToPng.js`, `quotationViews.js`

## References from user evaluation (FreeCAD videos)
- 8LBIMiYYnRs: Housing plans tutorial — focus on TechDraw 2D output (weights, hatches, dims). Our PanelCrossSection must match this professionalism.
- IV-nv9ygZPM: BIM Architecture beginner — parametric 3D objects with real properties.
- RQW723n3DkU: Python API automation from data (CSV/params → parts). Mirror this: our specs + generator (JS first, Python later) produce viz from quote inputs.
- dQyLqMLfluw: BIM Library state — make panel constructions feel like reusable, queryable BIM library objects.

After changes, update "Cambios recientes" in `docs/team/PROJECT-STATE.md` and relevant handoff notes. Communicate in Spanish for user-facing and docs.
