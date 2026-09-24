// Offline pins for src/utils/librePanelDimensions.js — presupuesto libre quantities.
// Run: node tests/librePanelMetricGates.test.js
//
// Billing rounds width up to whole panels and multiplies by useful width.
// Calculator suites still pass if that rounds down or bills the typed metres.

import {
  computeLibrePanelLineMetrics,
  defaultLibrePanelLine,
  formatLibrePanelBomLabel,
  normalizeLibrePanelLine,
  resolveLibrePanelCatalogEntry,
} from "../src/utils/librePanelDimensions.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

const CATALOG = {
  PANELS_TECHO: {
    ROOF: { au: 1.14, esp: { 50: { venta: 10, costo: 8 } } },
    SHARED: { au: 1, esp: { 40: { venta: 1 } } },
  },
  PANELS_PARED: {
    WALL: { au: 1, esp: { 80: { venta: 20 } } },
    SHARED: { au: 9, esp: { 40: { venta: 2 } } },
  },
};

group("catalog resolution", () => {
  const roof = resolveLibrePanelCatalogEntry("ROOF", "50", CATALOG);
  assert(roof && roof.au === 1.14 && roof.espNum === 50 && roof.espData.costo === 8, "string espesor hits the roof catalog");
  const wall = resolveLibrePanelCatalogEntry("WALL", 80, CATALOG);
  assert(wall && wall.au === 1 && wall.panel.esp[80].venta === 20, "pared family resolves when it is not on the roof list");
  const shared = resolveLibrePanelCatalogEntry("SHARED", 40, CATALOG);
  assert(shared && shared.au === 9, "a family present on both lists uses the pared entry");
  assert(resolveLibrePanelCatalogEntry("NOPE", 50, CATALOG) === null, "unknown family → null");
  assert(resolveLibrePanelCatalogEntry("ROOF", 999, CATALOG) === null, "unknown espesor → null");
  assert(resolveLibrePanelCatalogEntry("ROOF", "", CATALOG) === null, "blank espesor does not match esp 50");
});

group("m2 mode does not invent panels", () => {
  const direct = computeLibrePanelLineMetrics(
    { inputModo: "m2", m2: "12.5", familia: "ROOF", espesor: 50, tramos: [{ largo: 9 }], panelesAncho: 4 },
    CATALOG,
  );
  assert(direct.mode === "m2" && direct.m2 === 12.5 && direct.totalPaneles === null && direct.tramosDetail.length === 0, "explicit m² ignores dimensions");
  const missing = computeLibrePanelLineMetrics({ m2: 4, tramos: [{ largo: 8 }] }, CATALOG);
  assert(missing.mode === "m2" && missing.m2 === 4, "missing inputModo stays on m²");
  const odd = computeLibrePanelLineMetrics({ inputModo: "DIMENSIONES", m2: 3 }, CATALOG);
  assert(odd.mode === "m2" && odd.m2 === 3, "inputModo match is case-sensitive");
  const negative = computeLibrePanelLineMetrics({ inputModo: "m2", m2: -3 }, CATALOG);
  assert(negative.m2 === -3, "negative m² is kept");
  const blank = computeLibrePanelLineMetrics({ inputModo: "m2", m2: "" }, CATALOG);
  assert(blank.m2 === 0, "blank m² → 0");
});

