/**
 * Plano 2D ↔ BOM: buildPanelLayout goldens + verifyPanelLayout vs calcPanelesTecho.
 * Run: node tests/panelLayoutVerification.test.js
 *
 * Pins the IEEE-754 exact-multiple path (3.36 / 1.12) and cut-strip waste so a
 * future countPanels / layout change cannot silently add a panel or bill a
 * full rectangle while the drawing shows a cut.
 */
import { buildPanelLayout } from "../src/utils/panelLayout.js";
import { verifyPanelLayout } from "../src/utils/panelLayoutVerification.js";
import { countPanels } from "../src/utils/roofPanelStripsPlanta.js";
import {
  calcPanelesTecho,
  calcPanelesTechoFromOptionalIrregular,
} from "../src/utils/calculations.js";
import { PANELS_TECHO } from "../src/data/constants.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const AU = 1.12;
const panel = { au: AU };
const isodec = PANELS_TECHO.ISODEC_EPS;

console.log("panelLayoutVerification");

assert(countPanels(3.36, AU) === 3, "countPanels exact 3.36/1.12 = 3");
assert(countPanels(3.3601, AU) === 4, "countPanels 3.3601/1.12 = 4");
assert(countPanels(0, AU) === 0, "countPanels ancho 0 → 0");
assert(countPanels(5.6, 0) === 0, "countPanels au 0 → 0");

const exact5 = buildPanelLayout({ panel, largo: 6, ancho: 5.6 });
assert(exact5.totalPanels === 5 && exact5.fullPanels === 5 && exact5.cutPanels === 0, "5.6m → 5 full, no cut");
assert(Math.abs(exact5.wasteM) < 1e-6, "5.6m waste ≈ 0");

const exact3 = buildPanelLayout({ panel, largo: 6, ancho: 3.36 });
assert(exact3.totalPanels === 3 && exact3.cutPanels === 0, "3.36m IEEE-754 → 3 full");
assert(Math.abs(exact3.wasteM) < 1e-6, "3.36m waste ≈ 0");
assert(exact3.panels.every((p) => p.id.startsWith("T-")), "strip ids T-01…");

const cut8 = buildPanelLayout({ panel, largo: 6, ancho: 8.36 });
assert(cut8.totalPanels === 8 && cut8.fullPanels === 7 && cut8.cutPanels === 1, "8.36m → 7 full + 1 cut");
const last = cut8.panels[cut8.panels.length - 1];
assert(last?.isCut === true && Math.abs(last.width - 0.52) < 1e-6, "last strip 0.52 m ✂");
assert(Math.abs(cut8.wasteM - 0.60) < 1e-6, "8.36m waste 0.60 m");

const cut4 = buildPanelLayout({ panel: { au: 1 }, largo: 4, ancho: 3.5 });
assert(cut4.totalPanels === 4 && cut4.cutPanels === 1, "au 1.0 / 3.5m → 4 with cut");
assert(Math.abs(cut4.panels[3].width - 0.5) < 1e-9, "last strip 0.5 m");

const empty = buildPanelLayout({ panel, largo: 6, ancho: 0 });
assert(empty.totalPanels === 0 && empty.panels.length === 0, "ancho 0 → empty layout");
assert(buildPanelLayout({ panel: { au: 0 }, largo: 6, ancho: 5.6 }).totalPanels === 0, "au 0 → empty layout");

const bomExact = calcPanelesTecho(isodec, 100, 6, 3.36);
assert(bomExact?.cantPaneles === 3, "calcPanelesTecho 3.36m → 3");
const vExact = verifyPanelLayout(exact3, bomExact, 6);
assert(vExact.ok && vExact.panelCountMatch && vExact.areaMatch, "plano↔BOM match on exact multiple");

const bomCut = calcPanelesTecho(isodec, 100, 6, 8.36);
assert(bomCut?.cantPaneles === 8, "calcPanelesTecho 8.36m → 8 (bills full au)");
const vCut = verifyPanelLayout(cut8, bomCut, 6);
assert(vCut.ok && vCut.panelCountMatch, "cut strip still matches BOM count");
assert(Math.abs(bomCut.descarte.anchoM - 0.6) < 1e-6, "BOM descarte ancho 0.60 m");

const mismatch = verifyPanelLayout(exact3, { ...bomExact, cantPaneles: 4 }, 6);
assert(mismatch.ok === false && mismatch.panelCountMatch === false, "wrong BOM count fails verify");
assert(verifyPanelLayout(null, bomExact, 6).ok === false, "missing layout → not ok");

const rectFallback = calcPanelesTechoFromOptionalIrregular(isodec, 100, 6, 3.36, { strips: [] });
assert(rectFallback?.cantPaneles === 3 && !rectFallback.irregular, "empty irregular strips → rectangle BOM");
const noArea = calcPanelesTechoFromOptionalIrregular(isodec, 100, 6, 3.36, {
  strips: [{ width: 1.12 }],
  totals: { areaOrdered: 0 },
});
assert(noArea?.cantPaneles === 3 && !noArea.irregular, "areaOrdered 0 → rectangle BOM");

console.log(`\npanelLayoutVerification: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
