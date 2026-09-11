// Quote BOM → Shopify cart lines.
// Run: node tests/storefrontQuoteCart.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bomToCartLines, quotePayloadToCotizarBody } from "../server/lib/voice/storefrontQuoteCart.js";

const bom = [
  {
    grupo: "PANELES",
    items: [
      {
        descripcion: "ISODEC EPS 100mm · 8 paneles × 10.00 m",
        sku: "ISODEC_EPS-100",
        cant: 89.6,
        unidad: "m²",
        pu_usd: 41.15,
      },
    ],
  },
  {
    grupo: "FIJACIONES",
    items: [
      { descripcion: "Varilla roscada 3/8\" (1m)", sku: "varilla_38", cant: 10, unidad: "unid", pu_usd: 3.68 },
      { descripcion: "Tuerca 3/8\" galv.", sku: "tuerca_38", cant: 92, unidad: "unid", pu_usd: 0.08 },
      { descripcion: "Flete Montevideo", sku: "FLETE", cant: 1, unidad: "servicio", pu_usd: 240 },
    ],
  },
  {
    grupo: "SELLADORES",
    items: [
      { descripcion: "Cinta Butilo 2mm×15mm×22.5m", sku: "cinta_butilo", cant: 1, unidad: "unid", pu_usd: 19.19 },
    ],
  },
];

const lines = bomToCartLines(bom, { techo: { familia: "ISODEC_EPS", espesor: "100", color: "Blanco" } });
const handles = lines.map((l) => l.handle);
assert.ok(handles.includes("isopanel-isodec-eps-cubiertas-bmc-reloaded"), "IsoDec panel handle");
assert.ok(handles.includes("varilla-roscada-bsw-3_8"), "varilla");
assert.ok(handles.includes("tuerca-bsw-3-8-galvanizada"), "tuerca");
assert.ok(handles.includes("cinta-butilo"), "cinta");
assert.ok(!handles.some((h) => /flete/i.test(h)), "never flete");
const panel = lines.find((l) => l.sku === "ISODEC_EPS-100");
assert.equal(panel.quantity, 90, "m² rounded for cart qty");
assert.equal(panel.espesor, "100");
assert.equal(panel.color, "Blanco");
assert.equal(quotePayloadToCotizarBody({ scenario: "solo_techo" }).escenario, "solo_techo");
assert.equal(quotePayloadToCotizarBody({ scenario: "solo_techo" }).flete, 0);

// IsoRoof babeta SKUs must never land on IsoDec Shopify handles (wrong product/price).
const isoroofBabeta = bomToCartLines(
  [
    {
      grupo: "PERFILERÍA",
      items: [
        {
          descripcion: "Lat.Izq: Babeta lateral de adosar",
          sku: "BBAS3G",
          cant: 2,
          unidad: "unid",
          pu_usd: 29.39,
        },
        {
          descripcion: "Frente Sup: Babeta de adosar Superior",
          sku: "BBAS3G",
          cant: 1,
          unidad: "unid",
          pu_usd: 29.39,
        },
        {
          descripcion: "Lat.Der: Babeta Lateral de empotrar",
          sku: "BBESUP",
          cant: 2,
          unidad: "unid",
          pu_usd: 28.31,
        },
        {
          descripcion: "Frente Sup: Babeta de empotrar Superior",
          sku: "BBESUP",
          cant: 1,
          unidad: "unid",
          pu_usd: 28.31,
        },
      ],
    },
  ],
  { techo: { familia: "ISOROOF_3G", espesor: "40", color: "Gris" } },
);
assert.equal(
  isoroofBabeta.find((l) => /lateral de adosar/i.test(l.title))?.handle,
  "babeta-de-atornillar-lateral-isoroof",
);
assert.equal(
  isoroofBabeta.find((l) => /adosar Superior/i.test(l.title))?.handle,
  "babeta-de-atornillar-superior-3g-isoroof",
);
assert.equal(
  isoroofBabeta.find((l) => /Lateral de empotrar/i.test(l.title))?.handle,
  "babeta-de-empotrar-lateral-isoroof",
);
assert.equal(
  isoroofBabeta.find((l) => /empotrar Superior/i.test(l.title))?.handle,
  "babeta-de-empotrar-superior-3g-isoroof-bmc-reloaded",
);
assert.ok(
  !isoroofBabeta.some((l) => /isodec/i.test(l.handle)),
  "IsoRoof babeta must not map to IsoDec handles",
);

const isodecBabeta = bomToCartLines(
  [
    {
      grupo: "PERFILERÍA",
      items: [
        { descripcion: "Lat.Izq: Babeta lateral de adosar", sku: "6828", cant: 1, unidad: "unid", pu_usd: 17.82 },
        { descripcion: "Lat.Der: Babeta Lateral de empotrar", sku: "6865", cant: 1, unidad: "unid", pu_usd: 15.67 },
      ],
    },
  ],
  { techo: { familia: "ISODEC_EPS", espesor: "100", color: "Blanco" } },
);
assert.equal(isodecBabeta.find((l) => l.sku === "6828")?.handle, "babeta-isodec-adosar");
assert.equal(isodecBabeta.find((l) => l.sku === "6865")?.handle, "babeta-de-empotrar-isodec");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const widget = fs.readFileSync(path.join(ROOT, "server/public/storefront-voice/widget.js"), "utf8");
assert.ok(widget.includes("add_quote_to_cart"), "widget loads quote into cart");
assert.ok(widget.includes("addQuoteLinesToCart"), "bulk add helper");
assert.ok(widget.includes("pickVariant"), "match thickness/color");

const chat = fs.readFileSync(path.join(ROOT, "server/lib/voice/storefrontChat.js"), "utf8");
assert.ok(chat.includes("add_quote_to_cart"), "text chat emits cart action after PDF");

const pub = fs.readFileSync(path.join(ROOT, "server/routes/publicVoice.js"), "utf8");
assert.ok(pub.includes("attachStorefrontCartLines"), "PDF attaches cart_lines");

console.log("storefrontQuoteCart.test.js: ok");
