/**
 * IMP-09 — durable voice operational metrics (privacy-safe; no audio payloads).
 * Mirrors B-05 toolStats dual-write: in-memory ring + Postgres when DATABASE_URL set.
 */

import pg from "pg";

const MAX_RECORDS = 500;
/** @type {Array<{ts:number, kind:string, detail:string|null, surface:string|null}>} */
const records = [];

let pool = null;
let _testPool = null;
let schemaReady = false;
let schemaPromise = null;

function getPool() {
  if (_testPool) return _testPool;
  const url = process.env.DATABASE_URL || "";
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      max: 2,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 30_000,
    });
    pool.on("error", () => {});
  }
  return pool;
}

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
  _records: records,
};

async function ensureSchema(db) {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.agent_voice_events (
        id         bigserial PRIMARY KEY,
        ts         timestamptz NOT NULL DEFAULT now(),
        kind       text        NOT NULL,
        detail     text,
        surface    text
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS agent_voice_events_ts_idx
        ON public.agent_voice_events (ts DESC)
    `);
    schemaReady = true;
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });
  return schemaPromise;
}

/**
 * @param {{ kind: string, detail?: string|null, surface?: string|null, ts?: number }} evt
 */
export function recordVoiceEvent(evt) {
  const kind = String(evt?.kind || "unknown").slice(0, 80);
  const detail = evt?.detail != null ? String(evt.detail).slice(0, 200) : null;
  const surface = evt?.surface != null ? String(evt.surface).slice(0, 40) : null;
  const ts = evt?.ts || Date.now();
  records.push({ ts, kind, detail, surface });
  if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);

  const db = getPool();
  if (db) {
    persistVoiceEvent({ ts, kind, detail, surface }).catch(() => {});
  }
  return { ts, kind, detail, surface };
}

/**
 * @param {{ ts: number, kind: string, detail: string|null, surface: string|null }} row
 */
export async function persistVoiceEvent(row) {
  const db = getPool();
  if (!db) return false;
  await ensureSchema(db);
  await db.query(
    `INSERT INTO public.agent_voice_events (ts, kind, detail, surface)
     VALUES (to_timestamp($1::double precision / 1000.0), $2, $3, $4)`,
    [row.ts, row.kind, row.detail, row.surface],
  );
  return true;
}

export function getVoiceMetrics({ sinceMs = 24 * 60 * 60 * 1000 } = {}) {
  const cutoff = Date.now() - sinceMs;
  const recent = records.filter((r) => r.ts >= cutoff);
  const byKind = {};
  for (const r of recent) {
    byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  }
  return {
    source: "memory",
    total: recent.length,
    by_kind: byKind,
    recent: recent.slice(-50),
  };
}

export function _resetVoiceMetricsForTests() {
  records.length = 0;
  schemaReady = false;
  schemaPromise = null;
}
