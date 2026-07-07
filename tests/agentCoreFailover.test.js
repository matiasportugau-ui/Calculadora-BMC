// PR4 — agentCore failover hardening: per-provider timeout + cooldown.
// Unit-tests the pure guards (the full callAgentOnce path needs SDK mocking,
// which the repo defers). Run: node --test tests/agentCoreFailover.test.js

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

const {
  callWithTimeout,
  recordProviderFailure,
  recordProviderSuccess,
  getProviderCooldownState,
  _resetProviderHealth,
  normalizeGeminiContents,
} = await import("../server/lib/agentCore.js");

function assertGeminiContentsAreValid(contents) {
  assert.ok(contents.length > 0, "contents are not empty");
  assert.equal(contents[0].role, "user", "Gemini contents start with user");
  assert.equal(contents[contents.length - 1].role, "user", "Gemini contents end with user");
  for (let i = 1; i < contents.length; i += 1) {
    assert.notEqual(contents[i].role, contents[i - 1].role, `roles alternate at index ${i}`);
  }
}

describe("callWithTimeout", () => {
  it("resolves a fast call and forwards an AbortSignal", async () => {
    let sawSignal = false;
    const out = await callWithTimeout(
      (signal) => {
        sawSignal = signal instanceof AbortSignal;
        return Promise.resolve("ok");
      },
      1000,
      "fast",
    );
    assert.equal(out, "ok");
    assert.equal(sawSignal, true);
  });

  it("rejects with PROVIDER_TIMEOUT when the call hangs past the deadline", async () => {
    const started = Date.now();
    await assert.rejects(
      () => callWithTimeout(() => new Promise(() => {}), 40, "hung"),
      (err) => err.code === "PROVIDER_TIMEOUT" && /timed out/.test(err.message),
    );
    // sanity: it returned near the deadline, not much later
    assert.ok(Date.now() - started < 500);
  });

  it("aborts the signal on timeout (SDKs that honor it can cancel)", async () => {
    let aborted = false;
    await assert.rejects(() =>
      callWithTimeout((signal) => {
        signal.addEventListener("abort", () => { aborted = true; });
        return new Promise(() => {});
      }, 30, "abortme"),
    );
    assert.equal(aborted, true);
  });

  it("propagates a real error from the call unchanged", async () => {
    await assert.rejects(
      () => callWithTimeout(() => Promise.reject(new Error("boom")), 1000, "err"),
      /boom/,
    );
  });
});

describe("provider cooldown", () => {
  beforeEach(() => _resetProviderHealth());

  it("is not cooling down before the failure threshold", () => {
    const now = Date.now();
    recordProviderFailure("grok", now);
    recordProviderFailure("grok", now);
    assert.equal(getProviderCooldownState().grok?.coolingDown, false);
    assert.equal(getProviderCooldownState().grok?.recentFailures, 2);
  });

  it("enters cooldown after N failures within the window", () => {
    const now = Date.now();
    recordProviderFailure("grok", now);
    recordProviderFailure("grok", now);
    recordProviderFailure("grok", now); // 3rd → cooldown
    const st = getProviderCooldownState().grok;
    assert.equal(st.coolingDown, true);
    assert.ok(st.until > now);
  });

  it("a success clears the failure streak (no cooldown)", () => {
    const now = Date.now();
    recordProviderFailure("gemini", now);
    recordProviderFailure("gemini", now);
    recordProviderSuccess("gemini");
    recordProviderFailure("gemini", now); // streak reset → only 1 recent
    assert.equal(getProviderCooldownState().gemini?.coolingDown, false);
    assert.equal(getProviderCooldownState().gemini?.recentFailures, 1);
  });

  it("stale failures outside the window do not accumulate into cooldown", () => {
    const now = Date.now();
    recordProviderFailure("openai", now - 120_000); // outside 60s window
    recordProviderFailure("openai", now - 120_000);
    recordProviderFailure("openai", now); // only this one is recent
    assert.equal(getProviderCooldownState().openai?.coolingDown, false);
  });
});

describe("normalizeGeminiContents", () => {
  it("collapses WA legacy bursts with consecutive user turns into one valid user turn", () => {
    const contents = normalizeGeminiContents([
      { role: "user", content: "598111: Hola" },
      { role: "user", content: "598111: Necesito techo" },
      { role: "user", content: "598111: 6 por 4" },
    ]);
    assertGeminiContentsAreValid(contents);
    assert.equal(contents.length, 1);
    assert.equal(contents[0].role, "user");
    assert.match(contents[0].parts[0].text, /Necesito techo/);
    assert.match(contents[0].parts[0].text, /6 por 4/);
  });

  it("preserves valid alternating histories", () => {
    const contents = normalizeGeminiContents([
      { role: "user", content: "Hola" },
      { role: "assistant", content: "¿Qué necesitás cotizar?" },
      { role: "user", content: "Un techo de 10x5" },
    ]);
    assertGeminiContentsAreValid(contents);
    assert.deepEqual(contents.map((c) => c.role), ["user", "model", "user"]);
  });

  it("keeps leading assistant/operator context without sending a leading model turn", () => {
    const contents = normalizeGeminiContents([
      { role: "assistant", content: "Mensaje saliente previo del operador" },
      { role: "user", content: "Cliente respondió con medidas" },
    ]);
    assertGeminiContentsAreValid(contents);
    assert.equal(contents.length, 1);
    assert.match(contents[0].parts[0].text, /Mensaje saliente previo del operador/);
    assert.match(contents[0].parts[0].text, /Cliente respondió con medidas/);
  });

  it("reprompts with the last user when history ends on a model turn", () => {
    const contents = normalizeGeminiContents([
      { role: "user", content: "Cotizá 20 m2" },
      { role: "assistant", content: "¿Qué espesor?" },
    ], "Cotizá 20 m2");
    assertGeminiContentsAreValid(contents);
    assert.deepEqual(contents.map((c) => c.role), ["user", "model", "user"]);
    assert.equal(contents[2].parts[0].text, "Cotizá 20 m2");
  });
});
