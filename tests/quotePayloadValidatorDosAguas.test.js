/**
 * buildQuote gate: validateAndPreviewQuote must stamp zonas[].dosAguas from
 * tipoAguas so preview/UI share the same aguas signal (Bug EM companion).
 *
 * Run: node tests/quotePayloadValidatorDosAguas.test.js
 */
import { validateAndPreviewQuote } from "../server/lib/quotePayloadValidator.js";

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

const base = {
  scenario: "solo_techo",
  listaPrecios: "venta",
  techo: {
    familia: "ISODEC_EPS",
    espesor: "100",
    tipoAguas: "dos_aguas",
    pendiente: 10,
    zonas: [{ largo: 10, ancho: 8 }],
  },
};

const ok = validateAndPreviewQuote(base);
assert(ok.valid === true, "dos_aguas ISODEC EPS 100 validates");
assert(ok.preview?.subtotalUSD > 0, "preview has money");

// Re-run normalize path indirectly: una_agua must still validate
const una = validateAndPreviewQuote({
  ...base,
  techo: { ...base.techo, tipoAguas: "una_agua" },
});
assert(una.valid === true, "una_agua still validates");
assert(
  Math.abs((ok.preview?.subtotalUSD || 0) - (una.preview?.subtotalUSD || 0)) > 1,
  "dos_aguas preview total differs from una_agua (server uses tipoAguas)",
);

console.log(`\nquotePayloadValidatorDosAguas: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
