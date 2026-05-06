/**
 * Per-tool telemetry: in-process ring buffer of agent tool invocations.
 *
 * Wraps executeTool so we can observe latency, error rate, and call count
 * per tool from a dev-panel tab without depending on log scraping.
 *
 * This is intentionally in-memory — Cloud Run cold-starts wipe it (24h
 * is plenty for the dev panel's purpose; long-term observability lives
 * in the structured pino logs we also emit).
 */

const MAX_RECORDS = 1000;
/** @type {Array<{ts:number, tool:string, ok:boolean, latencyMs:number, errorClass:string|null}>} */
const records = [];

/**
 * Append a record. Rotates to keep at most MAX_RECORDS most recent.
 */
export function recordToolCall({ tool, ok, latencyMs, errorClass = null }) {
  if (typeof tool !== "string" || !tool) return;
  records.push({
    ts: Date.now(),
    tool,
    ok: !!ok,
    latencyMs: Number.isFinite(latencyMs) ? +latencyMs.toFixed(2) : 0,
    errorClass: errorClass || null,
  });
  if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
}

/**
 * Compute p50/p95 from a sorted-ascending number array.
 * @param {number[]} sortedAsc
 * @param {number} p   percentile in [0, 1]
 */
function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor(p * sortedAsc.length));
  return +sortedAsc[idx].toFixed(2);
}

/**
 * Classify an error result string into a small set of buckets the dev
 * panel can color-code. Generic enough not to leak prompt content.
 * @param {string} errMsg
 * @returns {string}
 */
export function classifyError(errMsg) {
  const s = String(errMsg || "").toLowerCase();
  if (!s) return "other";
  if (s.includes("user_confirmed") || s.includes("confirmación")) return "guard:user_confirmed";
  if (s.includes("requerido") || s.includes("required")) return "validation:required";
  if (s.includes("no encontrad") || s.includes("not found")) return "lookup:not_found";
  if (s.includes("bmc_sheet_id") || s.includes("whatsapp no configurado") || s.includes("no configurado")) return "config:missing_env";
  if (s.includes("upstream") || s.includes("http ") || s.includes("graph.facebook")) return "network:upstream";
  if (s.includes("no implementada")) return "internal:unimplemented";
  return "other";
}

/**
 * @param {object} [opts]
 * @param {number} [opts.windowMs=86400000]  Look-back window in ms (default 24h)
 * @returns {{
 *   window_ms: number,
 *   total_calls: number,
 *   tools: Array<{
 *     tool: string,
 *     count: number,
 *     ok: number,
 *     errors: number,
 *     error_rate: number,
 *     latency_p50_ms: number,
 *     latency_p95_ms: number,
 *     last_ts: number|null,
 *     errors_by_class: Record<string, number>,
 *   }>
 * }}
 */
export function getToolStats({ windowMs = 24 * 60 * 60 * 1000 } = {}) {
  const cutoff = Date.now() - windowMs;
  const recent = records.filter((r) => r.ts >= cutoff);

  /** @type {Map<string, {count:number, ok:number, errors:number, latencies:number[], lastTs:number, errBuckets:Record<string,number>}>} */
  const byTool = new Map();

  for (const r of recent) {
    let bucket = byTool.get(r.tool);
    if (!bucket) {
      bucket = { count: 0, ok: 0, errors: 0, latencies: [], lastTs: 0, errBuckets: {} };
      byTool.set(r.tool, bucket);
    }
    bucket.count += 1;
    bucket.latencies.push(r.latencyMs);
    if (r.ok) {
      bucket.ok += 1;
    } else {
      bucket.errors += 1;
      const k = r.errorClass || "other";
      bucket.errBuckets[k] = (bucket.errBuckets[k] || 0) + 1;
    }
    if (r.ts > bucket.lastTs) bucket.lastTs = r.ts;
  }

  const tools = [...byTool.entries()].map(([tool, b]) => {
    const sorted = [...b.latencies].sort((a, b) => a - b);
    return {
      tool,
      count: b.count,
      ok: b.ok,
      errors: b.errors,
      error_rate: b.count > 0 ? +(b.errors / b.count).toFixed(3) : 0,
      latency_p50_ms: percentile(sorted, 0.5),
      latency_p95_ms: percentile(sorted, 0.95),
      last_ts: b.lastTs || null,
      errors_by_class: b.errBuckets,
    };
  });
  tools.sort((a, b) => b.count - a.count);

  return {
    window_ms: windowMs,
    total_calls: recent.length,
    tools,
  };
}

/** Test/admin reset. */
export function _resetToolStatsForTests() {
  records.length = 0;
}
