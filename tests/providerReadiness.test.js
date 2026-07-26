// tests/providerReadiness.test.js — status builders + aggregate structure
import assert from "node:assert/strict";
import {
  buildProviderStatus,
  lightForReason,
  keyMeta,
  filterProvidersForPicker,
  aiOptionsRequireLive,
  _clearReadinessCache,
  mapProbeErrorToReasonCode,
} from "../server/lib/providerReadiness.js";
import { _resetProviderHealth } from "../server/lib/providerCircuitBreaker.js";

_clearReadinessCache();
_resetProviderHealth();

// keyMeta never exposes full key
{
  const m = keyMeta("sk-ant-api03-ABCDEFGHIJKLMNOP");
  assert.equal(m.length, "sk-ant-api03-ABCDEFGHIJKLMNOP".length);
  assert.equal(m.prefix, "sk-ant");
  assert.ok(m.prefix.length <= 8);
}

// missing key → red not_ready
{
  const s = buildProviderStatus("claude", null, { configured: false, key: "", reasonCode: "missing_key" });
  assert.equal(s.light, "red");
  assert.equal(s.state, "not_ready");
  assert.equal(s.reasonCode, "missing_key");
  assert.equal(s.configured, false);
  assert.equal(s.live, false);
}

// simulated 401 probe → auth_failed red
{
  const probe = {
    ok: false,
    reasonCode: mapProbeErrorToReasonCode({ status: 401, message: "Unauthorized" }),
    model: "gemini-2.5-flash",
    latencyMs: 12,
    status: 401,
  };
  assert.equal(probe.reasonCode, "auth_failed");
  const s = buildProviderStatus("gemini", probe, {
    configured: true,
    key: "AIzaSyRealLookingKeyValue1234567890abcd",
  });
  assert.equal(s.light, "red");
  assert.equal(s.state, "not_ready");
  assert.equal(s.reasonCode, "auth_failed");
  assert.equal(s.live, false);
  assert.equal(s.configured, true);
}

// billing
{
  const probe = {
    ok: false,
    reasonCode: mapProbeErrorToReasonCode({
      status: 400,
      message: "Your credit balance is too low",
    }),
    model: "claude-haiku-4-5-20251001",
    latencyMs: 50,
    status: 400,
  };
  assert.equal(probe.reasonCode, "billing");
  const s = buildProviderStatus("claude", probe, {
    configured: true,
    key: "sk-ant-api03-" + "x".repeat(40),
  });
  assert.equal(s.reasonCode, "billing");
  assert.equal(s.light, "red");
}

// 200 OK → green ready
{
  const probe = { ok: true, reasonCode: "ok", model: "gemini-2.5-flash", latencyMs: 100, text: "OK" };
  const s = buildProviderStatus("gemini", probe, {
    configured: true,
    key: "AIzaSyRealLookingKeyValue1234567890abcd",
  });
  assert.equal(s.light, "green");
  assert.equal(s.state, "ready");
  assert.equal(s.reasonCode, "ok");
  assert.equal(s.live, true);
  assert.equal(s.modelProbed, "gemini-2.5-flash");
}

// rate limited → amber degraded
{
  const probe = {
    ok: false,
    reasonCode: mapProbeErrorToReasonCode({ status: 429, message: "Rate limit exceeded" }),
    model: "gpt-4o-mini",
    latencyMs: 30,
    status: 429,
  };
  assert.equal(probe.reasonCode, "rate_limited");
  const s = buildProviderStatus("openai", probe, {
    configured: true,
    key: "sk-proj-" + "a".repeat(40),
  });
  assert.equal(s.state, "degraded");
  assert.equal(s.light, "amber");
}

// lightForReason
assert.equal(lightForReason("ok", "ready"), "green");
assert.equal(lightForReason("rate_limited", "degraded"), "amber");
assert.equal(lightForReason("auth_failed", "not_ready"), "red");

// picker filter with require live
{
  const rows = [
    { id: "claude", state: "not_ready" },
    { id: "gemini", state: "ready" },
    { id: "openai", state: "degraded" },
    { id: "grok", state: "not_ready" },
  ];
  // force require-live path
  const prev = process.env.AI_OPTIONS_REQUIRE_LIVE;
  process.env.AI_OPTIONS_REQUIRE_LIVE = "1";
  assert.equal(aiOptionsRequireLive(), true);
  const filtered = filterProvidersForPicker(rows, ["claude", "gemini", "openai", "grok"]);
  assert.deepEqual(filtered, ["gemini", "openai"]);
  process.env.AI_OPTIONS_REQUIRE_LIVE = "0";
  assert.equal(aiOptionsRequireLive(), false);
  const all = filterProvidersForPicker(rows, ["claude", "gemini"]);
  assert.deepEqual(all, ["claude", "gemini"]);
  if (prev === undefined) delete process.env.AI_OPTIONS_REQUIRE_LIVE;
  else process.env.AI_OPTIONS_REQUIRE_LIVE = prev;
}

console.log("✅ providerReadiness tests OK");
