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
} = await import("../server/lib/agentCore.js");

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

  it("retains the last failure reason for the control panel", () => {
    const now = Date.now();
    recordProviderFailure("claude", now, {
      status: 400,
      type: "invalid_request_error",
      detail: "credit balance is too low",
      model: "claude-x",
    });
    const le = getProviderCooldownState().claude?.lastError;
    assert.equal(le?.status, 400);
    assert.equal(le?.type, "invalid_request_error");
    assert.match(le?.detail, /credit balance/);
    assert.equal(typeof le?.at, "number");
  });

  it("clears the last error on a subsequent success", () => {
    const now = Date.now();
    recordProviderFailure("grok", now, { status: 400, detail: "Incorrect API key" });
    assert.ok(getProviderCooldownState().grok?.lastError);
    recordProviderSuccess("grok");
    assert.equal(getProviderCooldownState().grok?.lastError, null);
  });
});
