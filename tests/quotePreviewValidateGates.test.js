/**
 * Server quote preview validation. Run: node tests/quotePreviewValidateGates.test.js
 *
 * Pins validateAndPreviewQuote: invalid input never switches LISTA_ACTIVA,
 * a failed calc still does, omitted lista keeps the last list, and IVA is 22%.
 */
import assert from "node:assert/strict";
import { LISTA_ACTIVA, setListaPrecios } from "../src/data/constants.js";
import { validateAndPreviewQuote } from "../server/lib/quotePayloadValidator.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const SCENARIO_MSG =
  'scenario inválido "undefined". Opciones: solo_techo | solo_fachada | techo_fachada | camara_frig';

function roof(extra = {}, techoExtra = {}) {
  return {
    scenario: "solo_techo",
    ...extra,
    techo: { familia: "ISODEC_EPS", espesor: 100, largo: 6, ancho: 5, ...techoExtra },
  };
}

function expectIva(preview) {
  const iva = +(preview.subtotalUSD * 0.22).toFixed(2);
  assert.equal(preview.totalConIVA, +(preview.subtotalUSD + iva).toFixed(2));
  assert.ok(preview.totalConIVA > preview.subtotalUSD);
  assert.ok(preview.totalItems > 0);
}

console.log("quotePreviewValidate gates");

const listaBefore = LISTA_ACTIVA;
try {
  setListaPrecios("web");

  assert.deepEqual(validateAndPreviewQuote(null).errors, [SCENARIO_MSG]);
  assert.deepEqual(validateAndPreviewQuote([]).errors, [SCENARIO_MSG]);
  assert.equal(validateAndPreviewQuote(null).preview, undefined);
  assert.equal(LISTA_ACTIVA, "web");
  ok("null and array payloads name every scenario and do not switch lista");

  const both = validateAndPreviewQuote({ scenario: "nope", listaPrecios: "venta" });
  assert.equal(both.preview, undefined);
  assert.equal(both.errors.length, 1);
  assert.match(both.errors[0], /scenario inválido "nope"/);
  assert.equal(LISTA_ACTIVA, "web");
  const badLista = validateAndPreviewQuote({ scenario: " solo_techo", listaPrecios: "WEB" });
  assert.equal(badLista.errors.length, 2);
  assert.match(badLista.errors[0], /scenario inválido " solo_techo"/);
  assert.match(badLista.errors[1], /listaPrecios inválida "WEB"/);
  const spaced = validateAndPreviewQuote({ scenario: "solo_techo", listaPrecios: "venta " });
  assert.equal(spaced.valid, false);
  assert.match(spaced.errors[0], /listaPrecios inválida "venta "/);
  assert.equal(LISTA_ACTIVA, "web");
  ok("invalid scenario or lista returns before setListaPrecios");

  const missingFamily = validateAndPreviewQuote({
    scenario: "solo_techo",
    listaPrecios: "venta",
    techo: {},
  });
  assert.equal(missingFamily.valid, false);
  assert.match(missingFamily.errors[0], /retornó null/);
  assert.equal(LISTA_ACTIVA, "venta");
  setListaPrecios("web");
  const badEsp = validateAndPreviewQuote(roof({ listaPrecios: "venta" }, { espesor: "999" }));
  assert.equal(badEsp.valid, false);
  assert.match(badEsp.errors[0], /BOM resultó vacío/);
  assert.equal(LISTA_ACTIVA, "venta");
  ok("missing family is null; unknown espesor is empty BOM; both still switch lista");

  setListaPrecios("web");
  const web = validateAndPreviewQuote(roof({ listaPrecios: "web" }));
  const bare = validateAndPreviewQuote(roof());
  assert.equal(web.valid, true);
  assert.equal(bare.preview.subtotalUSD, web.preview.subtotalUSD);
  assert.equal(LISTA_ACTIVA, "web");
  const venta = validateAndPreviewQuote(roof({ listaPrecios: "venta" }));
  assert.equal(venta.valid, true);
  assert.notEqual(venta.preview.subtotalUSD, web.preview.subtotalUSD);
  assert.equal(LISTA_ACTIVA, "venta");
  const leaked = validateAndPreviewQuote(roof());
  assert.equal(leaked.preview.subtotalUSD, venta.preview.subtotalUSD);
  expectIva(web.preview);
  expectIva(venta.preview);
  assert.ok(web.preview.warnings.some((w) => /autoportancia/i.test(w)));
  ok("venta differs from web, omitted lista keeps the last list, IVA is 22%");

  setListaPrecios("web");
  const full = validateAndPreviewQuote(roof());
  const viaZonas = validateAndPreviewQuote(roof({}, {
    largo: 1,
    ancho: 1,
    zonas: [{ largo: "6", ancho: "5" }],
  }));
  const tiny = validateAndPreviewQuote(roof({}, { largo: 1, ancho: 1 }));
  const emptyZonas = validateAndPreviewQuote(roof({}, { zonas: [], largo: 6, ancho: 5 }));
  const unit = validateAndPreviewQuote(roof({}, { zonas: [{ largo: "6m", ancho: 5 }] }));
  const zeroLargo = validateAndPreviewQuote(roof({}, { largo: 0, ancho: 5 }));
  assert.equal(viaZonas.preview.subtotalUSD, full.preview.subtotalUSD);
  assert.notEqual(tiny.preview.subtotalUSD, full.preview.subtotalUSD);
  assert.equal(emptyZonas.preview.subtotalUSD, full.preview.subtotalUSD);
  assert.equal(unit.valid, true);
  assert.ok(unit.preview.subtotalUSD > 0);
  assert.ok(unit.preview.subtotalUSD < full.preview.subtotalUSD);
  assert.equal(zeroLargo.valid, true);
  assert.ok(zeroLargo.preview.subtotalUSD > 0);
  assert.ok(zeroLargo.preview.subtotalUSD < full.preview.subtotalUSD);
  ok("zonas strings win, empty zonas fall back, 6m and largo 0 still quote");

  setListaPrecios("web");
  const cam = validateAndPreviewQuote({
    scenario: "camara_frig",
    pared: { familia: "ISOWALL_PIR", espesor: 80 },
    camara: { largo_int: 4, ancho_int: 3, alto_int: 2.5 },
  });
  assert.equal(cam.valid, true);
  expectIva(cam.preview);
  assert.ok(cam.preview.warnings.some((w) => /80mm/.test(w) && /100mm/.test(w)));
  const noRoof = validateAndPreviewQuote({ scenario: "techo_fachada" });
  assert.match(noRoof.errors[0], /retornó null/);
  ok("cámara remaps 80mm techo to 100mm; empty techo+fachada is null");
} finally {
  setListaPrecios(listaBefore);
}

console.log(`quotePreviewValidate gates: ${passed} passed`);
