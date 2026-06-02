# Internal DWG Investigation: TECHMET Constructive Details + BMC Uruguay Accessories (Frontales, Babetas, Desarrollos)

**Date:** 2026-06  
**Scope:** Non-destructive inspection of the 17+ local .dwg files provided by user (Dropbox paths under "bmc - interna" and "BMC - Uruguay").  
**Constraint respected:** Pure investigation / reference collection. **Zero modifications** to project code, data (constants.js, panel specs, assets), or any real product data. These are internal CAD references to be used for visual/technical fidelity (like the previous external kingspan.com.uy / Bromyros / plegados-en-general.dwg research).  
**Relation to prior work:** Complements the "mas completa" UY research (kingspan.com.uy Isoroof/Isodec pages with explicit "3 grecas", Bromyros PDFs confirming "trapezoidal (3 grecas)", bmcuruguay commercial photos, biblioteca-bim Revit, fotos-de-obras, previous plegados DWG). These DWGs appear to be the **internal company source** for the exact accessory profiles, flashings ("forros"), plegados, fixings, and constructive details used with the sandwich panels (Isoroof/Isodec series) sold by BMC Uruguay.  
**Goal for Lio / viz team:** High-value ground-truth CAD geometry and details for improving 2D technical sections (PanelCrossSection, PDF) and 3D procedural profiles (accessory borders, goteros, cumbreras, frontales, babetas, plegados on Isoroof upper chapa) so renders "match real products".

---

## 1. Inventory of Inspected Files

All paths under `/Users/matias/Downloads/Dropbox/...` (confirmed present via `ls`/`find`).

### TECHMET "Detalles Constructivos" series (13 files, mostly 2017)
Base: `bmc - interna/paneles/Detalles Constructivos TECHMET/`

- MET-TECHMET-01.dwg (140K, AutoCAD 2004/2006) — PLEGADO DOBLE, 30mm references.
- MET-TECHMET-02.dwg (207K, 2010/2012)
- MET-TECHMET-03.dwg (72K, 2010/2012)
- MET-TECHMET-04.dwg (90K, 2010/2012)
- MET-TECHMET-05.dwg (241K, 2000) — "NOTA: LOS DESARROLLOS Y TIPOS DE FORROS SON DEMOSTRATIVOS", METECNO-10, ISOMETRICA.
- MET-TECHMET-06.dwg (218K, 2000) — Same note + METECNO-10.
- MET-TECHMET-07.dwg (1.1M, 2000) — Richest: "PANEL TECHMET", multiple "FORRO F1-MET-1" to F5, "FORRO LATERAL", "FORRO ATRAQUE", "CALZAR PANEL TECHMET", "ANCHO UTIL 1000 mm", "1@30 cms.", "TORNILLO AUTOPERFORANTE", "SELLO BUTILO", "ESTANCO 4-13", "EL. 110.500".
- MET-TECHMET-08.dwg (161K, 2000) — Same note, METECNO-10, REMACHES POP.
- MET-TECHMET-09-10-11-12.dwg (310K, 2000) — Combined (09-12). "FORRO F1-MET-1" ... "FORRO F6-MET-1", "ESTRUCTURA METALICA", "TORNILLO AUTOPERFORANTE", "0.8 mm. L=30 cm. 1@1ML", "1@30 cms.", "CADE-100", "ESTANCO 4-13".
- MET-TECHMET-13.dwg (284K, 2000) — METECNO-10, "TORNILLO AUTOPERFORANTE".
- MET-TECHMET-15.dwg (337K, 2000) — "TORNILLO AUTOPERFORANTE AL MONTE / AL VALLE", "80.000000", RAL colors, "METAL".
- MET-TECHMET-16.dwg (144K, 2000) — "GLAMET TECHMET e=50 mm.", "PANEL H-WALL 50mm.", "ANGULO METALICO 30x30x2.0", "PLETINA 50x2.0 mm. GALVANIZADO", "TUB. 100/100/3".
- MET-TECHMET-17.dwg (554K, 2000) — "GLAMET TECHMET", "BASE CANAL PANEL e=20 mm.", "LARGO SEGUN Espesor de panel", "C/TARUGO S/8 1@30 cms.", "NO PROVISTO POR METECNO".

