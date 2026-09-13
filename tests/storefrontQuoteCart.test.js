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

// Real /calc BOM labels (no IsoDec/IsoRoof token) must map via matriz SKU + border resolve.
const calcStyleBom = [
  {
    grupo: "PERFILERÍA",
    items: [
      { descripcion: "Frente Inf: Canalón", sku: "CD50", cant: 4, unidad: "unid", pu_usd: 90 },
      { descripcion: "Soporte canalón", sku: "SOPCAN3M", cant: 2, unidad: "unid", pu_usd: 16 },
      { descripcion: "Frente Inf: Gotero frontal", sku: "GFS50", cant: 4, unidad: "unid", pu_usd: 20 },
      { descripcion: "Lat.Izq: Gotero Lateral", sku: "GL50", cant: 3, unidad: "unid", pu_usd: 29 },
      { descripcion: "Lat.Der: Gotero Lateral", sku: "GL50", cant: 3, unidad: "unid", pu_usd: 29 },
      { descripcion: "Frente Sup: Cumbrera", sku: "CUMROOF3M", cant: 4, unidad: "unid", pu_usd: 43 },
      { descripcion: "Tornillo T1 p/mecha", sku: "tornillo_t1", cant: 40, unidad: "unid", pu_usd: 0.15 },
    ],
  },
];
const calcLines = bomToCartLines(calcStyleBom, {
  techo: { familia: "ISOROOF", espesor: "50", color: "Blanco" },
});
const bySku = Object.fromEntries(calcLines.map((l) => [l.sku, l]));
assert.equal(bySku.CD50?.handle, "canalon-doble-isoroof-bandeja-tapas-agujero-bajada", "CD50 canalón IsoRoof");
assert.equal(bySku.SOPCAN3M?.handle, "soporte-para-canalon-isoroof", "SOPCAN3M soporte");
assert.equal(bySku.GFS50?.handle, "gotero-frontal-simple-isoroof", "GFS50 gotero frontal");
assert.equal(bySku.GL50?.handle, "gotero-lateral-isoroof", "GL50 gotero lateral");
assert.equal(bySku.GL50?.quantity, 6, "same SKU both sides merges qty (3+3)");
assert.equal(bySku.CUMROOF3M?.handle, "cumbrera-isoroof-3g", "CUMROOF3M cumbrera");
assert.equal(bySku.tornillo_t1?.handle, "tornillo-t1-p-mecha-01", "tornillo_t1 sku");

// IsoDec matriz SKUs + labels without brand token (familia from quote).
const isodecBom = [
  {
    grupo: "PERFILERÍA",
    items: [
      { descripcion: "Frente Inf: Canalón", sku: "6801", cant: 3, unidad: "unid", pu_usd: 82 },
      { descripcion: "Soporte canalón", sku: "6805", cant: 2, unidad: "unid", pu_usd: 18 },
      { descripcion: "Lat.Izq: Babeta de adosar Superior", sku: "6828", cant: 2, unidad: "unid", pu_usd: 17 },
      { descripcion: "Frente Inf: Gotero frontal", sku: "6838", cant: 2, unidad: "unid", pu_usd: 18 },
    ],
  },
];
const isodecLines = bomToCartLines(isodecBom, {
  techo: { familia: "ISODEC_EPS", espesor: "100", color: "Blanco" },
});
assert.equal(
  isodecLines.find((l) => l.sku === "6801")?.handle,
  "canalon-isodec-kit-completo",
  "6801 IsoDec canalón",
);
assert.equal(
  isodecLines.find((l) => l.sku === "6805")?.handle,
  "soporte-de-canalon-isodec",
  "6805 IsoDec soporte",
);
assert.equal(
  isodecLines.find((l) => l.sku === "6828")?.handle,
  "babeta-isodec-adosar",
  "6828 IsoDec babeta",
);
assert.equal(
  isodecLines.find((l) => l.sku === "6838")?.handle,
  "gotero-frontal-isodec",
  "6838 IsoDec gotero frontal",
);

// Label-only path (no sku): quote familia selects IsoRoof babeta, not IsoDec default.
const labelOnly = bomToCartLines(
  [
    {
      grupo: "PERFILERÍA",
      items: [{ descripcion: "Lat.Izq: Babeta lateral de adosar", cant: 2, unidad: "unid", pu_usd: 29 }],
    },
  ],
  { techo: { familia: "ISOROOF", espesor: "50", color: "Gris" } },
);
assert.equal(
  labelOnly[0]?.handle,
  "babeta-de-atornillar-lateral-isoroof",
  "calc babeta label + ISOROOF quote → IsoRoof babeta",
);

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
