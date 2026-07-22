/**
 * Per-tool telemetry: in-process ring buffer + optional Postgres persistence (B-05).
 *
 * Memory ring survives only the process lifetime (Cloud Run cold-starts wipe it).
 * When DATABASE_URL is set, each call is also inserted into public.agent_tool_calls
 * (fire-and-forget). GET /api/agent/tool-stats prefers DB aggregates when available.
 *
 * Structured pino logs from executeTool remain the Cloud Logging path.
 */

import pg from "pg";

const MAX_RECORDS = 1000;
/** @type {Array<{ts:number, tool:string, ok:boolean, latencyMs:number, errorClass:string|null}>} */
const records = [];

let pool = null;
let _testPool = null;
let schemaReady = false;
let schemaPromise = null;

/**
 * @returns {import('pg').Pool | null}
 */
function getPool() {
  if (_testPool) return _testPool;
  const url = process.env.DATABASE_URL || "";
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      max: 3,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 30_000,
    });
    pool.on("error", () => {
      /* idle client errors — ignore */
    });
  }
  return pool;
}

/** Test-only inject / reset. */
export const __test__ = {
  setPool(p) {
    _testPool = p;
    schemaReady = false;
    schemaPromise = null;
  },
  resetPool() {
    _testPool = null;
    schemaReady = false;
    schemaPromise = null;
  },
};

async function ensureSchema(db) {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.agent_tool_calls (
        id           bigserial PRIMARY KEY,
        ts           timestamptz NOT NULL DEFAULT now(),
        tool         text        NOT NULL,
        ok           boolean     NOT NULL,
        latency_ms   real        NOT NULL DEFAULT 0,
        error_class  text
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS agent_tool_calls_ts_idx
        ON public.agent_tool_calls (ts DESC)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS agent_tool_calls_tool_ts_idx
        ON public.agent_tool_calls (tool, ts DESC)
    `);
    schemaReady = true;
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });
  return schemaPromise;
}

/**
 * Append a record. Rotates to keep at most MAX_RECORDS most recent.
 * Also schedules durable insert when Postgres is configured.
 */
export function recordToolCall({ tool, ok, latencyMs, errorClass = null }) {
  if (typeof tool !== "string" || !tool) return;
  const row = {
    ts: Date.now(),
    tool,
    ok: !!ok,
    latencyMs: Number.isFinite(latencyMs) ? +latencyMs.toFixed(2) : 0,
    errorClass: errorClass || null,
  };
  records.push(row);
  if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);

  // Fire-and-forget durable write (never blocks tool execution).
  void persistToolCall(row).catch(() => {});
}

/**
 * @param {{ ts: number, tool: string, ok: boolean, latencyMs: number, errorClass: string|null }} row
 */
export async function persistToolCall(row) {
  const db = getPool();
  if (!db) return { ok: false, reason: "no_db" };
  await ensureSchema(db);
  await db.query(
    `INSERT INTO public.agent_tool_calls (ts, tool, ok, latency_ms, error_class)
     VALUES (to_timestamp($1 / 1000.0), $2, $3, $4, $5)`,
    [row.ts, row.tool, row.ok, row.latencyMs, row.errorClass],
  );
  return { ok: true };
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
 * Aggregate from a list of raw records (memory or DB-mapped).
 * @param {Array<{ts:number, tool:string, ok:boolean, latencyMs:number, errorClass:string|null}>} recent
 * @param {number} windowMs
 */
function aggregateRecords(recent, windowMs) {
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

/**
 * Sync in-memory stats (tests + fallback when DB unavailable).
 * @param {object} [opts]
 * @param {number} [opts.windowMs=86400000]
 */
export function getToolStats({ windowMs = 24 * 60 * 60 * 1000 } = {}) {
  const cutoff = Date.now() - windowMs;
  const recent = records.filter((r) => r.ts >= cutoff);
  return { ...aggregateRecords(recent, windowMs), source: "memory" };
}

/**
 * Load raw rows from Postgres for the window.
 * @param {number} windowMs
 * @returns {Promise<Array<{ts:number, tool:string, ok:boolean, latencyMs:number, errorClass:string|null}>|null>}
 */
export async function loadToolCallRowsFromDb(windowMs) {
  const db = getPool();
  if (!db) return null;
  try {
    await ensureSchema(db);
    const cutoff = new Date(Date.now() - windowMs);
    const { rows } = await db.query(
      `SELECT EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms,
              tool,
              ok,
              latency_ms,
              error_class
         FROM public.agent_tool_calls
        WHERE ts >= $1
        ORDER BY ts ASC
        LIMIT 50000`,
      [cutoff],
    );
    return rows.map((r) => ({
      ts: Number(r.ts_ms),
      tool: r.tool,
      ok: !!r.ok,
      latencyMs: Number(r.latency_ms) || 0,
      errorClass: r.error_class || null,
    }));
  } catch {
    return null;
  }
}

/**
 * Prefer durable DB aggregates; fall back to memory.
 * @param {object} [opts]
 * @param {number} [opts.windowMs]
 */
export async function getToolStatsAsync({ windowMs = 24 * 60 * 60 * 1000 } = {}) {
  const mem = getToolStats({ windowMs });
  const dbRows = await loadToolCallRowsFromDb(windowMs);
  if (!dbRows) {
    return { ...mem, source: "memory" };
  }
  if (dbRows.length === 0 && mem.total_calls > 0) {
    // Fresh process wrote memory only; DB empty this window → hybrid prefer memory.
    return { ...mem, source: "memory", db_total_calls: 0 };
  }
  const dbStats = aggregateRecords(dbRows, windowMs);
  return {
    ...dbStats,
    source: "db",
    memory_total_calls: mem.total_calls,
  };
}

/** Delete rows older than retentionDays (best-effort). */
export async function pruneToolStatsOlderThan(retentionDays = 30) {
  const db = getPool();
  if (!db) return { ok: false, reason: "no_db" };
  await ensureSchema(db);
  const { rowCount } = await db.query(
    `DELETE FROM public.agent_tool_calls WHERE ts < now() - ($1::text || ' days')::interval`,
    [String(Math.max(1, retentionDays))],
  );
  return { ok: true, deleted: rowCount ?? 0 };
}

/** Test/admin reset (memory only; does not wipe DB unless test pool points at temp DB). */
export function _resetToolStatsForTests() {
  records.length = 0;
}