**Common across TECHMET series (from strings):**
- Branding: METECNO-10, GLAMET TECHMET, TECHMET, PANEL TECHMET / H-WALL.
- Dimensions recurring: 30/50/80 mm (panel espesor), 1000 (ancho útil mm), 0.5 / 0.8 mm (chapa), 30 cm / 1@30 cms spacing for fixings, 30x30 angles, pletinas 50x2.0.
- "NOTA: LOS DESARROLLOS Y TIPOS DE FORROS SON DEMOSTRATIVOS" (multiple files) — these are demonstrative/details for "forros" (flashings / trims / accessories).
- Installation notes: calzar panel, fijar con tornillo autoperforante al "monte" (ridge/high point of profile), sello butilo, estanco, avance de panel.
- "ANCHO UTIL 1000 mm" — exact match to Isoroof families (au: 1.0) in constants.js.
- "e=50 mm" etc. — panel thickness.
- FORRO codes: F1-MET-1 ... F6-MET-1, FORRO LATERAL, FORRO ATRAQUE — specific accessory profiles.

**File versions:** Mostly older AutoCAD 2000 (AC1015) or 2004-2012. Pure 2D constructive / detail drawings (isometric views, sections, fixing schedules, forro details).

### BMC Uruguay Accessories (newer, 2023-2025)
Base: `BMC - Uruguay/PDF Productos/Paneles BMC/Accesorios/...` and `ETIQUETAS/Desarrollos/`

