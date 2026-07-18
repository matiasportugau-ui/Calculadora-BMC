/**
 * Offline tests for costTelemetry module.
 */
import assert from "node:assert/strict";
import { logAgentCost, isPlausibleCost } from "../server/lib/costTelemetry.js";

const logs = [];
const fakeLogger = {
  info(obj, msg) {
    logs.push({ obj, msg });
  },
};

const ev = logAgentCost(
  {
    event: "agent_core_call",
    provider: "claude",
    model: "test",
    estimated_cost_usd: 0.0012,
    input_tokens: 100,
    output_tokens: 20,
    source: "test",
  },
  fakeLogger,
);

assert.equal(ev.provider, "claude");
assert.equal(ev.estimated_cost_usd, 0.0012);
assert.equal(logs.length, 1);
assert.equal(logs[0].obj.event, "agent_core_call");

assert.equal(isPlausibleCost(0), true);
assert.equal(isPlausibleCost(0.5), true);
assert.equal(isPlausibleCost(-1), false);
assert.equal(isPlausibleCost(null), false);

console.log("costTelemetry.test.js: ok");
