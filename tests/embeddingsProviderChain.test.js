/**
 * Offline pins for #1012 multi-provider embeddings chain.
 * Run: node tests/embeddingsProviderChain.test.js
 */
import assert from "node:assert/strict";
import {
  resolveEmbeddingsProviderChain,
  isEmbeddingsQuotaOrAuthError,
  __clearEmbeddingsDeadMarksForTests,
} from "../server/lib/embeddings.js";

__clearEmbeddingsDeadMarksForTests();

console.log("embeddingsProviderChain — pin / auto / stub");

assert.deepEqual(
  resolveEmbeddingsProviderChain({ override: "stub", openaiKeyOk: true, geminiKeyOk: true }),
  [],
  "stub override → empty chain (embedText uses deterministic stub)",
);

assert.deepEqual(
  resolveEmbeddingsProviderChain({ override: "openai", openaiKeyOk: true, geminiKeyOk: true }),
  ["openai"],
  "openai pin with usable key → openai only",
);

assert.deepEqual(
  resolveEmbeddingsProviderChain({ override: "openai", openaiKeyOk: false, geminiKeyOk: true }),
  [],
  "openai pin without usable key → empty (no silent gemini under pin)",
);

assert.deepEqual(
  resolveEmbeddingsProviderChain({ override: "gemini", openaiKeyOk: true, geminiKeyOk: true }),
  ["gemini"],
  "gemini pin → gemini only",
);

assert.deepEqual(
  resolveEmbeddingsProviderChain({ override: "gemini", openaiKeyOk: true, geminiKeyOk: false }),
  [],
  "gemini pin without key → empty",
);

assert.deepEqual(
  resolveEmbeddingsProviderChain({ override: "auto", openaiKeyOk: true, geminiKeyOk: true }),
  ["openai", "gemini"],
  "auto with both keys → openai then gemini",
);

assert.deepEqual(
  resolveEmbeddingsProviderChain({ override: "", openaiKeyOk: false, geminiKeyOk: true }),
  ["gemini"],
  "auto without openai → gemini only (fallback path that unblocks RAG when OpenAI credits die)",
);

assert.deepEqual(
  resolveEmbeddingsProviderChain({ override: "auto", openaiKeyOk: false, geminiKeyOk: false }),
  [],
  "auto with no keys → empty → stub",
);

console.log("embeddingsProviderChain — dead-mark cooldown skips provider");

const now = 1_700_000_000_000;
assert.deepEqual(
  resolveEmbeddingsProviderChain({
    override: "auto",
    openaiKeyOk: true,
    geminiKeyOk: true,
    nowMs: now,
    deadUntil: { openai: now + 60_000 },
  }),
  ["gemini"],
  "dead-marked openai skipped while gemini stays in chain",
);

assert.deepEqual(
  resolveEmbeddingsProviderChain({
    override: "auto",
    openaiKeyOk: true,
    geminiKeyOk: true,
    nowMs: now,
    deadUntil: { openai: now - 1 },
  }),
  ["openai", "gemini"],
  "expired dead-mark does not skip provider",
);

assert.deepEqual(
  resolveEmbeddingsProviderChain({
    override: "openai",
    openaiKeyOk: true,
    geminiKeyOk: true,
    nowMs: now,
    deadUntil: { openai: now + 60_000 },
  }),
  ["openai"],
  "explicit pin ignores dead-mark filter (pin path does not consult cooldown)",
);

console.log("embeddingsProviderChain — quota/auth error classification");

for (const status of [401, 402, 403, 429]) {
  assert.equal(
    isEmbeddingsQuotaOrAuthError({ status }),
    true,
    `HTTP ${status} → dead-mark`,
  );
}

assert.equal(isEmbeddingsQuotaOrAuthError({ status: 500 }), false, "500 is not quota/auth");
assert.equal(isEmbeddingsQuotaOrAuthError({ status: 400 }), false, "400 is not quota/auth");
assert.equal(
  isEmbeddingsQuotaOrAuthError(new Error("credit_balance_exhausted")),
  true,
  "credit message → dead-mark",
);
assert.equal(
  isEmbeddingsQuotaOrAuthError(new Error("insufficient_quota")),
  true,
  "quota message → dead-mark",
);
assert.equal(
  isEmbeddingsQuotaOrAuthError({ response: { status: 429 }, message: "rate" }),
  true,
  "nested response.status 429 → dead-mark",
);
assert.equal(
  isEmbeddingsQuotaOrAuthError(new Error("timeout talking to upstream")),
  false,
  "generic network message is not quota/auth",
);

__clearEmbeddingsDeadMarksForTests();
console.log("✅ embeddingsProviderChain tests OK");
