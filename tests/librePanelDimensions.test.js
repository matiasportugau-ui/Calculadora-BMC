/**
 * Presupuesto-libre panel metrics → BOM m² / cantPaneles.
 * Run: node tests/librePanelDimensions.test.js
 *
 * Pins the #1038 catalog path: dimensiones vs m², unknown familia, multi-tramo
 * labels, and engine billing (m² × lista). Complementary to libreExtras.test.js
 * (extraordinarios) and flattenPerfilesLibre coverage on open #1049.
 */
import {
  computeLibrePanelLineMetrics,
  formatLibrePanelBomLabel,
  normalizeLibrePanelLine,
  resolveLibrePanelCatalogEntry,
  defaultLibrePanelLine,
} from "../src/utils/librePanelDimensions.js";
import { computePresupuestoLibreCatalogo } from "../src/utils/presupuestoLibreCatalogo.js";
import { setListaPrecios, p, PANELS_TECHO } from "../src/data/constants.js";

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

const AU = PANELS_TECHO.ISODEC_EPS.au;
const PU_100 = p(PANELS_TECHO.ISODEC_EPS.esp[100]);

console.log("\n— resolveLibrePanelCatalogEntry");
assert(resolveLibrePanelCatalogEntry("NOPE", 100) === null, "unknown familia → null");
assert(resolveLibrePanelCatalogEntry("ISODEC_EPS", 999) === null, "unknown espesor → null");
const entry = resolveLibrePanelCatalogEntry("ISODEC_EPS", 100);
assert(entry && entry.au === AU && entry.espNum === 100, "ISODEC EPS 100 resolves au + esp");
assert(resolveLibrePanelCatalogEntry("ISODEC_EPS", "100")?.espNum === 100, "espesor string '100' matches");

console.log("\n— computeLibrePanelLineMetrics: m² mode");
const m2Only = computeLibrePanelLineMetrics({
  familia: "ISODEC_EPS",
  espesor: 100,
  inputModo: "m2",
  m2: 42.5,
  tramos: [{ largo: 6 }],
});
assert(m2Only.mode === "m2" && m2Only.m2 === 42.5 && m2Only.totalPaneles === null, "m² mode ignores tramos");
assert(
  computeLibrePanelLineMetrics({ m2: "12.25" }).m2 === 12.25,
  "m² coerces numeric string",
);
assert(
  computeLibrePanelLineMetrics({ familia: "ISODEC_EPS", espesor: 100, tramos: [{ largo: 6 }] }).mode === "m2",
  "missing inputModo defaults to m² (does not silently bill tramos)",
);

console.log("\n— computeLibrePanelLineMetrics: dimensiones / paneles");
const dim9x6 = computeLibrePanelLineMetrics({
  familia: "ISODEC_EPS",
  espesor: 100,
  inputModo: "dimensiones",
  anchoModo: "paneles",
  panelesAncho: 9,
  tramos: [{ largo: 6 }],
});
assert(dim9x6.mode === "dimensiones", "dimensiones mode");
assert(dim9x6.m2 === +(9 * 6 * AU).toFixed(2), `9×6×${AU} m² = ${+(9 * 6 * AU).toFixed(2)}`);
assert(dim9x6.totalPaneles === 9, "single tramo: totalPaneles = panelesAncho");
assert(dim9x6.anchoM === +(9 * AU).toFixed(2), "anchoM = paneles × au");

const dimZeroAncho = computeLibrePanelLineMetrics({
  familia: "ISODEC_EPS",
  espesor: 100,
  inputModo: "dimensiones",
  anchoModo: "paneles",
  panelesAncho: 0,
  tramos: [{ largo: 6 }],
});
assert(dimZeroAncho.totalPaneles === 1, "panelesAncho 0/empty floors to 1 (no silent zero bill)");

const dimUnknown = computeLibrePanelLineMetrics({
  familia: "NOPE",
  espesor: 100,
  inputModo: "dimensiones",
  panelesAncho: 9,
  tramos: [{ largo: 6 }],
});
assert(dimUnknown.m2 === 0 && dimUnknown.totalPaneles === 0, "unknown familia in dimensiones → 0 m²");

console.log("\n— computeLibrePanelLineMetrics: multi-tramo + skip empty");
const multi = computeLibrePanelLineMetrics({
  familia: "ISODEC_EPS",
  espesor: 100,
  inputModo: "dimensiones",
  anchoModo: "paneles",
  panelesAncho: 9,
  tramos: [{ largo: 6 }, { largo: 0 }, { largo: 4 }, { largo: -2 }],
});
assert(multi.tramosDetail.length === 2, "zero/negative largo skipped");
assert(multi.m2 === +(9 * 6 * AU + 9 * 4 * AU).toFixed(2), "multi-tramo m² sums both cuts");
assert(multi.totalPaneles === 18, "multi-tramo totalPaneles = 9+9");

