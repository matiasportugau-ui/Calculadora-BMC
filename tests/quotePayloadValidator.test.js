/**
 * Offline regression for server/lib/quotePayloadValidator.js
 * Voice + chat buildQuote previews — money safety + listaPrecios isolation.
 *
 * Run: node --test tests/quotePayloadValidator.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { validateAndPreviewQuote } from "../server/lib/quotePayloadValidator.js";
import { LISTA_ACTIVA, setListaPrecios } from "../src/data/constants.js";

const TECHO_OK = {
  familia: "ISODEC_EPS",
  espesor: 100,
  largo: 10,
  ancho: 6,
  tipoEst: "metal",
};

const PARED_OK = {
  familia: "ISOPANEL_EPS",
  espesor: 100,
  alto: 3,
  perimetro: 40,
  tipoEst: "metal",
};

beforeEach(() => {
  setListaPrecios("web");
});

describe("validateAndPreviewQuote — validation rejects", () => {
  it("rejects invalid scenario before preview", () => {
    const r = validateAndPreviewQuote({
      scenario: "solo_piso",
      techo: TECHO_OK,
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => /scenario inválido/i.test(e)));
    assert.equal(r.preview, undefined);
  });

  it("rejects invalid listaPrecios", () => {
    const r = validateAndPreviewQuote({
      scenario: "solo_techo",
      listaPrecios: "mayorista",
      techo: TECHO_OK,
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => /listaPrecios inválida/i.test(e)));
  });

  it("rejects empty/invalid family BOM (no zero-dollar valid preview)", () => {
    const r = validateAndPreviewQuote({
      scenario: "solo_techo",
      techo: { familia: "NO_EXISTE", espesor: 100, largo: 10, ancho: 6 },
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.length >= 1);
    assert.equal(r.preview, undefined);
  });
});

describe("validateAndPreviewQuote — valid previews", () => {
  it("solo_techo returns non-zero USD preview", () => {
    const r = validateAndPreviewQuote({
      scenario: "solo_techo",
      listaPrecios: "web",
      techo: TECHO_OK,
    });
    assert.equal(r.valid, true);
    assert.ok(r.preview.totalItems > 0);
    assert.ok(r.preview.subtotalUSD > 0);
    assert.ok(r.preview.totalConIVA > r.preview.subtotalUSD);
  });

  it("solo_fachada returns non-zero USD preview", () => {
    const r = validateAndPreviewQuote({
      scenario: "solo_fachada",
      pared: PARED_OK,
    });
    assert.equal(r.valid, true);
    assert.ok(r.preview.subtotalUSD > 0);
    assert.ok(r.preview.totalConIVA > 0);
  });

  it("camara_frig returns non-zero USD preview", () => {
    const r = validateAndPreviewQuote({
      scenario: "camara_frig",
      camara: { largo_int: 6, ancho_int: 4, alto_int: 2.5 },
      pared: { familia: "ISOPANEL_EPS", espesor: 150 },
    });
    assert.equal(r.valid, true);
    assert.ok(r.preview.subtotalUSD > 0);
    assert.ok(r.preview.totalConIVA > 0);
  });
});

describe("validateAndPreviewQuote — listaPrecios isolation", () => {
  it("venta preview does not leave LISTA_ACTIVA stuck on venta", () => {
    setListaPrecios("web");
    const webBaseline = validateAndPreviewQuote({
      scenario: "solo_techo",
      listaPrecios: "web",
      techo: TECHO_OK,
    });
    const venta = validateAndPreviewQuote({
      scenario: "solo_techo",
      listaPrecios: "venta",
      techo: TECHO_OK,
    });
    assert.equal(venta.valid, true);
    assert.equal(LISTA_ACTIVA, "web", "must restore prior lista after venta preview");

    const followUp = validateAndPreviewQuote({
      scenario: "solo_techo",
      techo: TECHO_OK,
    });
    assert.equal(followUp.valid, true);
    // Follow-up without listaPrecios must price as restored web, not leftover venta.
    assert.equal(
      followUp.preview.subtotalUSD,
      webBaseline.preview.subtotalUSD,
      "follow-up without listaPrecios must match web baseline",
    );
    assert.notEqual(
      followUp.preview.subtotalUSD,
      venta.preview.subtotalUSD,
      "follow-up must not silently use leftover venta prices",
    );
  });

  it("web then venta previews keep independent totals and restore lista", () => {
    const web = validateAndPreviewQuote({
      scenario: "solo_techo",
      listaPrecios: "web",
      techo: TECHO_OK,
    });
    const venta = validateAndPreviewQuote({
      scenario: "solo_techo",
      listaPrecios: "venta",
      techo: TECHO_OK,
    });
    assert.equal(web.valid, true);
    assert.equal(venta.valid, true);
    assert.notEqual(
      web.preview.subtotalUSD,
      venta.preview.subtotalUSD,
      "web vs venta must differ for same geometry (proves lista was applied)",
    );
    assert.equal(LISTA_ACTIVA, "web");
  });
});
