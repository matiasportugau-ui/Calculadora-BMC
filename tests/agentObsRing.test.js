/**
 * IMP-06 / IMP-12 — in-memory obs ring for hub cost + p95.
 */
import assert from "node:assert/strict";
import {
  recordObsSample,
  getObsSummary,
  percentile,
  sanitizeProviderKey,
  __obsRingTest,
} from "../server/lib/agentObsRing.js";

const ringCtl = __obsRingTest();
ringCtl.reset();

assert.equal(percentile([1, 2, 3, 4, 5], 50), 3);
assert.equal(percentile([], 95), null);

recordObsSample({
  kind: "cost",
  provider: "gemini",
  estimated_cost_usd: 0.01,
  latency_ms: 100,
});
recordObsSample({
  kind: "turn",
  provider: "grok",
  estimated_cost_usd: 0.02,
  latency_ms: 500,
  ttft_ms: 200,
});
recordObsSample({
  kind: "turn",
  provider: "grok",
  latency_ms: 900,
});

const s = getObsSummary({ windowMs: 60_000 });
assert.equal(s.sample_count, 3);
// Only cost-kind samples with estimated_cost_usd contribute (0.01 + 0.02).
assert.ok(s.cost.sum_usd >= 0.029 && s.cost.sum_usd <= 0.031);
assert.ok(s.latency.p50_ms != null);
assert.ok(s.latency.p95_ms != null);
assert.ok(s.by_provider.grok?.count >= 2);

// Turn samples without cost must not inflate sum when only latency is set
ringCtl.reset();
recordObsSample({ kind: "turn", provider: "claude", latency_ms: 100 });
recordObsSample({ kind: "cost", provider: "claude", estimated_cost_usd: 0.05, latency_ms: 100 });
const s2 = getObsSummary({ windowMs: 60_000 });
assert.equal(s2.cost.count_with_cost, 1);
assert.ok(Math.abs(s2.cost.sum_usd - 0.05) < 1e-9);

// Prototype-pollution keys must not mutate Object.prototype when summarizing.
assert.equal(sanitizeProviderKey("__proto__"), "unknown");
assert.equal(sanitizeProviderKey("constructor"), "unknown");
ringCtl.reset();
recordObsSample({ kind: "cost", provider: "__proto__", estimated_cost_usd: 1, latency_ms: 10 });
recordObsSample({ kind: "cost", provider: "constructor", estimated_cost_usd: 2, latency_ms: 20 });
recordObsSample({ kind: "cost", provider: "claude", estimated_cost_usd: 0.01, latency_ms: 30 });
const s3 = getObsSummary({ windowMs: 60_000 });
assert.equal(s3.by_provider.unknown?.count, 2);
assert.equal(s3.by_provider.claude?.count, 1);
assert.equal(Object.prototype.count, undefined);
assert.equal(Object.prototype.cost_usd, undefined);

ringCtl.reset();
console.log("agentObsRing.test.js: ok");
