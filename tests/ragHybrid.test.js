/**
 * IMP-10 — hybrid RAG keyword boost (offline).
 */
import assert from "node:assert/strict";
import { keywordBoostForQuote } from "../server/lib/rag.js";

const high = keywordBoostForQuote("panel ISODEC 100mm techo 200m2", {
  panel_familia: "ISODEC_EPS",
  panel_espesor: 100,
  escenario: "solo_techo",
});
assert.ok(high > 0, "overlap should boost");

const low = keywordBoostForQuote("hola", { panel_familia: "ISOPANEL_EPS" });
assert.equal(low, 0);

console.log("ragHybrid.test.js: ok");
