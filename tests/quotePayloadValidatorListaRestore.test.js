// Bug DT — validateAndPreviewQuote must not leave LISTA_ACTIVA flipped.
// Run: node tests/quotePayloadValidatorListaRestore.test.js
import assert from "node:assert/strict";
import { LISTA_ACTIVA, setListaPrecios } from "../src/data/constants.js";
import { validateAndPreviewQuote } from "../server/lib/quotePayloadValidator.js";

const prev = LISTA_ACTIVA;
setListaPrecios("web");

const result = validateAndPreviewQuote({
  scenario: "solo_techo",
  listaPrecios: "venta",
  techo: { familia: "not-a-real-familia", espesor: "100", largo: 10, ancho: 8 },
});

assert.equal(LISTA_ACTIVA, "web", "LISTA_ACTIVA restored after preview (even on empty/invalid BOM)");
assert.ok(result && typeof result.valid === "boolean", "returns validation object");

setListaPrecios(prev);
console.log("✅ quotePayloadValidatorListaRestore (Bug DT) OK");
