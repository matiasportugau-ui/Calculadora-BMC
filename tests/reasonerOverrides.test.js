import assert from "node:assert/strict";
import {
  buildReasonerCallOptions,
  resolvePublicReasonerOptions,
} from "../server/lib/reasonerOverrides.js";

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`✗ ${label}`);
    console.error(err);
  }
}

check("accepts allowed public gemini override", () => {
  assert.deepEqual(
    resolvePublicReasonerOptions({
      reasonerProvider: "gemini",
      reasonerModel: "gemini-2.0-flash",
    }),
    {
      reasonerProvider: "gemini",
      reasonerModel: "gemini-2.0-flash",
    }
  );
});

check("rejects unsupported public provider", () => {
  assert.throws(
    () => resolvePublicReasonerOptions({ reasonerProvider: "openai" }),
    (err) => err?.status === 400
  );
});

check("rejects public model without provider", () => {
  assert.throws(
    () => resolvePublicReasonerOptions({ reasonerModel: "gemini-2.0-flash" }),
    (err) => err?.status === 400
  );
});

check("rejects unsupported public model", () => {
  assert.throws(
    () =>
      resolvePublicReasonerOptions({
        reasonerProvider: "gemini",
        reasonerModel: "gemini-not-allowed",
      }),
    (err) => err?.status === 400
  );
});

check("threads provider into reasoner call override", () => {
  assert.deepEqual(
    buildReasonerCallOptions({
      reasonerProvider: "gemini",
      reasonerModel: "gemini-2.0-flash",
      calcState: { foo: "bar" },
    }),
    {
      channel: "chat",
      calcState: { foo: "bar" },
      provider: "gemini",
      override: {
        provider: "gemini",
        model: "gemini-2.0-flash",
      },
    }
  );
});

check("rejects internal model override without provider", () => {
  assert.throws(
    () => buildReasonerCallOptions({ reasonerModel: "gemini-2.0-flash" }),
    /reasonerModel requires reasonerProvider/
  );
});

console.log(`\n${failed === 0 ? "✅" : "❌"} reasonerOverrides: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
