/**
 * IMP-06 / IMP-12 residual — in-process ring of cost + turn latency samples.
 * Powers GET /api/agent/obs-summary for hub $/day + p50/p95 (per-revision, cold-start resets).
 * Cloud Logging remains SoT for multi-day invoice-grade spend (see cost-query.md).
 */

const MAX = 2000;
/** @type {Array<{ts:number, kind:string, provider?:string|null, model?:string|null, channel?:string|null, estimated_cost_usd?:number|null, latency_ms?:number|null, ttft_ms?:number|null, source?:string|null}>} */
const ring = [];

/**
 * @param {object} sample
 */
export function recordObsSample(sample = {}) {
  const ts = Date.now();
  const cost =
    sample.estimated_cost_usd == null || sample.estimated_cost_usd === ""
      ? null
      : Number(sample.estimated_cost_usd);
  const lat =
    sample.latency_ms == null || sample.latency_ms === ""
      ? null
      : Number(sample.latency_ms);
  const ttft =
    sample.ttft_ms == null || sample.ttft_ms === ""
      ? null
      : Number(sample.ttft_ms);
  ring.push({
    ts,
    kind: String(sample.kind || "turn"),
    provider: sample.provider ?? null,
    model: sample.model ?? null,
    channel: sample.channel ?? null,
    estimated_cost_usd: Number.isFinite(cost) ? cost : null,
    latency_ms: Number.isFinite(lat) ? lat : null,
    ttft_ms: Number.isFinite(ttft) ? ttft : null,
    source: sample.source ?? null,
  });
  if (ring.length > MAX) ring.splice(0, ring.length - MAX);
}

/**
 * @param {number} [windowMs]
 * @returns {typeof ring}
 */
function inWindow(windowMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - Math.max(60_000, windowMs);
  return ring.filter((r) => r.ts >= cutoff);
}

/**
 * @param {number[]} values
 * @param {number} p 0-100
 */
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

/**
 * @param {{ windowMs?: number }} [opts]
 */
export function getObsSummary(opts = {}) {
  const windowMs = opts.windowMs ?? 24 * 60 * 60 * 1000;
  const rows = inWindow(windowMs);
  const costs = rows
    .map((r) => r.estimated_cost_usd)
    .filter((n) => n != null && Number.isFinite(n) && n >= 0);
  const lats = rows
    .map((r) => r.latency_ms)
    .filter((n) => n != null && Number.isFinite(n) && n >= 0);
  const ttfts = rows
    .map((r) => r.ttft_ms)
    .filter((n) => n != null && Number.isFinite(n) && n >= 0);

  const byProvider = {};
  for (const r of rows) {
    const k = r.provider || "unknown";
    if (!byProvider[k]) {
      byProvider[k] = { count: 0, cost_usd: 0, latency_samples: [] };
    }
    byProvider[k].count += 1;
    if (r.estimated_cost_usd != null) byProvider[k].cost_usd += r.estimated_cost_usd;
    if (r.latency_ms != null) byProvider[k].latency_samples.push(r.latency_ms);
  }
  const providers = {};
  for (const [k, v] of Object.entries(byProvider)) {
    providers[k] = {
      count: v.count,
      cost_usd: Number(v.cost_usd.toFixed(6)),
      p50_latency_ms: percentile(v.latency_samples, 50),
      p95_latency_ms: percentile(v.latency_samples, 95),
    };
  }

  return {
    source: "memory_ring",
    window_ms: windowMs,
    sample_count: rows.length,
    ring_capacity: MAX,
    cost: {
      sum_usd: Number(costs.reduce((a, b) => a + b, 0).toFixed(6)),
      count_with_cost: costs.length,
      note:
        "Per-revision in-memory estimate only. Multi-day / multi-instance: Cloud Logging cost-query.md",
    },
    latency: {
      count: lats.length,
      p50_ms: percentile(lats, 50),
      p95_ms: percentile(lats, 95),
      p99_ms: percentile(lats, 99),
      ttft_p50_ms: percentile(ttfts, 50),
      ttft_p95_ms: percentile(ttfts, 95),
    },
    by_provider: providers,
    generated_at: new Date().toISOString(),
  };
}

/** @internal tests */
export function __obsRingTest() {
  return {
    reset() {
      ring.length = 0;
    },
    size() {
      return ring.length;
    },
  };
}
