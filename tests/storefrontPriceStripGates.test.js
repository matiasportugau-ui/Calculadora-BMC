// stripInternalPrices leftover keys (#1198 public model).
// Tip storefrontVoicePack drops precio_venta / costo / flete / nested flete_usd.
// This file pins cost_usd, shipping, precio_flete, arrays, and venta-in-key.
// Run: node tests/storefrontPriceStripGates.test.js

import assert from "node:assert/strict";
import { stripInternalPrices } from "../server/lib/voice/storefrontVoicePack.js";

assert.equal(stripInternalPrices(null), null);
assert.equal(stripInternalPrices(41), 41);
assert.equal(stripInternalPrices("web"), "web");

{
  const stripped = stripInternalPrices({
    lista: "web",
    precio: 41,
    precio_usd_m2_sin_iva: 41.15,
    cost_usd: 18,
    precio_costo: 20,
    shipping: 240,
    precio_flete: 252,
    flete_interno: 99,
    lista_venta: 33,
    subtotal_costo: 12,
    ok: true,
  });
  assert.equal(stripped.lista, "web");
  assert.equal(stripped.precio, 41, "bare precio (lista web) stays");
  assert.equal(stripped.precio_usd_m2_sin_iva, 41.15);
  assert.equal(stripped.ok, true);
  assert.equal(stripped.cost_usd, undefined);
  assert.equal(stripped.precio_costo, undefined);
  assert.equal(stripped.shipping, undefined);
  assert.equal(stripped.precio_flete, undefined);
  assert.equal(stripped.flete_interno, undefined, "^flete* keys drop");
  assert.equal(stripped.lista_venta, undefined, "venta substring drops lista_venta");
  assert.equal(stripped.subtotal_costo, undefined, "costo substring drops subtotal_costo");
}

{
  const rows = stripInternalPrices([
    { sku: "ISODEC_EPS-100", precio_usd_m2_sin_iva: 41, cost_usd: 18, shipping: 1 },
    { sku: "varilla_38", precio: 3.68, precio_flete: 0 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].sku, "ISODEC_EPS-100");
  assert.equal(rows[0].precio_usd_m2_sin_iva, 41);
  assert.equal(rows[0].cost_usd, undefined);
  assert.equal(rows[0].shipping, undefined);
  assert.equal(rows[1].precio, 3.68);
  assert.equal(rows[1].precio_flete, undefined);
}

{
  const nested = stripInternalPrices({
    bom: {
      items: [{ label: "IsoDec", costo: 9, precio_usd_m2_sin_iva: 41 }],
    },
  });
  assert.equal(nested.bom.items[0].precio_usd_m2_sin_iva, 41);
  assert.equal(nested.bom.items[0].costo, undefined);
}

console.log("storefrontPriceStripGates.test.js: ok");
