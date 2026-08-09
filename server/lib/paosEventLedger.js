/**
 * PAOS Event Ledger — IMP-PAOS-01
 * Memory ring + optional Postgres public.agent_events (ensureSchema like toolStats).
 * Never throws to callers of appendPaosEvent (fire-and-forget durable).
 */

import pg from "pg";
import { isPaosEnabled, paosLedgerRetentionDays } from "./paosConfig.js";

const { Pool } = pg;

const MAX_RECORDS = 2000;
/** @type {Array<Record<string, unknown>>} */
const records = [];

let _pool = null;
let schemaReady = false;
let schemaPromise = null;

/** @type {import("pg").Pool | null} */
let _testPool = null;

export const __paosLedgerTest = {
  /** @param {import("pg").Pool | null} pool */
  setPool(pool) {
    _testPool = pool;
    schemaReady = false;
    schemaPromise = null;
  },
  reset() {
    records.length = 0;
    _testPool = null;
    schemaReady = false;
    schemaPromise = null;
    if (_pool) {
      void _pool.end().catch(() => {});
      _pool = null;
    }
  },
  getMemory() {
    return records.slice();
  },
};

function getPool() {
  if (_testPool) return _testPool;
  const url = process.env.DATABASE_URL || "";
  if (!url) return null;
  if (!_pool) {
    _pool = new Pool({ connectionString: url, max: 2, allowExitOnIdle: true });
    _pool.on("error", () => {});
  }
  return _pool;
}

async function ensureSchema(db) {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.agent_events (
        id           bigserial PRIMARY KEY,
        ts           timestamptz NOT NULL DEFAULT now(),
        type         text        NOT NULL,
        session_id   text,
        actor        text,
        payload      jsonb       NOT NULL DEFAULT '{}'::jsonb
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS agent_events_ts_idx ON public.agent_events (ts DESC)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS agent_events_session_idx ON public.agent_events (session_id, ts DESC)
    `);
    schemaReady = true;
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });
  return schemaPromise;
}

/**
 * Append observation event. Safe when PAOS disabled (still records if enabled only).
 * When PAOS_ENABLED=0, no-op to preserve prod behavior for new surface — actually
 * SDD says observation can run; flags gate mutators. Spec: flags default off preserve
 * current prod — ledger is new; we only write when PAOS_ENABLED=1.
 *
 * @param {{ type: string, sessionId?: string|null, actor?: string|null, payload?: object }} evt
 */
export function appendPaosEvent(evt) {
  try {
    if (!isPaosEnabled()) return null;
    if (!evt || typeof evt.type !== "string" || !evt.type) return null;
    const row = {
      ts: new Date().toISOString(),
      type: evt.type,
      sessionId: evt.sessionId ? String(evt.sessionId) : null,
      actor: evt.actor ? String(evt.actor) : null,
      payload: evt.payload && typeof evt.payload === "object" ? evt.payload : {},
    };
    records.push(row);
    if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
    void persistEvent(row).catch(() => {});
    return row;
  } catch {
    return null;
  }
}

async function persistEvent(row) {
  const db = getPool();
  if (!db) return { ok: false, reason: "no_db" };
  await ensureSchema(db);
  await db.query(
    `INSERT INTO public.agent_events (ts, type, session_id, actor, payload)
     VALUES ($1::timestamptz, $2, $3, $4, $5::jsonb)`,
    [row.ts, row.type, row.sessionId, row.actor, JSON.stringify(row.payload || {})],
  );
  return { ok: true };
}

/**
 * Query memory ledger (and optional DB later). Offline-first for tests.
 * @param {{ sessionId?: string, type?: string, limit?: number }} [q]
 */
export function listPaosEvents(q = {}) {
  const limit = Math.min(500, Math.max(1, Number(q.limit) || 100));
  let out = records.slice().reverse();
  if (q.sessionId) out = out.filter((r) => r.sessionId === q.sessionId);
  if (q.type) out = out.filter((r) => r.type === q.type);
  return out.slice(0, limit);
}

export function paosLedgerStats() {
  return {
    memoryCount: records.length,
    retentionDays: paosLedgerRetentionDays(),
    enabled: isPaosEnabled(),
  };
}
