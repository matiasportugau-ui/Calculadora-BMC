// Quote BOM → Shopify handle leftovers after #1203 family/qty/color gates.
// Pins DESC_HANDLES specificity (cámara before generic lateral; babeta pair)
// and SKU_HANDLES that the happy-path IsoDec/varilla suite never hits.
// Does not land colonial / soporte-canalón / perfilería production fixes.
// Run: node tests/storefrontQuoteDescSkuGates.test.js

import assert from "node:assert/strict";
import { bomToCartLines, SKU_HANDLES } from "../server/lib/voice/storefrontQuoteCart.js";

function linesOf(items, quoteInput) {
  return bomToCartLines([{ grupo: "X", items }], quoteInput);
}

{
  const camara = linesOf([
    { sku: "", descripcion: "Gotero lateral de cámara IsoDec 100mm", cant: 2, unidad: "unid" },
  ]);
  assert.equal(camara.length, 1);
  assert.equal(
    camara[0].handle,
    "gotero-lateral-de-camara-isodec",
    "cámara regex must win over generic IsoDec lateral",
  );
}

{
  const lateral = linesOf([
    { sku: "", descripcion: "Gotero lateral IsoDec 100mm", cant: 1, unidad: "unid" },
  ]);
  assert.equal(lateral[0].handle, "gotero-lateral-para-isodec-copia");
  assert.notEqual(lateral[0].handle, "gotero-lateral-de-camara-isodec");
}

{
  const roofCamara = linesOf([
    { sku: "", descripcion: "Gotero lateral de cámara IsoRoof", cant: 1, unidad: "unid" },
  ]);
  assert.equal(roofCamara[0].handle, "gotero-lateral-de-camara-isoroof");

  const roofLateral = linesOf([
    { sku: "", descripcion: "Gotero lateral IsoRoof", cant: 1, unidad: "unid" },
  ]);
  assert.equal(roofLateral[0].handle, "gotero-lateral-isoroof");
  assert.notEqual(roofLateral[0].handle, "gotero-lateral-de-camara-isoroof");
}

{
  const adosar = linesOf([{ sku: "", descripcion: "Babeta para adosar IsoDec", cant: 1, unidad: "unid" }]);
  const empotrar = linesOf([{ sku: "", descripcion: "Babeta de empotrar IsoDec", cant: 1, unidad: "unid" }]);
  assert.equal(adosar[0].handle, "babeta-isodec-adosar");
  assert.equal(empotrar[0].handle, "babeta-de-empotrar-isodec");
  assert.notEqual(adosar[0].handle, empotrar[0].handle);
}

{
  const sil = linesOf([{ sku: "silicona", descripcion: "Silicona neutra", cant: 2, unidad: "unid" }]);
  assert.equal(sil[0].handle, SKU_HANDLES.silicona);
  assert.equal(sil[0].handle, "bromplast-8-silicona-neutra");

  const sil300 = linesOf([
    { sku: "silicona_300_neutra", descripcion: "Silicona 300 neutra", cant: 1, unidad: "unid" },
  ]);
  assert.equal(sil300[0].handle, SKU_HANDLES.silicona_300_neutra);
  assert.equal(sil300[0].handle, "silicona-neutra-pomo-premium");
  assert.notEqual(sil[0].handle, sil300[0].handle, "300ml pomo must not collapse to Bromplast 8");
}

{
  const tornillo = linesOf([{ sku: "", descripcion: "Tornillo T1 p/mecha", cant: 40, unidad: "unid" }]);
  assert.equal(tornillo[0].handle, "tornillo-t1-p-mecha-01");
}

{
  const ascii = linesOf([
    { sku: "ISODEC_EPS-100", descripcion: "ISODEC EPS 100mm", cant: 8.4, unidad: "m2" },
  ]);
  const unicode = linesOf([
    { sku: "ISODEC_EPS-100", descripcion: "ISODEC EPS 100mm", cant: 8.4, unidad: "m²" },
  ]);
  assert.equal(ascii[0].quantity, 8, "ascii m2 must round like m², not ceil(unid)");
  assert.equal(unicode[0].quantity, 8);
}

console.log("storefrontQuoteDescSkuGates.test.js: ok");
