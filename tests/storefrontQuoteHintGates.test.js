// Quote→cart leftovers after #1203 family/qty/color and #1251 DESC/SKU.
// ISOWALL + arandelas + espesor hint/dash + ml qty + cámara color + title cap.
// Run: node tests/storefrontQuoteHintGates.test.js

import assert from "node:assert/strict";
import {
  bomToCartLines,
  PANEL_HANDLES,
  SKU_HANDLES,
} from "../server/lib/voice/storefrontQuoteCart.js";

function linesOf(items, quoteInput) {
  return bomToCartLines([{ grupo: "X", items }], quoteInput);
}

{
  const wall = linesOf([{ sku: "ISOWALL_PIR-80", descripcion: "ISOWALL PIR 80mm", cant: 6, unidad: "m²" }]);
  assert.equal(wall.length, 1);
  assert.equal(wall[0].handle, PANEL_HANDLES.ISOWALL_PIR, "ISOWALL_PIR must not collapse to ISOPANEL_EPS");
  assert.equal(wall[0].espesor, "80");
}

{
  const arandelas = linesOf([
    { sku: "arandela_carrocero", descripcion: "Arandela carrocero", cant: 4, unidad: "unid" },
    { sku: "arandela_plana", descripcion: "Arandela plana", cant: 4, unidad: "unid" },
    { sku: "arandela_pp", descripcion: "Arandela PP", cant: 4, unidad: "unid" },
  ]);
  assert.deepEqual(
    arandelas.map((l) => l.handle),
    [SKU_HANDLES.arandela_carrocero, SKU_HANDLES.arandela_plana, SKU_HANDLES.arandela_pp],
  );
}

{
  const dash = linesOf([{ sku: "ISODEC_EPS-100", descripcion: "panel sin milímetros en el label", cant: 2, unidad: "unid" }]);
  assert.equal(dash[0].espesor, "100", "SKU -NNN supplies mm when label has none");
}

{
  const hinted = linesOf(
    [{ sku: "varilla_38", descripcion: "Varilla 3/8", cant: 2, unidad: "unid" }],
    { techo: { espesor: "80mm" } },
  );
  assert.equal(hinted[0].espesor, "80", "quote espesor digits fill when SKU/label have no mm");
}

{
  const ml = linesOf([{ sku: "varilla_38", descripcion: "Varilla", cant: 7, unidad: "ml" }]);
  assert.equal(ml[0].quantity, 3, "ml bills ceil(cant/3) like m");
}

{
  const camara = linesOf(
    [{ sku: "ISODEC_EPS-100", descripcion: "ISODEC EPS 100mm", cant: 3, unidad: "m²" }],
    { camara: { color: "gris" } },
  );
  assert.equal(camara[0].color, "Gris", "cámara color is used when techo/pared absent");
}

{
  const long = "X".repeat(120);
  const [row] = linesOf([{ sku: "cinta_butilo", descripcion: long, cant: 1, unidad: "unid", pu_usd: 19.19 }]);
  assert.equal(row.title.length, 80);
  assert.equal(row.cant, 1);
  assert.equal(row.pu_usd, 19.19);
  assert.equal(row.unidad, "unid");
}

console.log("storefrontQuoteHintGates.test.js: ok");
