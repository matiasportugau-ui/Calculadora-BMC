/**
 * Slope / width input modes that change billed largo and panel count.
 * Run: node tests/calcMeasureModes.test.js
 *
 * calcLargoRealFromModo and normalizarMedida had no dedicated tests on tip.
 * A silent mode mix-up (incluye_pendiente vs calcular_altura vs grados)
 * changes m² and USD on every techo quote.
 */
import {
  calcFactorPendiente,
  calcLargoReal,
  calcLargoRealFromModo,
  normalizarMedida,
} from "../src/utils/calculations.js";

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
function approx(a, b, tol = 1e-3) {
  return Math.abs(a - b) <= tol;
}

const auPanel = { au: 1.12 };

console.log("calcMeasureModes");

assert(calcLargoRealFromModo(10, "incluye_pendiente", 25, 4) === 10, "incluye_pendiente ignores slope + altura");
assert(
  calcLargoRealFromModo(3, "calcular_altura", 0, 4) === 5,
  "calcular_altura 3-4-5 → 5.000",
);
assert(
  calcLargoRealFromModo(10, "calcular_altura", 15, 0) === calcLargoReal(10, 15),
  "calcular_altura with alturaDif 0 falls back to slope",
);
assert(
  approx(calcLargoRealFromModo(10, "grados", 15), 10.353, 0.01),
  "grados 15° ≈ 10.353",
);
assert(
  calcLargoRealFromModo(10, "grados", -15) === calcLargoRealFromModo(10, "grados", 15),
  "negative slope uses abs",
);
assert(
  calcFactorPendiente(90) === calcFactorPendiente(89),
  "pendiente ≥89° clamps to 89",
);
assert(calcLargoReal(10, 0) === 10, "0° largo real = proyectado");

const byPanels = normalizarMedida("paneles", 2.1, auPanel);
assert(byPanels.cantPaneles === 3, "modo paneles 2.1 → ceil 3");
assert(approx(byPanels.ancho, 3.36, 1e-6), "modo paneles ancho = N × au");

const minOne = normalizarMedida("paneles", 0, auPanel);
assert(minOne.cantPaneles === 1 && approx(minOne.ancho, 1.12, 1e-6), "modo paneles 0 → 1 panel");

const byMeters = normalizarMedida("metros", 3.36, auPanel);
assert(byMeters.cantPaneles === 3, "modo metros 3.36/1.12 → 3");
assert(byMeters.ancho === 3.36, "modo metros keeps requested ancho (not N×au)");

const over = normalizarMedida("metros", 3.3601, auPanel);
assert(over.cantPaneles === 4 && over.ancho === 3.3601, "modo metros 3.3601 → 4, ancho stays input");

console.log(`\ncalcMeasureModes: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
