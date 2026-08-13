// Bugs EA / EB — pared money flags (incl5852, inclCintaButilo, tipoEst, inclSell)
// must reach preview + get_calc_state liveResult.
// Run: node tests/paredMoneyFlagsPropagate.test.js

import assert from "node:assert/strict";
import { validateAndPreviewQuote } from "../server/lib/quotePayloadValidator.js";
import { executeTool } from "../server/lib/agentTools.js";
import { calcParedCompleto } from "../src/utils/calculations.js";
import { setListaPrecios } from "../src/data/constants.js";

setListaPrecios("web");

const paredBase = {
  familia: "ISOPANEL_EPS",
  espesor: "50",
  alto: 3.5,
  perimetro: 40,
  numEsqExt: 4,
  numEsqInt: 0,
  tipoEst: "metal",
  inclSell: true,
  color: "Blanco",
  aberturas: [],
};

const faithful = calcParedCompleto({
  ...paredBase,
  espesor: Number(paredBase.espesor),
  incl5852: true,
  inclCintaButilo: true,
});
assert.ok(faithful?.totales?.subtotalSinIVA > 0, "baseline calc ok");
assert.ok(
  (faithful.allItems || []).some((i) => i.sku === "PA5852"),
  "faithful path includes PA5852",
);

// EA — buildQuote preview must include PA5852 when payload sets incl5852
const preview = validateAndPreviewQuote({
  scenario: "solo_fachada",
  listaPrecios: "web",
  pared: { ...paredBase, incl5852: true, inclCintaButilo: true },
});
assert.equal(preview.valid, true, "preview valid");
assert.equal(
  preview.preview.subtotalUSD,
  +faithful.totales.subtotalSinIVA.toFixed(2),
  "Bug EA: preview subtotal must match UI/engine with incl5852+cinta",
);
assert.equal(
  preview.preview.totalItems,
  faithful.allItems.length,
  "Bug EA: preview item count must include PA5852 line",
);

const previewOff = validateAndPreviewQuote({
  scenario: "solo_fachada",
  listaPrecios: "web",
  pared: { ...paredBase, incl5852: false },
});
assert.ok(
  preview.preview.subtotalUSD - previewOff.preview.subtotalUSD > 400,
  "incl5852 must move money in preview",
);

// EB — get_calc_state liveResult must forward flags from calcState.pared
const toolRaw = await executeTool(
  "get_calc_state",
  {},
  {
    scenario: "solo_fachada",
    listaPrecios: "web",
    pared: { ...paredBase, incl5852: true, inclCintaButilo: true },
  },
);
const tool = typeof toolRaw === "string" ? JSON.parse(toolRaw) : toolRaw;
assert.ok(tool?.liveResult, "get_calc_state returns liveResult");
const liveSub = Number(tool.liveResult.subtotalSinIVA);
assert.ok(!Number.isNaN(liveSub) && liveSub > 0, `liveResult subtotal present: ${liveSub}`);
assert.equal(
  +liveSub.toFixed(2),
  +faithful.totales.subtotalSinIVA.toFixed(2),
  "Bug EB: get_calc_state must not drop incl5852/inclCintaButilo",
);

console.log("✅ paredMoneyFlagsPropagate (Bugs EA/EB) OK");
