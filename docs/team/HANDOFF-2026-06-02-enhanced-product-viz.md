# Handoff — Panel Product Viz Research + Toggleable Integration (2026-06-02)

**Date**: 2026-06-02
**Branch**: main
**Session focus**: Complete deep research on real product renders, technical drawings, and DWGs for BMC/Panelin panels (Isoroof/Isodec series plegados/grecas, TECHMET constructive details, BMC accessories like frontales/babetas/desarrollos) to faithfully represent the exact products already in the calculator (without modifying any real data/specs/assets per "no modifiques naa" constraint). Created mapping docs and interactive tests. Implemented safe toggleable integration (`enhancedProductViz` flag, default OFF, runtime via localStorage, exposed only in devMode via new "PViz" header button) into the UI surfaces (PanelFamilyShowcase, espesor step, QuoteVisualVisor) so current state is untouched. Local run verified (with disk skip or partial clean). Ready for next-day continuation (e.g. deeper 3D extrusion or prod deploy).

## Current State

- **Git**: main (dirty with our session work)
- **Uncommitted changes**: See list below. Feature is 100% additive and behind runtime toggle (OFF by default) — no risk to existing behavior, textures, 3D ensamble, PDF pipeline, etc.
- **Disk**: Was low (~854 MiB free vs 1024 MiB min, blocking predev). Partial safe cleanup done (npm cache, some user caches) → more headroom (2443 MiB reported post-clean in one check). Precheck can be bypassed with `BMC_DISK_PRECHECK_SKIP=1`.
- **Local dev**: Vite server starts at http://localhost:5173/ (via `BMC_DISK_PRECHECK_SKIP=1 doppler run -- npm run dev`). DevMode (Ctrl/Cmd+Shift+D) + PViz toggle works to demo the feature.
- **Production**: Not deployed (changes uncommitted/unpushed). Current prod is pre-this-session (last origin commit ~tutorial feat). Feature freeze active from prior Phase 0 (~10 working days).
- **Standalone tests**: Fully functional for quick local demo without full app stack.
- **Key artifacts from research + integration**:
  - Mapping verification (images → exact calculator products + DWG cross-refs): docs/team/visual/PRODUCT-IMAGE-MAPPING-VERIFICATION.pdf + .html (5 pages, embedded images, table, per-family sections, TECHMET/DWG notes).
  - Live interactive test/simulator: docs/team/visual/LIVE_INTERACTIVE_ENHANCED_PRODUCT_VIZ_TEST.html (toggle + familia/espesor/visor simulator showing real refs + DWG notes when ON).
  - Knowledge reports: docs/team/knowledge/INTERNAL-TECHMET-BMC-DWG-CONSTRUCTIVE-DETAILS-INVESTIGATION.md (full DWG inventory, profile insights, forros F1-MET etc., mapping to PERFIL_TECHO/BORDER_OPTIONS); ISOROOF-PLEGADOS-REAL-REFERENCES-UY-2026.md (UY sources, images, BIM, videos).
  - Code: toggle + conditional UI in the 3 components (see uncommitted).
  - PROJECT-STATE.md updated with session entries (our viz work + prior appends).

## Uncommitted Files / Changes
```
 M  docs/team/PROJECT-STATE.md
 A  docs/team/visual/LIVE_INTERACTIVE_ENHANCED_PRODUCT_VIZ_TEST.html
 M  src/components/PanelFamilyShowcase.jsx
 M  src/components/PanelinCalculadoraV3_backup.jsx   (main source; re-exported by src/PanelinCalculadoraV3.jsx)
 M  src/components/QuoteVisualVisor.jsx
MM src/data/calculatorDataVersion.js   (side effect of version:data in dev runs)
```
(Also untracked visual/ assets from research if any beyond the LIVE HTML; git status shows the above as of close.)

**Recommendation**: Before commit, run `npm run gate:local:full` (or at min gate:local + smoke:prod). Do not commit lightly under feature freeze. Backup any visual assets. The toggle is safe (dev-only exposure, default OFF, no data changes).

## Blockers
- Disk space (partially mitigated; full recovery may need user-approved groups per disk-space-recovery-resume skill or mac-rescue if more space needed for clean precheck without SKIP).
- Feature freeze active (from Phase 0 ~2026-05-28 to ~06-11): stability-only. This work was research + safe additive integration, but any prod push should be post-freeze or explicitly approved.
- No other blockers. Research complete, integration toggleable and demoable locally.

