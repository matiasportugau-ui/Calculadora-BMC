// ============================================================================
// MATRIZ pricing contract regression tests
// Run: node tests/matriz-pricing-contract.test.js
// ============================================================================

import { __test__ as matrizPricing } from "../server/routes/bmcDashboard.js";
import { colIndexToLetter } from "../server/lib/sheetColumnLetters.js";
import { splitCsvRowSafe } from "../server/lib/matrizCsvNormalization.js";
import { getPathForMatrizSku, normalizeSku } from "../src/data/matrizPreciosMapping.js";

let passed = 0;
let failed = 0;

function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  OK ${name}`);
    passed += 1;
    return;
  }
  console.log(`  FAIL ${name} - got: ${actual}, expected: ${expected}`);
  failed += 1;
}

function assertEqual(name, actual, expected) {
  assert(name, actual === expected, actual, expected);
}

function assertDeepEqual(name, actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(name, actualJson === expectedJson, actualJson, expectedJson);
}

function makeBromyrosRow({ sku = "IROOF40" } = {}) {
  const row = [];
  row[3] = sku; // D
  row[4] = 'Isoroof "3G", 40 mm'; // E
  row[5] = "1.025,50"; // F costo
  row[11] = "123.45"; // L venta local
  row[12] = "150,61"; // M ref c/IVA
  row[19] = "130"; // T venta web
  row[20] = "158,60"; // U venta web c/IVA
  return row;
}

console.log("\n=== API SUITE: MATRIZ Pricing Contract ===");

const bromyros = matrizPricing.MATRIZ_TAB_COLUMNS.BROMYROS;

assertEqual("BROMYROS SKU reads column D", bromyros.sku, 3);
assertEqual("BROMYROS costo reads column F", bromyros.costo, 5);
assertEqual("BROMYROS venta local reads column L", bromyros.ventaLocal, 11);
assertEqual("BROMYROS venta local c/IVA reads column M", bromyros.ventaIvaInc, 12);
assertEqual("BROMYROS venta web reads column T", bromyros.web, 19);
assertEqual("BROMYROS venta web c/IVA reads column U", bromyros.webIvaInc, 20);
assertEqual("BROMYROS venta column remains L, not M", colIndexToLetter(bromyros.ventaLocal), "L");

assertEqual("normalizeSku trims, uppercases, strips spaces and hyphens", normalizeSku(" iagro-40 col "), "IAGRO40COL");
assertEqual(
  "ISOROOF Colonial canonical SKU maps to the colonial panel path",
  getPathForMatrizSku("ISOCOL40"),
  "PANELS_TECHO.ISOROOF_COLONIAL.esp.40",
);
assertEqual(
  "ISOROOF Colonial historical alias maps to the same path",
  getPathForMatrizSku(" iagro-40 col "),
  "PANELS_TECHO.ISOROOF_COLONIAL.esp.40",
);
assertEqual(
  "ISOROOF 3G SKU maps to the 3G panel path",
  getPathForMatrizSku("IROOF40"),
  "PANELS_TECHO.ISOROOF_3G.esp.40",
);
assertEqual("Unknown MATRIZ SKU is ignored by importer", getPathForMatrizSku("NO-EXISTE-2026"), undefined);

const csvRow = matrizPricing.buildMatrizCsvRowFromSheetRow(
  makeBromyrosRow(),
  bromyros,
  "BROMYROS",
  getPathForMatrizSku,
);
const csvCells = splitCsvRowSafe(csvRow);

assertDeepEqual(
  "MATRIZ row serializes to the canonical CSV header contract",
  matrizPricing.MATRIZ_CSV_HEADER,
  ["sku", "path", "descripcion", "categoria", "costo", "venta_local", "venta_local_iva_inc", "venta_web", "venta_web_iva_inc", "unidad", "tab"],
);
assertEqual("CSV preserves SKU from column D", csvCells[0], "IROOF40");
assertEqual("CSV resolves calculator path from SKU", csvCells[1], "PANELS_TECHO.ISOROOF_3G.esp.40");
assertEqual("CSV preserves quoted/comma description", csvCells[2], 'Isoroof "3G", 40 mm');
assertEqual("CSV copies F costo without IVA math", csvCells[4], "1025.5");
assertEqual("CSV copies L venta_local without using M", csvCells[5], "123.45");
assertEqual("CSV copies M venta_local_iva_inc as reference only", csvCells[6], "150.61");
assertEqual("CSV copies T venta_web without IVA math", csvCells[7], "130");
assertEqual("CSV copies U venta_web_iva_inc as reference only", csvCells[8], "158.6");
assertEqual("Unknown SKU row returns null", matrizPricing.buildMatrizCsvRowFromSheetRow(makeBromyrosRow({ sku: "DESCONOCIDO" }), bromyros, "BROMYROS", getPathForMatrizSku), null);

const overridePath = "PANELS_TECHO.ISOROOF_3G.esp.40";
const byPath = matrizPricing.normalizeMatrizPricingOverrides({
  [`${overridePath}.costo`]: "44,20",
  [`${overridePath}.venta`]: 55.678,
  [`${overridePath}.web`]: "66",
  [`${overridePath}.webIvaInc`]: 80.52,
  [`${overridePath}.venta_local_iva_inc`]: 999,
  [`${overridePath}.webIvaInc.ignored`]: 1000,
  [`${overridePath}.costoNegativo`]: -10,
});
const plan = matrizPricing.planMatrizPricingOverridesForRows(
  "BROMYROS",
  bromyros,
  [makeBromyrosRow(), makeBromyrosRow({ sku: "NO-EXISTE-2026" })],
  byPath,
  getPathForMatrizSku,
);

assertEqual("Override planner matches one MATRIZ row", plan.planned.length, 1);
assertDeepEqual("Override planner writes costo/venta/web/webIvaInc to F/L/T/U only", plan.planned[0]?.cells, {
  F: 44.2,
  L: 55.68,
  T: 66,
  U: 80.52,
});
assert(
  "Override planner never writes M when applying venta",
  !Object.prototype.hasOwnProperty.call(plan.planned[0]?.cells || {}, "M"),
  JSON.stringify(plan.planned[0]?.cells),
  "no M key",
);
assertEqual("Override planner preserves 1-based sheet row number", plan.planned[0]?.row, 2);
assertEqual("Override planner reports matched calc path", plan.matchedPaths.has(overridePath), true);

console.log(`\n${"=".repeat(60)}`);
console.log(`MATRIZ pricing contract tests - passed: ${passed}, failed: ${failed}`);
console.log("=".repeat(60));
if (failed > 0) process.exit(1);