console.log("\n— computeLibrePanelLineMetrics: ancho metros");
const metros = computeLibrePanelLineMetrics({
  familia: "ISODEC_EPS",
  espesor: 100,
  inputModo: "dimensiones",
  anchoModo: "metros",
  anchoM: 2.0,
  tramos: [{ largo: 6 }],
});
const expectedPanelesMetros = Math.ceil(2.0 / AU);
assert(metros.totalPaneles === expectedPanelesMetros, `ancho 2.0 m → ceil(2/${AU}) = ${expectedPanelesMetros} paneles`);
assert(metros.m2 === +(expectedPanelesMetros * 6 * AU).toFixed(2), "metros mode bills ceil(ancho/au) × L × au");

console.log("\n— formatLibrePanelBomLabel");
assert(formatLibrePanelBomLabel({}, { tramosDetail: [] }, "ISODEC EPS 100mm") === "ISODEC EPS 100mm", "no tramos → base");
assert(
  formatLibrePanelBomLabel({}, dim9x6, "ISODEC EPS 100mm") === "ISODEC EPS 100mm · 9 paneles × 6.00 m",
  "single tramo label",
);
assert(
  formatLibrePanelBomLabel({}, multi, "ISODEC EPS 100mm") === "ISODEC EPS 100mm · 9×6.00 m + 9×4.00 m (18 paneles)",
  "multi-tramo label lists both cuts + total paneles",
);

console.log("\n— normalizeLibrePanelLine");
const normNull = normalizeLibrePanelLine(null);
assert(normNull.inputModo === "dimensiones" && normNull.familia === "", "null → factory default (dimensiones, empty familia)");
const normLegacy = normalizeLibrePanelLine({ familia: "ISODEC_EPS", espesor: 100, m2: 10 });
assert(normLegacy.inputModo === "m2" && normLegacy.m2 === 10, "legacy m²-only line stays m²");
const normEmptyTramos = normalizeLibrePanelLine({
  familia: "ISODEC_EPS",
  espesor: 100,
  inputModo: "dimensiones",
  tramos: [],
});
assert(normEmptyTramos.tramos.length === 1 && normEmptyTramos.tramos[0].largo === 6, "empty tramos → default 6 m");
const factory = defaultLibrePanelLine();
assert(factory.inputModo === "dimensiones" && factory.tramos[0].largo === 6, "factory default is dimensiones + 6 m tramo");

console.log("\n— engine billing (presupuesto-libre PANELES)");
setListaPrecios("web");
const billed = computePresupuestoLibreCatalogo({
  listaPrecios: "web",
  librePanelLines: [{
    familia: "ISODEC_EPS",
    espesor: 100,
    color: "Blanco",
    inputModo: "dimensiones",
    anchoModo: "paneles",
    panelesAncho: 9,
    tramos: [{ largo: 6 }],
  }],
});
const panelItem = billed.libreGroups.find((g) => g.title === "PANELES")?.items[0];
const expectedM2 = +(9 * 6 * AU).toFixed(2);
const expectedTotal = +(expectedM2 * PU_100).toFixed(2);
assert(panelItem && panelItem.cant === expectedM2, `engine cant = ${expectedM2} m²`);
assert(panelItem && panelItem.cantPaneles === 9, "engine exposes cantPaneles");
assert(panelItem && panelItem.total === expectedTotal, `engine total = ${expectedM2} × ${PU_100} = ${expectedTotal}`);
assert(String(panelItem?.label || "").includes("9 paneles × 6.00 m"), "engine BOM label includes cut");

const skipUnknown = computePresupuestoLibreCatalogo({
  listaPrecios: "web",
  librePanelLines: [{
    familia: "NOPE",
    espesor: 100,
    inputModo: "dimensiones",
    panelesAncho: 9,
    tramos: [{ largo: 6 }],
  }],
});
const skipItems = skipUnknown.libreGroups.find((g) => g.title === "PANELES")?.items || [];
assert(skipItems.length === 0, "unknown familia is not billed");

const skipM2Default = computePresupuestoLibreCatalogo({
  listaPrecios: "web",
  librePanelLines: [{
    familia: "ISODEC_EPS",
    espesor: 100,
    // no inputModo — must not bill the 6 m tramo as if dimensiones
    tramos: [{ largo: 6 }],
    panelesAncho: 9,
    m2: 0,
  }],
});
const skipM2Items = skipM2Default.libreGroups.find((g) => g.title === "PANELES")?.items || [];
assert(skipM2Items.length === 0, "missing inputModo + m2=0 does not bill tramos");

console.log(`\nlibrePanelDimensions: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
