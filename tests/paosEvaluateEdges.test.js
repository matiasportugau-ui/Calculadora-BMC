/**
 * PAOS offline money-guard edges (#777) — prevent Training KB pollution
 * with invented prices / improvised-language answers.
 *
 * Complements the smoke checks in paosPromote.test.js with edge patterns
 * that the G2 promote path relies on before writing KB entries.
 *
 * Run: node --test tests/paosEvaluateEdges.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCandidateOffline,
  isMoneyAdjacent,
} from "../server/lib/paosEvaluate.js";

describe("isMoneyAdjacent edge patterns", () => {
  it("detects IVA 22% and m² amount shapes", () => {
    assert.equal(isMoneyAdjacent({ goodAnswer: "aplica IVA 22%" }), true);
    assert.equal(isMoneyAdjacent({ goodAnswer: "U$S 1200 total" }), true);
    assert.equal(isMoneyAdjacent({ goodAnswer: "48,50 / m2" }), true);
  });

  it("precio/price alone is not money-adjacent without digits", () => {
    assert.equal(isMoneyAdjacent({ goodAnswer: "consultar precio de lista" }), false);
    assert.equal(isMoneyAdjacent({ goodAnswer: "el precio depende del espesor 100" }), true);
  });

  it("empty / non-money technical answers stay non-adjacent", () => {
    assert.equal(isMoneyAdjacent({}), false);
    assert.equal(isMoneyAdjacent({ goodAnswer: "babeta de encuentro" }), false);
  });
});

describe("evaluateCandidateOffline structural gates", () => {
  it("rejects short question or short answer", () => {
    const shortQ = evaluateCandidateOffline({
      delta: { question: "ok", goodAnswer: "respuesta suficientemente larga" },
    });
    assert.equal(shortQ.pass, false);
    assert.equal(shortQ.details.checks.question, "fail_too_short");

    const shortA = evaluateCandidateOffline({
      delta: { question: "qué es babeta?", goodAnswer: "corta" },
    });
    assert.equal(shortA.pass, false);
    assert.equal(shortA.details.checks.goodAnswer, "fail_too_short");
  });

  it("accepts ae_agent / calc_oracle / calcResult provenance for money", () => {
    for (const proven of [
      { calcProvenance: "ae_agent" },
      { source: "calc_oracle" },
      { calcResult: { totalFinal: 1200 } },
    ]) {
      const r = evaluateCandidateOffline({
        delta: {
          question: "precio isodec 100 techo 20x10?",
          goodAnswer: "USD 45/m2 según calculadora BMC",
          ...proven,
        },
      });
      assert.equal(r.pass, true, `expected pass for ${JSON.stringify(proven)}`);
      assert.equal(r.details.checks.money, "ok_with_provenance");
    }
  });

  it("rejects improvised-price language even with money signals", () => {
    const r = evaluateCandidateOffline({
      delta: {
        question: "cuánto sale un galpón 20x10?",
        goodAnswer: "Aproximadamente USD 4500 sin herramienta",
        calcProvenance: true,
        totalUsd: 4500,
      },
    });
    assert.equal(r.pass, false);
    assert.equal(r.details.checks.honesty, "fail_improvised_language");
  });
});
