// PR3 — prompt caching split. buildSystemPromptParts() separates a cacheable
// static prefix from a per-request dynamic tail; buildSystemPrompt() stays
// byte-identical to the pre-split output. Pure (no SDK/network).
// Run: node --test tests/promptCacheSplit.test.js

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, buildSystemPromptParts } from "../server/lib/chatPrompts.js";

const CS_EMPTY = {};
const CS_A = { scenario: "solo_techo", techo: { familia: "ISODEC", espesor: 100, zonas: [{ largo: 6, ancho: 4 }] } };
const CS_B = { scenario: "solo_fachada", pared: { familia: "ISOROOF", espesor: 50, alto: 3, perimetro: 40 } };

describe("buildSystemPrompt stays byte-identical to the split join", () => {
  for (const [cs, opt, label] of [
    [CS_EMPTY, {}, "empty calcState"],
    [CS_A, { trainingExamples: [] }, "techo calcState"],
    [CS_B, { recentAssistantMessages: ["hola otra vez"] }, "pared + recent msgs"],
  ]) {
    it(`= staticPrefix + dynamicTail (${label})`, () => {
      const { staticPrefix, dynamicTail } = buildSystemPromptParts(cs, opt);
      const joined = [staticPrefix, dynamicTail].filter(Boolean).join("\n\n");
      assert.equal(joined, buildSystemPrompt(cs, opt));
    });
  }
});

describe("cache viability", () => {
  it("staticPrefix is IDENTICAL across different calcStates (so the cache hits)", () => {
    const a = buildSystemPromptParts(CS_A, { trainingExamples: [] }).staticPrefix;
    const b = buildSystemPromptParts(CS_B, { recentAssistantMessages: ["x"] }).staticPrefix;
    assert.equal(a, b);
  });

  it("the static prefix is the bulk of the prompt (>90% of chars)", () => {
    const { staticPrefix, dynamicTail } = buildSystemPromptParts(CS_A, {});
    const ratio = staticPrefix.length / (staticPrefix.length + dynamicTail.length);
    assert.ok(ratio > 0.9, `static prefix ratio ${ratio.toFixed(3)} should exceed 0.9`);
  });

  it("the static prefix carries the request-independent content (tools + prices)", () => {
    const { staticPrefix } = buildSystemPromptParts(CS_A, {});
    assert.ok(staticPrefix.includes("TOOLS DE CALCULADORA"), "tools block in prefix");
  });

  it("calcState lands ONLY in the dynamic tail, never the cached prefix", () => {
    const a = buildSystemPromptParts(CS_A, {});
    const b = buildSystemPromptParts(CS_B, {});
    // prefix identical (asserted above) ⇒ calcState cannot be in it; tails differ.
    assert.notEqual(a.dynamicTail, b.dynamicTail);
  });
});
