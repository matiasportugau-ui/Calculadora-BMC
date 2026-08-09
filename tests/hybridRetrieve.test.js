import assert from "node:assert/strict";
import { fuseRagAndKb } from "../server/lib/hybridRetrieve.js";

const { fused, blockExtras } = fuseRagAndKb({
  query: "techo ISODEC EPS 100mm galpon",
  ragQuotes: [
    {
      lead_id: "L1",
      similarity: 0.9,
      metadata: { familia: "ISODEC_EPS", fecha: "2026-01-01" },
    },
  ],
  kbExamples: [
    {
      id: "kb1",
      question: "Cotizacion techo ISODEC 100mm",
      goodAnswer: "Usar lista web",
      matchScore: 8,
    },
  ],
  alpha: 0.7,
  beta: 0.3,
  topK: 5,
});

assert.ok(fused.length >= 1);
assert.ok(fused[0].fused_score > 0);
assert.ok(typeof blockExtras === "string");

const empty = fuseRagAndKb({ query: "x", ragQuotes: [], kbExamples: [] });
assert.equal(empty.fused.length, 0);

console.log("hybridRetrieve.test.js: ok");
