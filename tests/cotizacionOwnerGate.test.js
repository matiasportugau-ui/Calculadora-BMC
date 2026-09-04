/**
 * Admin 2.0 Asig. suggestion: cobranzas wins, WA length split, unknown → MA.
 * Complementary to orphan tests/cotizacionAssignment.test.js (not in test:core).
 * Run: node tests/cotizacionOwnerGate.test.js
 */
import assert from "node:assert/strict";
import {
  suggestOwner,
  operatorLabel,
  OPERATOR_CODES,
} from "../src/utils/cotizacionAssignment.js";

console.log("cotizacionOwnerGate");

{
  assert.equal(
    suggestOwner({ origen: "WA", consulta: "queja por el pago de la factura" }),
    "SA",
    "cobranzas keyword beats soporte + channel",
  );
  assert.equal(
    suggestOwner({ origen: "ML", consulta: "Hago la transferencia hoy" }),
    "SA",
  );
  assert.equal(
    suggestOwner({ origen: "WA", consulta: "Tengo una queja con el último envío" }),
    "MA",
  );
  console.log("  ✓ cobranzas (SA) before soporte (MA) before channel");
}

{
  const tin = "x".repeat(79);
  const ramiro = "x".repeat(80);
  assert.equal(suggestOwner({ origen: "WA", consulta: tin }), "TIN");
  assert.equal(suggestOwner({ origen: "WA", consulta: ramiro }), "RA");
  assert.equal(suggestOwner({ origen: "WA", consulta: "" }), "TIN");
  assert.equal(suggestOwner({ origen: "wa", consulta: "panel 6m" }), "TIN");
  assert.equal(suggestOwner({ origen: " EM ", consulta: "cotizar techo" }), "RA");
  console.log("  ✓ WA <80 → TIN; 80+ → RA");
}

{
  assert.equal(suggestOwner({ origen: "LL", consulta: "cotizar techo" }), "MA");
  assert.equal(suggestOwner({ origen: "FB", consulta: "vi el post" }), "MA");
  assert.equal(suggestOwner({ origen: "IG", consulta: "dm kit" }), "MA");
  assert.equal(suggestOwner({ origen: "XYZ", consulta: "loquesea" }), "MA");
  assert.equal(suggestOwner({}), "MA");
  assert.equal(suggestOwner(), "MA");
  console.log("  ✓ unknown / llamada / redes fallback MA");
}

{
  assert.equal(operatorLabel("sa"), "Sandra");
  assert.equal(operatorLabel("TIN"), "Martín");
  assert.equal(operatorLabel("XX"), "XX");
  assert.equal(operatorLabel(""), "—");
  assert.deepEqual([...OPERATOR_CODES], ["MA", "RA", "TIN", "SA"]);
  console.log("  ✓ operator labels + frozen codes");
}

console.log("cotizacionOwnerGate OK");
