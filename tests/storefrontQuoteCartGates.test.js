// Quote BOM → Shopify cart edges (#1198).
// Happy path lives in storefrontQuoteCart.test.js (IsoDec + flete skip).
// Run: node tests/storefrontQuoteCartGates.test.js

import assert from "node:assert/strict";
import { bomToCartLines, quotePayloadToCotizarBody, PANEL_HANDLES, SKU_HANDLES } from "../server/lib/voice/storefrontQuoteCart.js";

function linesOf(items, quoteInput) {
  return bomToCartLines([{ grupo: "X", items }], quoteInput);
}

{
  const foil = linesOf([{ sku: "ISOROOF_FOIL-30", descripcion: "ISOROOF FOIL 30mm", cant: 12, unidad: "m²" }]);
  assert.equal(foil.length, 1);
  assert.equal(foil[0].handle, PANEL_HANDLES.ISOROOF_FOIL, "FOIL must not collapse to ISOROOF 3G");
  assert.equal(foil[0].espesor, "30");
}

{
  const plus = linesOf([{ sku: "ISOROOF_PLUS-80", descripcion: "ISOROOF PLUS 80 mm", cant: 4, unidad: "m²" }]);
  assert.equal(plus[0].handle, PANEL_HANDLES.ISOROOF_PLUS);
}

{
  const pir = linesOf([{ sku: "ISODEC_PIR-80", descripcion: "ISODEC PIR 80mm", cant: 10, unidad: "m²" }]);
  assert.equal(pir[0].handle, PANEL_HANDLES.ISODEC_PIR, "PIR must not use EPS handle");
}

{
  const roof = linesOf([{ sku: "ISOROOF-50", descripcion: "ISOROOF 50mm", cant: 2, unidad: "m²" }]);
  assert.equal(roof[0].handle, PANEL_HANDLES.ISOROOF);
}

{
  const wall = linesOf([{ sku: "ISOPANEL_EPS-50", descripcion: "Isopanel EPS 50mm", cant: 3, unidad: "m²" }]);
  assert.equal(wall[0].handle, PANEL_HANDLES.ISOPANEL_EPS);
}

{
  const gris = linesOf(
    [{ sku: "ISODEC_EPS-100", descripcion: "ISODEC EPS 100mm", cant: 8, unidad: "m²" }],
    { techo: { color: "gris oscuro" } },
  );
  assert.equal(gris[0].color, "Gris");
  const rojo = linesOf(
    [{ sku: "ISODEC_EPS-100", descripcion: "ISODEC EPS 100mm", cant: 8, unidad: "m²" }],
    { techo: { color: "Rojo" } },
  );
  assert.equal(rojo[0].color, "Rojo");
  const terra = linesOf(
    [{ sku: "ISODEC_EPS-100", descripcion: "ISODEC EPS 100mm", cant: 8, unidad: "m²" }],
    { pared: { color: "Terracota" } },
  );
  assert.equal(terra[0].color, "Terracota");
  const fallback = linesOf(
    [{ sku: "ISODEC_EPS-100", descripcion: "ISODEC EPS 100mm", cant: 8, unidad: "m²" }],
    { techo: { color: "Azul" } },
  );
  assert.equal(fallback[0].color, "Blanco", "unknown color stays Blanco");
}

{
  const metros = linesOf([{ sku: "varilla_38", descripcion: "Varilla 3/8", cant: 7, unidad: "m" }]);
  assert.equal(metros[0].handle, SKU_HANDLES.varilla_38);
  assert.equal(metros[0].quantity, 3, "ml/m bill ceil(cant/3)");
  const zero = linesOf([{ sku: "tuerca_38", descripcion: "Tuerca", cant: 0, unidad: "unid" }]);
  assert.equal(zero[0].quantity, 1, "current: zero cant still emits qty 1");
  const huge = linesOf([{ sku: "cinta_butilo", descripcion: "Cinta", cant: 900, unidad: "unid" }]);
  assert.equal(huge[0].quantity, 500, "cart qty clamp");
}

{
  const dropped = linesOf([
    { sku: "FLETE", descripcion: "Flete Montevideo", cant: 1, unidad: "servicio", pu_usd: 240 },
    { sku: "flete", descripcion: "flete interior", cant: 1, unidad: "servicio" },
    { sku: "UNKNOWN_SKU", descripcion: "producto inventado", cant: 2, unidad: "unid" },
    { sku: "", descripcion: "sin sku ni label conocido", cant: 1, unidad: "unid" },
  ]);
  assert.deepEqual(dropped, [], "flete + unknown handles never become cart lines");
}

{
  const byDesc = linesOf([
    { sku: "", descripcion: "Gotero frontal para IsoDec 100mm", cant: 2, unidad: "unid" },
    { sku: "", descripcion: "Cumbrera IsoRoof 3G", cant: 1, unidad: "unid" },
  ]);
  assert.equal(byDesc[0].handle, "gotero-frontal-isodec");
  assert.equal(byDesc[1].handle, "cumbrera-isoroof-3g");
}

{
  const dup = linesOf([
    { sku: "ISODEC_EPS-100", descripcion: "ISODEC EPS 100mm", cant: 10, unidad: "m²" },
    { sku: "ISODEC_EPS-100", descripcion: "ISODEC EPS 100mm (dup)", cant: 4, unidad: "m²" },
  ]);
  assert.equal(dup.length, 1, "same handle|espesor|color|sku deduped");
}

assert.deepEqual(bomToCartLines(null), []);
assert.deepEqual(bomToCartLines({}), []);
assert.deepEqual(bomToCartLines([{ grupo: "X" }]), []);

{
  const body = quotePayloadToCotizarBody({
    scenario: "completo",
    techo: { familia: "ISODEC_EPS", espesor: "100" },
    pared: { familia: "ISOPANEL_EPS" },
  });
  assert.equal(body.lista, "web");
  assert.equal(body.flete, 0);
  assert.equal(body.source, "storefront-voice");
  assert.equal(body.escenario, "completo");
  assert.equal(body.techo.familia, "ISODEC_EPS");
  assert.equal(body.pared.familia, "ISOPANEL_EPS");
  assert.equal(Object.hasOwn(body, "camara"), false);
  assert.equal(quotePayloadToCotizarBody({ escenario: "solo_pared" }).escenario, "solo_pared");
}

console.log("storefrontQuoteCartGates.test.js: ok");