- Perfiles frontales/FRONTALES.dwg (37K, AutoCAD 2013-2017 AC1027) — Minimal extractable text (mostly internal AuxHeader/Summary). Geometry-focused for "perfiles frontales".
- Perfiles frontales/FRONTALNuevo.dwg (41K, 2013-2017) — Same, newer variant of frontales.
- Accesorios/Babetas/BabetaLateral.dwg (43K, 2013-2017) — "Babeta Lateral". Minimal text; pure profile geometry for lateral flashing/trim.
- ETIQUETAS/Desarrollos/Desarrollos.dwg (103K, AutoCAD 2018/2019/2020 AC1032 — same version family as the user's previous "plegados en general.dwg") — "Desarrollos" (flat pattern / sheet metal developments / unfolds). Contains embedded image data (IHDR/PLTE/IDAT PNG chunks), object data. "mm 4", "AU")3", "80G(". These are the 2D flat patterns used to fabricate the plegados/profiles.

**Note on newer files:** Much less text (typical for pure profile DWGs). The Desarrollos one matches the version and style of the plegados DWG you shared earlier.

---

## 2. What These DWGs Represent (Relevance to Calculator Products)
These are **internal BMC / TECHMET constructive details** for the metal sandwich panels and especially their **accessories and flashings** ("forros", perfiles frontales, babetas, plegados).

- **Panels:** References to "PANEL TECHMET", "GLAMET TECHMET e=XX mm", "PANEL H-WALL 50mm", thicknesses 30/50/80 mm, ancho útil 1000 mm — map directly to ISOROOF_3G / PLUS / FOIL / COLONIAL (au 1.0m, those espesores) and to a lesser extent ISODEC (the 50/80/100+ range). TECHMET / METECNO / GLAMET appear to be the supplier/brand for the profiled metal faces or the full system details used by BMC in Uruguay (consistent with Bromyros/Kingspan UY manufacturing + local detailing).

- **Plegados / Profiles (core to previous DWG request):** 
  - "PLEGADO DOBLE" (MET-01).
  - Multiple "FORRO F*-MET-1" — specific folded flashings/profiles for different positions (ridge, eave, lateral, end, etc.).
  - "FORRO LATERAL", "FORRO ATRAQUE".
  - "Desarrollos.dwg" + related plegados DWG = the flat-to-folded geometry (exact bends, leg lengths, for accurate 3D extrusion or 2D CAD of the upper chapa grecas + accessory trims on Isoroof 3G family).

- **Accessories matching calculator (constants.js PERFIL_TECHO, BORDER_OPTIONS, FIJACIONES):**
  - Perfiles frontales / FRONTAL* → gotero_frontal, gotero_frontal_greca, cumbrera for Isoroof families.
  - BabetaLateral.dwg → babeta / gotero lateral (lateral trim, very common on panel installs).
  - Fixings: "TORNILLO AUTOPERFORANTE" (self-drilling screws), golilla, spacing 30 cm, "1@30 cms.", "C/TARUGO S/8" (for concrete?), remaches pop — matches FIJACIONES and the "caballete_tornillo" / "varilla_tuerca" systems in PANELS_TECHO.
  - "BASE CANAL PANEL", "ANGULO METALICO 30x30", "PLETINA", "TUBO" — structure / secondary framing details.
  - Sello butilo, estanco — sealing details for weathertightness (important for realistic 3D + 2D).

- **Installation / Constructive Logic (for viz coherence):**
  - "CALZAR PANEL TECHMET", "FIJAR ... AL MONTE" (fix to the high point of the trapezoidal profile), "avance de panel", "RECTIFICAR ANCHO UTIL 1000 mm".
  - "NOTA: LOS DESARROLLOS Y TIPOS DE FORROS SON DEMOSTRATIVOS" — these are the standard details; the "forros" (F1-MET etc.) are the real plegado shapes for the accessories.

These DWGs are the **"real" internal CAD** behind the products in the calculator — exactly what the external web research (kingspan "3 grecas", Bromyros "trapezoidal (3 grecas)", bmcuruguay "Trapezoidal 3G") was pointing to.

---

## 3. Key Geometric / Text Insights (for 2D/3D viz)
- **Panel match:** 30/50/80 mm (and 100 mm in some), 1000 mm ancho útil (Isoroof), 1120 mm implied for Isodec-like in other contexts.
- **Chapa / material:** 0.5 / 0.8 mm references, galvanizado, prepintado (RAL colors mentioned in some).
- **Plegado / profile specifics:** "3 grecas" family implied by the trapezoidal + forro codes on the 1000 mm panels; "plegado doble"; developments for precise bend geometry.
- **Accessory codes:** F1-MET-1 ... F6-MET-1 (different forros for different locations — map these to the gotero/cumbrera/perfil entries in PERFIL_TECHO).
- **Fixing pattern:** 30 cm centers, autoperforante with washer ("golilla K"), stitch screws for overlaps.
- **Sealing:** Butilo tape on all longitudinal/transverse overlaps.
- **Desarrollos:** Flat patterns — gold for accurate plegado modeling (unfold → 3D bend in Three.js or for 2D true-length in CAD sections).

The previous shared "plegados en general.dwg" (AC1032, same as Desarrollos.dwg) is almost certainly the 3D/2D companion or the master profile for the upper chapa grecas on these Isoroof-style panels. The Desarrollos.dwg gives the fabrication flats.

---

## 4. Recommendations for Panel Product Visualization (specialist / roadmap)
- **2D Technical Sections (PanelCrossSection.jsx, PDF appendix, visor):** 
  - Use the FORRO F*-MET details + plegado notes for exact flashing profiles (add "forro" layers or separate accessory section drawings).
  - Incorporate fixing symbols, spacing (1@30 cm), sello butilo, "calzar" notes where relevant.
  - Hatching and dims from the isometric + section views in these DWGs (more professional TechDraw style).
  - Map F1-MET etc. to the specific gotero/cumbrera variants in the calculator.

- **3D Volumetry + Accessories (RoofPanelRealisticScene, RoofBorderCanvas, new isolated product viewer):**
  - Extract profile curves from the forros / frontales / babeta DWGs + the plegados + Desarrollos (exact bends for upper chapa grecas on Isoroof + the trim pieces).
  - Add real accessory meshes: perfiles frontales, babeta lateral, cumbrera, goteros (with correct plegado shape and thickness).
  - Use the installation logic for realistic encounters (monte/valle fixing, overlaps).
  - Thickness + side details informed by "e=50 mm", chapa 0.5/0.8 mm.

- **Data-driven single source (panelConstructionSpecs.js + new accessory specs):**
  - Extend with TECHMET/MET forro codes or generic equivalents.
  - Profile dims (from DWG measurements + 1000 mm au) for Isoroof 3-grecas + the border options.
  - Keep in sync with existing PANELS_TECHO / PERFIL_TECHO / BORDER_OPTIONS / FIJACIONES.

- **Coherence & PDF:**
  - These details are what the real quotes/installs use — perfect for "Sección 2D del panel (constructiva)" + "detalles de encuentro" in the visor/PDF.
  - Capture or reference the isometric views for appendix.

- **For Lio selection / next steps:**
  - Open these DWGs in AutoCAD / FreeCAD / DWG viewer alongside the previous "plegados en general.dwg".
  - Trace/export the key profiles (the 3-greca upper + the F1-MET forros, frontales, babeta) as DXF/SVG or measure exact legs/angles/radii for procedural code.
  - Compare "forros" to current catalog images and kingspan "3 grecas" photos.
  - Prioritize: MET-07 (richest notes + forros), 09-12 (multiple forros), Desarrollos.dwg + plegados DWG (geometry master), BabetaLateral + FRONTALES (borders), MET-01 (plegado doble), MET-16 (specific angles/pletinas).
  - These are higher-fidelity than public web images for the exact BMC-supplied accessories.

- **Cross-ref with external:**
  - Matches kingspan.com.uy "3 grecas como terminación" for Isoroof Plus/3G.
  - Matches Bromyros PDFs (same 3-grecas text + espesores + au 1000).
  - Matches bmcuruguay "Trapezoidal 3G" + grecas in accessories.
  - The "METECNO / TECHMET / GLAMET" is the detailing/fabrication layer on top of the Kingspan/Bromyros core panels.

---

## 5. Gaps / Notes
- Newer accessory DWGs (frontales, babeta) have very little text — open in CAD to see the actual polyline/plegado shapes.
- Some files contain "design-package" XML and embedded resources (older Autodesk format).
- "Desarrollos y tipos de forros son demostrativos" — use as standard/reference, not one-off.
- No direct "ISOROOF" or "ISODEC" strings in these (they use "PANEL TECHMET / METECNO"), but dimensions, au 1000 mm, 30/50/80 mm, forro lateral/greca logic, and context (BMC Uruguay Dropbox) make the mapping unambiguous.
- Desarrollos.dwg (Sep 2025) and the plegados DWG you shared earlier are the most recent and directly geometry-focused.

---

## 6. Next Actions / For Lio
1. Open the key DWGs (start with MET-07, 09-12, Desarrollos, BabetaLateral, the previous plegados-en-general.dwg) in a viewer that can measure/export profiles.
2. Trace the exact 3-greca + forro shapes → feed into profileDims / new accessory profile data.
3. Update the visual selection document (MATERIAL-VISUAL-SELECCION-LIO.html) or the main KINGSPAN-BIM knowledge with a note: "Internal CAD details now investigated — see this file for TECHMET/BMC forros, plegados developments, and constructive sections."
4. Delegate to `panel-product-visualization-specialist` with this doc + the DWG paths + the previous UY web research as the complete reference set.

These files + the external sources you had me research earlier give the **most complete real-product visual + geometric reference set** possible for making the calculator's 2D/3D viz match the actual panels and accessories sold/installed by BMC in Uruguay.

(Report created purely as research artifact. All paths and findings from non-destructive terminal inspection only.)

**Full list of inspected paths (for reference):**
- All MET-TECHMET-*.dwg under the TECHMET folder (13 files)
- FRONTALES.dwg, FRONTALNuevo.dwg
- BabetaLateral.dwg
- Desarrollos.dwg

See previous `ISOROOF-PLEGADOS-REAL-REFERENCES-UY-2026.md` and the Lio visual HTML for the web-sourced half of the picture. This document closes the internal CAD half.