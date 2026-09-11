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

// ISOROOF_COLONIAL must NOT prefix-collapse onto IsoRoof 3G (no Shopify colonial handle yet).
const colonialBom = [
  {
    grupo: "PANELES",
    items: [
      {
        descripcion: "ISOROOF COLONIAL 40mm",
        sku: "ISOROOF_COLONIAL-40",
        cant: 42,
        unidad: "m²",
        pu_usd: 46,
      },
      {
        descripcion: "Cumbrera ISOROOF Colonial 2,2 m",
        sku: "CUMROOFCOL",
        cant: 6,
        unidad: "m",
        pu_usd: 115,
      },
    ],
  },
];
const colonialLines = bomToCartLines(colonialBom, {
  techo: { familia: "ISOROOF_COLONIAL", espesor: "40", color: "Simil teja / Blanco" },
});
assert.equal(colonialLines.length, 0, "colonial panel+cumbrera omitted until Shopify handle exists");
assert.ok(
  !colonialLines.some((l) => /isoroof-3g|cumbrera-isoroof-3g/i.test(l.handle || "")),
  "never substitute IsoRoof 3G for colonial",
);

// Sibling families still resolve exactly.
const foilLines = bomToCartLines(
  [{ items: [{ sku: "ISOROOF_FOIL-30", descripcion: "ISOROOF FOIL 30mm", cant: 10, unidad: "m²", pu_usd: 46 }] }],
  { techo: { familia: "ISOROOF_FOIL", espesor: "30" } },
);
assert.equal(foilLines[0]?.handle, "iagro30");
const roof3g = bomToCartLines(
  [{ items: [{ sku: "ISOROOF_3G-50", descripcion: "ISOROOF 3G 50mm", cant: 10, unidad: "m²", pu_usd: 40 }] }],
  { techo: { familia: "ISOROOF_3G", espesor: "50" } },
);
assert.equal(roof3g[0]?.handle, "isoroof-3g-gris-rojo-blanco-bromyros");

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
