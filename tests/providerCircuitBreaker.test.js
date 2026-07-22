import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  orderChainByHealth,
  recordProviderFailure,
  recordProviderSuccess,
  _resetProviderHealth,
  isCoolingDown,
} from "../server/lib/providerCircuitBreaker.js";

describe("orderChainByHealth", () => {
  beforeEach(() => _resetProviderHealth());

  it("puts cooling providers last", () => {
    const now = Date.now();
    // trip grok into cooldown (3 failures)
    recordProviderFailure("grok", now);
    recordProviderFailure("grok", now);
    recordProviderFailure("grok", now);
    assert.equal(isCoolingDown("grok", now), true);
    const ordered = orderChainByHealth(["grok", "claude", "gemini"], now);
    assert.deepEqual(ordered, ["claude", "gemini", "grok"]);
  });

  it("leaves single-provider chains alone", () => {
    assert.deepEqual(orderChainByHealth(["claude"]), ["claude"]);
  });

  it("success restores original preference order when no one is cooling", () => {
    const now = Date.now();
    recordProviderFailure("claude", now, { status: 401, detail: "bad key" });
    recordProviderSuccess("claude");
    assert.equal(isCoolingDown("claude", now), false);
    assert.deepEqual(orderChainByHealth(["claude", "gemini"], now), ["claude", "gemini"]);
  });
});
