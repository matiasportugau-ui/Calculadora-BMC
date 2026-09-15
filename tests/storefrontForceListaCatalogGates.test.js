// Public catalog/search tools must stay on lista web (#1198 / #1227 leftover).
// #1227 pins calcular_cotizacion + generar_pdf + obtener_precio_panel.
// This file pins the other read tools and that shop_* must not rewrite lista/flete.
// Run: node tests/storefrontForceListaCatalogGates.test.js

import assert from "node:assert/strict";
import { forceListaWeb, STOREFRONT_SHOP_TOOLS } from "../server/lib/voice/storefrontVoicePack.js";

for (const name of [
  "obtener_catalogo",
  "listar_opciones_panel",
  "buscar_producto",
  "obtener_escenarios",
]) {
  const forced = forceListaWeb(name, { lista: "venta", flete: 440, q: "isodec" });
  assert.equal(forced.lista, "web", `${name} must force lista web`);
  assert.equal(forced.flete, 440, `${name} only rewrites lista, not flete`);
  assert.equal(forced.q, "isodec");
}

{
  const calc = forceListaWeb("calcular_cotizacion", { lista: "venta", listaPrecios: "venta", flete: 99 });
  assert.equal(calc.lista, "venta", "calc rewrites listaPrecios, not lista");
  assert.equal(calc.listaPrecios, "web");
  assert.equal(calc.flete, 0);
}

for (const name of [...STOREFRONT_SHOP_TOOLS, "capture_lead", "handoff_whatsapp", "add_quote_to_cart", ""]) {
  const poisoned = forceListaWeb(name, { lista: "venta", flete: 252, handle: "isodec" });
  assert.equal(poisoned.lista, "venta", `${name || "(empty)"} must not rewrite lista`);
  assert.equal(poisoned.flete, 252, `${name || "(empty)"} must not zero flete`);
}

assert.deepEqual(forceListaWeb("obtener_catalogo", null), { lista: "web" });
assert.deepEqual(forceListaWeb("buscar_producto", "venta"), { lista: "web" });
assert.deepEqual(forceListaWeb("shop_search", null), {});

console.log("storefrontForceListaCatalogGates.test.js: ok");