group("dimensiones bill whole panels", () => {
  const line = computeLibrePanelLineMetrics({
    inputModo: "dimensiones",
    familia: "ROOF",
    espesor: 50,
    anchoModo: "paneles",
    panelesAncho: 2.1,
    tramos: [{ largo: 3.5 }, { largo: 0 }, { largo: -1 }, { largo: "2" }],
  }, CATALOG);
  assert(line.panelesAncho === 3 && line.anchoM === 3.42 && line.au === 1.14, "fractional panel count rounds up");
  assert(line.tramosDetail.length === 2, "non-positive largos are skipped");
  assert(line.tramosDetail[0].areaM2 === 11.97 && line.tramosDetail[0].largo === 3.5, "area is panels × largo × au");
  assert(line.tramosDetail[1].cantPaneles === 3 && line.tramosDetail[1].areaM2 === 6.84, "string largo is numeric");
  assert(line.m2 === 18.81 && line.totalPaneles === 6, "m² and panel count sum only the kept tramos");

  const one = computeLibrePanelLineMetrics({
    inputModo: "dimensiones",
    familia: "ROOF",
    espesor: 50,
    panelesAncho: 0,
    tramos: [{ largo: 4 }],
  }, CATALOG);
  assert(one.panelesAncho === 1 && one.m2 === 4.56, "zero panel count still bills one panel");

  const metres = computeLibrePanelLineMetrics({
    inputModo: "dimensiones",
    familia: "WALL",
    espesor: 80,
    anchoModo: "metros",
    anchoM: 2.2,
    tramos: [{ largo: 5 }],
  }, CATALOG);
  assert(metres.panelesAncho === 3 && metres.anchoM === 2.2 && metres.m2 === 15, "typed metres round up to whole panels and bill au, not the typed width");

  const unknown = computeLibrePanelLineMetrics({
    inputModo: "dimensiones",
    familia: "NOPE",
    espesor: 50,
    panelesAncho: 4,
    tramos: [{ largo: 6 }],
  }, CATALOG);
  assert(unknown.m2 === 0 && unknown.totalPaneles === 0 && unknown.au === null, "unknown family bills nothing");

  const noLargo = computeLibrePanelLineMetrics({
    inputModo: "dimensiones",
    familia: "WALL",
    espesor: 80,
    tramos: [{ largo: 0 }],
  }, CATALOG);
  assert(noLargo.m2 === 0 && noLargo.totalPaneles === null && noLargo.tramosDetail.length === 0, "skipped tramos leave totalPaneles null");
});

group("labels and legacy normalize", () => {
  const one = { tramosDetail: [{ cantPaneles: 3, largo: 3.5 }], totalPaneles: 3 };
  assert(
    formatLibrePanelBomLabel({}, one, "ISOROOF 50") === "ISOROOF 50 · 3 paneles × 3.50 m",
    "single tramo label",
  );
  const many = {
    tramosDetail: [{ cantPaneles: 3, largo: 3.5 }, { cantPaneles: 3, largo: 2 }],
    totalPaneles: 6,
  };
  assert(
    formatLibrePanelBomLabel({}, many, "ISOROOF 50") === "ISOROOF 50 · 3×3.50 m + 3×2.00 m (6 paneles)",
    "multi tramo label",
  );
  assert(formatLibrePanelBomLabel({}, { tramosDetail: [] }, "Base") === "Base", "no tramos → base label");

  const fresh = normalizeLibrePanelLine(null);
  assert(fresh.inputModo === "dimensiones" && fresh.tramos.length === 1 && fresh.tramos[0].largo === 6, "null line is a 6 m dimension line, not legacy m²");
  assert(fresh.familia === "" && fresh.panelesAncho === defaultLibrePanelLine().panelesAncho, "default keeps nine panels of width");

  const legacy = normalizeLibrePanelLine({ m2: 10, nota: "vieja" });
  assert(legacy.inputModo === "m2" && legacy.m2 === 10 && legacy.nota === "vieja", "legacy m² line keeps extra fields");
  assert(legacy.tramos[0].largo === 6, "missing tramos become the default tramo");

  const dims = normalizeLibrePanelLine({
    inputModo: "dimensiones",
    anchoModo: "metros",
    tramos: [{ largo: "3.5" }, { largo: null }, "nope"],
  });
  assert(dims.inputModo === "dimensiones" && dims.anchoModo === "metros", "dimensiones and metros survive");
  assert(dims.tramos[0].largo === 3.5 && dims.tramos[1].largo === 0 && dims.tramos[2].largo === 0, "bad tramo largos become 0");
  assert(normalizeLibrePanelLine({ inputModo: "dimensiones", tramos: [] }).tramos[0].largo === 6, "empty tramos reset to 6 m");
  assert(normalizeLibrePanelLine({ anchoModo: "METROS" }).anchoModo === "paneles", "anchoModo match is case-sensitive");
});

console.log(`\nlibrePanelMetricGates: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
