// server/lib/matrizRowSelection.js
// Regression guards for duplicated supplier SKUs in the MATRIZ.

import {
  extractMatrizPathEspesor,
  rowDescriptionMatchesEspesor,
  selectMatrizRowForPath,
} from "../server/lib/matrizRowSelection.js";

let passed = 0;
let failed = 0;

function assert(name, condition, actual = "", expected = "") {
  if (condition) {
    passed += 1;
    console.log(`  OK ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`);
    if (actual !== "" || expected !== "") {
      console.error(`     actual:   ${actual}`);
      console.error(`     expected: ${expected}`);
    }
  }
}

console.log("\n═══ MATRIZ row selection ═══");

assert(
  "extracts numeric thickness suffix",
  extractMatrizPathEspesor("PERFIL_PARED.perfil_u.ISOPANEL.50") === "50",
  extractMatrizPathEspesor("PERFIL_PARED.perfil_u.ISOPANEL.50"),
  "50",
);
assert(
  "does not extract _all as thickness",
  extractMatrizPathEspesor("PERFIL_TECHO.cumbrera.ISODEC._all") === null,
  extractMatrizPathEspesor("PERFIL_TECHO.cumbrera.ISODEC._all"),
  "null",
);
assert(
  "matches description thickness with optional space",
  rowDescriptionMatchesEspesor(["PU50MM", "Perfil Ch. Blanco U 50 mm x 35 mm"], 1, "50"),
  "match",
  "match",
);

const pu50Group = [
  { row: ["PU50MM", "Perfil Ch. Blanco U 40 mm x 35 mm"], rowIndex: 10 },
  { row: ["PU50MM", "Perfil Ch. Blanco U 50 mm x 35 mm / 3 m"], rowIndex: 11 },
  { row: ["PU50MM", "Perfil Ch. Blanco U 60 mm x 35 mm"], rowIndex: 12 },
  { row: ["PU50MM", "Perfil Ch. Blanco U 80 mm x 35 mm ISOWALL"], rowIndex: 13 },
];
const selectedPu50 = selectMatrizRowForPath(
  pu50Group,
  "PERFIL_PARED.perfil_u.ISOPANEL.50",
  1,
);
assert(
  "selects matching 50mm row instead of last duplicate",
  selectedPu50?.rowIndex === 11,
  selectedPu50?.rowIndex,
  11,
);

const gfs80Group = [
  ["GFS80", "Gotero Frontal Simple 80mm Prep."],
  ["GFS80", "Gotero Frontal Simple 100mm Prep."],
];
const selectedGfs80 = selectMatrizRowForPath(
  gfs80Group,
  "PERFIL_TECHO.gotero_frontal.ISOROOF.80",
  1,
);
assert(
  "supports bare row arrays",
  selectedGfs80?.row?.[1] === "Gotero Frontal Simple 80mm Prep.",
  selectedGfs80?.row?.[1],
  "Gotero Frontal Simple 80mm Prep.",
);

const noThicknessGroup = [
  { row: ["CUM", "Cumbrera A"], rowIndex: 2 },
  { row: ["CUM", "Cumbrera B"], rowIndex: 3 },
];
const selectedNoThickness = selectMatrizRowForPath(
  noThicknessGroup,
  "PERFIL_TECHO.cumbrera.ISODEC._all",
  1,
);
assert(
  "falls back to first row when path has no thickness",
  selectedNoThickness?.rowIndex === 2,
  selectedNoThickness?.rowIndex,
  2,
);

if (failed > 0) {
  console.error(`\n${failed} matriz row selection assertion(s) failed`);
  process.exit(1);
}

console.log(`\nmatriz row selection assertions passed: ${passed}`);
