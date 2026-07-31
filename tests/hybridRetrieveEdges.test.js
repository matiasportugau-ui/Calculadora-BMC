/**
 * Hybrid RAG fuse edges (#783 IMP-10) — ranking, topK, accent fold, noise filter.
 * Base happy-path lives in hybridRetrieve.test.js; this locks sort/filter semantics
 * that steer which KB lines land in the agent prompt extras.
 *
 * Run: node --test tests/hybridRetrieveEdges.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fuseRagAndKb } from "../server/lib/hybridRetrieve.js";

describe("fuseRagAndKb ranking + filters", () => {
  it("sorts by fused_score descending and respects topK", () => {
    const { fused } = fuseRagAndKb({
      query: "techo isodec eps",
      ragQuotes: [
        {
          lead_id: "low",
          similarity: 0.2,
          metadata: { familia: "OTRO" },
        },
        {
          lead_id: "high",
          similarity: 0.95,
          metadata: { familia: "ISODEC_EPS", producto: "techo" },
        },
      ],
      kbExamples: [],
      alpha: 1,
      beta: 0,
      topK: 1,
    });
    assert.equal(fused.length, 1);
    assert.equal(fused[0].lead_id, "high");
    assert.ok(fused[0].fused_score >= 0.9);
  });

  it("folds accents so ISODEC matches isodéc", () => {
    const { fused } = fuseRagAndKb({
      query: "isodéc techo",
      ragQuotes: [
        {
          lead_id: "L",
          similarity: 0.5,
          metadata: { familia: "ISODEC_EPS", producto: "techo" },
        },
      ],
      kbExamples: [],
      alpha: 0.5,
      beta: 0.5,
      topK: 3,
    });
    assert.equal(fused.length, 1);
    assert.ok(fused[0].keyword_boost > 0, "accent-folded tokens should boost");
  });

  it("drops low-score KB noise below 0.05 fused_score", () => {
    const { fused, blockExtras } = fuseRagAndKb({
      query: "galpon metalico",
      ragQuotes: [],
      kbExamples: [
        {
          id: "noise",
          question: "zzz",
          goodAnswer: "yyy",
          matchScore: 0,
        },
        {
          id: "hit",
          question: "Cotizacion galpon metalico ISODEC",
          goodAnswer: "Usar lista web",
          matchScore: 9,
        },
      ],
      alpha: 0.7,
      beta: 0.3,
      topK: 5,
    });
    assert.ok(fused.every((x) => x.id !== "noise"));
    assert.ok(fused.some((x) => x.id === "hit"));
    assert.match(blockExtras, /KB híbrido/);
    assert.match(blockExtras, /Cotizacion galpon/);
  });

  it("never invents prices — metadata-only RAG rows", () => {
    const { fused, blockExtras } = fuseRagAndKb({
      query: "precio panel",
      ragQuotes: [
        {
          lead_id: "L9",
          similarity: 0.88,
          metadata: { familia: "ISODEC_EPS", notas: "ver calculadora" },
        },
      ],
      kbExamples: [],
      topK: 3,
    });
    assert.equal(fused[0].kind, "rag");
    assert.equal(fused[0].metadata.precio, undefined);
    assert.equal(blockExtras, "");
    const blob = JSON.stringify(fused);
    assert.equal(/\$\s*\d|usd\s*\d/i.test(blob), false);
  });
});
