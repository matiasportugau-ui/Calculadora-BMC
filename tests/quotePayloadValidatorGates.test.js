/**
 * Pins server-side quote preview validation before a payload is trusted.
 * Run: node tests/quotePayloadValidatorGates.test.js
 */
import assert from "node:assert/strict";
import { validateAndPreviewQuote } from "../server/lib/quotePayloadValidator.js";
import { LISTA_ACTIVA, setListaPrecios } from "../src/data/constants.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function cents(n) {
  assert.equal(typeof n, "number");
  assert.ok(Number.isFinite(n));
  assert.equal(Math.round(n * 100) / 100, n);
}

function roof(largo, listaPrecios = "venta") {
  return validateAndPreviewQuote({
    scenario: "solo_techo",
    listaPrecios,
    techo: {
      familia: "ISODEC_EPS",
      espesor: 100,
      zonas: [{ largo, ancho: 4 }],
    },
  });
}

function fachada(pared) {
  return validateAndPreviewQuote({
    scenario: "solo_fachada",
    listaPrecios: "venta",
    pared: {
      familia: "ISOPANEL_EPS",
      espesor: 100,
      perimetro: 20,
      numEsqExt: 4,
      ...pared,
    },
  });
}

console.log("quotePayloadValidatorGates");

setListaPrecios("venta");
for (const payload of [null, [], "nope"]) {
  const rejected = validateAndPreviewQuote(payload);
  assert.equal(rejected.valid, false);
  assert.equal(rejected.preview, undefined);
  assert.match(rejected.errors[0], /scenario inválido "undefined"/);
}
assert.equal(LISTA_ACTIVA, "venta");
ok("non-objects are an undefined scenario and do not touch the price list");

const both = validateAndPreviewQuote({ scenario: "SOLO_TECHO", listaPrecios: "WEB" });
assert.deepEqual(both.errors, [
  'scenario inválido "SOLO_TECHO". Opciones: solo_techo | solo_fachada | techo_fachada | camara_frig',
  'listaPrecios inválida "WEB". Usar "web" o "venta"',
]);
assert.equal(LISTA_ACTIVA, "venta");
const spaced = validateAndPreviewQuote({ scenario: "solo_techo", listaPrecios: " venta" });
assert.match(spaced.errors[0], /listaPrecios inválida " venta"/);
assert.equal(spaced.errors.length, 1);
assert.equal(LISTA_ACTIVA, "venta");
ok("invalid lista is case-sensitive, untrimmed, and does not switch LISTA_ACTIVA");

const blankLista = validateAndPreviewQuote({ scenario: "solo_techo", listaPrecios: "" });
assert.match(blankLista.errors[0], /retornó null/);
assert.equal(LISTA_ACTIVA, "venta");
const nullEspesor = validateAndPreviewQuote({
  scenario: "solo_techo",
  techo: { familia: "ISODEC_EPS", espesor: null, zonas: [{ largo: 6, ancho: 4 }] },
});
assert.match(nullEspesor.errors[0], /retornó null/);
assert.equal(nullEspesor.errors[0].includes("BOM resultó vacío"), false);
ok("a missing espesor is a null scenario, and a blank lista does not switch prices");

const emptyZone = validateAndPreviewQuote({
  scenario: "solo_techo",
  listaPrecios: "venta",
  techo: { familia: "ISODEC_EPS", espesor: 100, zonas: [{ largo: 0, ancho: 0 }] },
});
assert.equal(emptyZone.valid, false);
assert.match(emptyZone.errors[0], /BOM resultó vacío/);
const espesorCero = validateAndPreviewQuote({
  scenario: "solo_techo",
  listaPrecios: "venta",
  techo: { familia: "ISODEC_EPS", espesor: 0, zonas: [{ largo: 6, ancho: 4 }] },
});
assert.match(espesorCero.errors[0], /BOM resultó vacío/);
ok("a zero zone and espesor 0 are an empty BOM");

const six = roof(6);
const sixM = roof("6m");
assert.equal(six.valid, true);
assert.equal(six.preview.totalItems, 14);
assert.equal(sixM.valid, true);
assert.equal(sixM.preview.totalItems, 12);
assert.ok(sixM.preview.subtotalUSD < six.preview.subtotalUSD);
assert.ok(sixM.preview.warnings.some((w) => String(w).includes("0m")));
cents(six.preview.subtotalUSD);
cents(six.preview.totalConIVA);
assert.ok(six.preview.totalConIVA > six.preview.subtotalUSD);
ok('"6m" stays a zero-length roof and is still returned as valid');

const web = roof(6, "web");
assert.equal(LISTA_ACTIVA, "web");
assert.equal(web.preview.totalItems, 14);
assert.notEqual(web.preview.subtotalUSD, six.preview.subtotalUSD);
ok("venta and web previews differ because listaPrecios switches the active list");

setListaPrecios("venta");
const corners = {
  neg: fachada({ numEsqExt: -1 }),
  zero: fachada({ numEsqExt: 0 }),
  four: fachada({ numEsqExt: 4 }),
  missing: fachada({ numEsqExt: undefined }),
  abc: fachada({ numEsqExt: "abc" }),
  two: fachada({ numEsqExt: "2" }),
};
assert.equal(corners.neg.preview.subtotalUSD, corners.four.preview.subtotalUSD);
assert.equal(corners.missing.preview.subtotalUSD, corners.four.preview.subtotalUSD);
assert.equal(corners.abc.preview.subtotalUSD, corners.four.preview.subtotalUSD);
assert.equal(corners.neg.preview.totalItems, 13);
assert.equal(corners.zero.preview.totalItems, 12);
assert.ok(corners.zero.preview.subtotalUSD < corners.four.preview.subtotalUSD);
assert.notEqual(corners.two.preview.subtotalUSD, corners.zero.preview.subtotalUSD);
assert.notEqual(corners.two.preview.subtotalUSD, corners.four.preview.subtotalUSD);
ok("negative and non-numeric corners bill as 4, while 0 is kept");

const altoMissing = fachada({});
const altoDefault = fachada({ alto: 3.5 });
const altoText = fachada({ alto: "3m" });
const altoZero = fachada({ alto: 0 });
const altoThree = fachada({ alto: 3 });
const altoNeg = fachada({ alto: -1 });
assert.equal(altoText.preview.subtotalUSD, altoDefault.preview.subtotalUSD);
assert.equal(altoMissing.preview.subtotalUSD, altoDefault.preview.subtotalUSD);
assert.equal(altoZero.preview.subtotalUSD, altoDefault.preview.subtotalUSD);
assert.ok(altoThree.preview.subtotalUSD < altoDefault.preview.subtotalUSD);
assert.ok(altoNeg.preview.subtotalUSD < altoThree.preview.subtotalUSD);
assert.equal(altoText.valid, true);
ok('alto "3m" and 0 use the 3.5 m default, and a negative alto is billed as-is');

console.log(`quotePayloadValidatorGates: ${passed} passed`);
