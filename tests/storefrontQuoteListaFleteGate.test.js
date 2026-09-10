/**
 * Storefront quote → /calc always lista web + flete 0.
 * #1203 pins those defaults when the payload omits lista/flete.
 * This file pins the override: attacker/model-supplied lista=venta or flete=N
 * must not reach cotizar (lista-venta underquote / freight on the shop PDF).
 * Run: node tests/storefrontQuoteListaFleteGate.test.js
 */
import assert from "node:assert/strict";
import { STOREFRONT_AGENT_CONFIG } from "../server/lib/voice/storefrontAgentConfig.js";
import { quotePayloadToCotizarBody } from "../server/lib/voice/storefrontQuoteCart.js";
import { forceListaWeb } from "../server/lib/voice/storefrontVoicePack.js";

console.log("storefrontQuoteListaFleteGate");

{
  assert.equal(STOREFRONT_AGENT_CONFIG.quote.lista, "web");
  assert.equal(STOREFRONT_AGENT_CONFIG.quote.shipping, "never");
  console.log("  ✓ public agent config is lista web / shipping never");
}

{
  const poisoned = quotePayloadToCotizarBody({
    lista: "venta",
    listaPrecios: "venta",
    flete: 440,
    scenario: "solo_techo",
    techo: { familia: "ISODEC_EPS", espesor: "100" },
  });
  assert.equal(poisoned.lista, "web", "payload.lista=venta must not win");
  assert.equal(poisoned.flete, 0, "payload.flete must be forced to 0");
  assert.equal(poisoned.source, "storefront-voice");
  assert.equal(poisoned.escenario, "solo_techo");
  assert.equal(poisoned.techo.familia, "ISODEC_EPS");
  assert.equal(Object.hasOwn(poisoned, "listaPrecios"), false);
  console.log("  ✓ quotePayloadToCotizarBody ignores attacker lista/flete");
}

{
  const calc = forceListaWeb("calcular_cotizacion", {
    listaPrecios: "venta",
    flete: 252,
    scenario: "completo",
    techo: { familia: "ISOROOF" },
  });
  assert.equal(calc.listaPrecios, "web");
  assert.equal(calc.flete, 0);
  assert.equal(calc.scenario, "completo", "non-price fields pass through");
  assert.equal(calc.techo.familia, "ISOROOF");

  const pdf = forceListaWeb("generar_pdf", { listaPrecios: "venta", flete: 440 });
  assert.equal(pdf.listaPrecios, "web");
  assert.equal(pdf.flete, 0);

  const price = forceListaWeb("obtener_precio_panel", {
    familia: "ISODEC_EPS",
    lista: "venta",
  });
  assert.equal(price.lista, "web");
  console.log("  ✓ forceListaWeb still zeros flete / lista venta on calc+PDF+precio");
}

console.log("storefrontQuoteListaFleteGate: ok");