## Key Updates Made This Session
- Exhaustive "mas completa" research on real UY renders/assets (kingspan.com.uy product pages + "3 grecas" explicit text + fichas, bmcuruguay commercial photos matching exact PANELS_TECHO names, Bromyros PDFs with "trapezoidal (3 grecas)", fotos-de-obras real installs, biblioteca-bim Revit, Instagram/YouTube, internal Dropbox DWGs: TECHMET series with forros F1-MET-1..F6 + plegado doble + "ANCHO UTIL 1000 mm" + fixings, BMC frontales/babetas/desarrollos for accessories/profiles. Cross-ref to calculator families (ISOROOF_3G/PLUS/FOIL/COLONIAL au=1.0m 3-grecas; ISODEC au=1.12m engrafado) and prior plegados-en-general.dwg.
- Created visual mapping artifacts (PDF + interactive HTML) for Lio/team to select/verify real refs that "representen" the products.
- Implemented toggleable integration (per user request "if something modifies is i a new toggle able or untoggelaebled so we dont break our current state"):
  - Runtime flag `enhancedProductViz` (default false, persisted local/sessionStorage).
  - DevMode hotkey (existing) now surfaces "PViz:OFF/ON" button in header (new, only in devMode).
  - Prop passed to PanelFamilyShowcase + QuoteVisualVisor.
  - Conditional UI (when ON): real ref images + captions + DWG notes in familia showcase (extra "Real ref" under cards), espesor step (non-intrusive card), visor (product real section with images + "perfiles de plegados/grecas/forros ... from TECHMET + BMC/Desarrollos/BabetaLateral").
  - No changes to existing renders, data (constants, specs), assets, or logic when OFF. Uses public researched image URLs for refs (easy to bundle later).
- Standalone live interactive test HTML for quick verification/demo (simulates exact surfaces + toggle behavior).
- Local run instructions + partial disk cleanup (safe caches) to unblock dev.
- Docs: PROJECT-STATE.md entries (viz research + integration + prod status check); new knowledge reports; this handoff.
- Verified no-break: lint clean (0 new errors), flag default OFF, additive only. Server runs locally (with SKIP or after clean). Feature visible only via dev + toggle.

## Files Changed / New (this session)
- New: docs/team/visual/LIVE_INTERACTIVE_ENHANCED_PRODUCT_VIZ_TEST.html (primary demo)
- New: docs/team/knowledge/INTERNAL-TECHMET-BMC-DWG-CONSTRUCTIVE-DETAILS-INVESTIGATION.md
- New/updated: docs/team/knowledge/ISOROOF-PLEGADOS-REAL-REFERENCES-UY-2026.md (and prior mapping PDF/HTML)
- Modified: src/components/PanelinCalculadoraV3_backup.jsx (core toggle + dev button + prop wiring + espesor ref)
- Modified: src/components/QuoteVisualVisor.jsx (prop + conditional real product section)
- Modified: src/components/PanelFamilyShowcase.jsx (prop + conditional real refs in cards)
- Modified: docs/team/PROJECT-STATE.md (multiple entries + prod check + closeout note)
- (visual/ mapping PDF/HTML from research; may be outside git or prior)

## Next Prompt to Resume With (literal)

"Read docs/team/HANDOFF-2026-06-02-enhanced-product-viz.md (and the LIVE_INTERACTIVE_ENHANCED_PRODUCT_VIZ_TEST.html + PRODUCT-IMAGE-MAPPING-VERIFICATION.pdf for quick context). Current branch main with uncommitted integration of panel product viz (toggleable enhancedProductViz default OFF via devMode + PViz button; real refs from researched images + DWG plegados/forros/babetas in showcase/espesor/visor). Dev server runs locally with BMC_DISK_PRECHECK_SKIP=1 doppler run -- npm run dev (or after more disk clean per recovery skill). Open http://localhost:5173/ , Ctrl/Cmd+Shift+D for dev, toggle PViz ON, test familia/espesor/visor to verify mapped products + DWG notes (no breakage when OFF). Next: (a) implement 3D real profile extrusion/volumetry from Desarrollos/plegados/TECHMET DWGs behind same flag (update RoofPanelRealisticScene), (b) add 2D CAD sections from DWG constructivos to PDF/visor, (c) commit/push/deploy safely (feature OFF), (d) more disk recovery if precheck blocks, or (e) Lio review of selected refs from mapping docs. Follow AGENTS.md / CLAUDE.md (gates, PROJECT-STATE, handoff on close, no unapproved changes under freeze)."

## Quick Verification / Resume Commands
```bash
# Run app locally (with disk guard skip if needed)
cd /Users/matias/calculadora-bmc
BMC_DISK_PRECHECK_SKIP=1 doppler run -- npm run dev
# Then in browser: http://localhost:5173/
# Activate: Ctrl/Cmd + Shift + D (devMode) → click PViz:OFF → ON
# Test: wizard familia (showcase refs), espesor (card), visor (real section + DWG notes)

# Quick standalone demo (no server needed)
open /Users/matias/calculadora-bmc/docs/team/visual/LIVE_INTERACTIVE_ENHANCED_PRODUCT_VIZ_TEST.html
# Toggle at top, select families/espesors, see live refs + notes

# Git / state
git status
git diff --stat origin/main -- src/components/PanelinCalculadoraV3_backup.jsx src/components/QuoteVisualVisor.jsx src/components/PanelFamilyShowcase.jsx
df -h /System/Volumes/Data
npm run gate:local:full   # before any commit

# Research context
open /Users/matias/calculadora-bmc/docs/team/visual/PRODUCT-IMAGE-MAPPING-VERIFICATION.pdf
cat docs/team/knowledge/INTERNAL-TECHMET-BMC-DWG-CONSTRUCTIVE-DETAILS-INVESTIGATION.md | head -100
```

**Session complete. Research thorough, integration safe/toggleable + demoable locally. All per constraints (no data mods, toggleable changes, handoff doc). Ready to continue other day.**

---

## Progress Update (executed on "recomend and run" request)

**Date of run**: 2026-06-02 (immediate execution after handoff)

**Recommendation followed**: From this handoff literal next + prior panel-viz roadmap (Fase 1 complete 2D CAD sections in visor + prepare for 3D volumetry).

**Executed**:
- Added inline SVG "Sección 2D constructiva (inspirada TechDraw / DWG)" inside the existing `enhancedProductViz` conditional in `QuoteVisualVisor.jsx`.
  - ISOROOF families: 3-grecas trapezoidal profile (ribs + valley hatching simulation, labels "3 grecas | AU ~1000mm" + "Perfil plegado (TECHMET F*-MET + BMC Desarrollos)").
  - ISODEC families: engrafado-style polyline profile ("Engrafado | AU ~1120mm" + "Perfil constructivo (ref DWG + forros F1-MET)").
- CAD-like styling (monospace labels, subtle hatch pattern for liner/core, clean borders).
- Placed inside the green "Producto real" card, after the ref images + DWG note. Fully behind the flag (default OFF, no impact on prod/current UI/3D/PDF when OFF).
- Verified: `npx eslint src/components/QuoteVisualVisor.jsx` clean (0 issues). `npm run gate:local` (with SKIP) passed relevant suites (no new breakage introduced).
- This directly advances the " (b) add 2D CAD sections from DWG constructivos to PDF/visor " and prepares data for future 3D extrusion in RoofPanelRealisticScene (same flag).

**Next immediate after this run** (updated literal):
- Wire similar 2D profile (or reuse component) to PanelFamilyShowcase cards + espesor step (for consistency when PViz ON).
- Or jump to (a): basic 3D profile extrusion in the realistic scene (extrude the 2D polyline, thickness from researched specs, toggleable).
- Re-run full `npm run gate:local:full` + manual browser test (familia → espesor → visor with PViz ON, PDF snapshot if capture works).
- Update the LIVE_INTERACTIVE_ENHANCED_PRODUCT_VIZ_TEST.html simulator to include the new SVG section.
- When ready (post any freeze exception): commit behind flag, update handoff, push (feature OFF in prod).

**Gate run output summary (this execution)**: ESLint 0 errors on edited file. Gate:local showed multiple contract suites 12+13 passed 0 failed (full output truncated in run but exit clean; no regressions from the SVG addition).

All changes additive + documented. Feature remains safe for review (Lio or team) via the mapping PDF + live HTML + dev toggle.

*Executed per user "recomend and run" + handoff next steps. Specialist pattern followed (research refs + DWG + CAD inspiration + rúbrica-like gates).*

---

*Updated handoff after execution. Original closeout text preserved above.*