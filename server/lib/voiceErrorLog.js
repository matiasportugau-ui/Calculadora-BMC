/**
 * server/lib/voiceErrorLog.js
 * In-memory ring buffer + optional Postgres persistence (IMP-09).
 * Ephemeral memory survives only until process restart; DB path survives redeploy.
 */

import pg from "pg";

const MAX_ENTRIES = 50;
const MAX_MESSAGE_CHARS = 500;
const MAX_DETAIL_CHARS = 2000;
const buffer = [];

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

/** @param {import('pg').Pool} db */
async function ensureSchema(db) {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.agent_voice_events (
        id         bigserial PRIMARY KEY,
        ts         timestamptz NOT NULL DEFAULT now(),
        kind       text        NOT NULL,
        message    text        NOT NULL DEFAULT '',
        status     int,
        detail     text
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

function clip(value, max) {
  if (value == null) return null;
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)}…(truncated ${s.length - max})` : s;
}

/**
 * @param {{ kind: string, message?: string, status?: number|null, detail?: string|null, ts?: string }} row
 */
export async function persistVoiceError(row) {
  const db = getPool();
  if (!db) return { ok: false, reason: "no_db" };
  await ensureSchema(db);
  await db.query(
    `INSERT INTO public.agent_voice_events (ts, kind, message, status, detail)
     VALUES (COALESCE($1::timestamptz, now()), $2, $3, $4, $5)`,
    [
      row.ts ? new Date(row.ts).toISOString() : null,
      row.kind,
      row.message || "",
      row.status == null ? null : Number(row.status) || null,
      row.detail,
    ],
  );
  return { ok: true };
}

export function recordVoiceError({ kind, message, status = null, detail = null }) {
  const entry = {
    ts: new Date().toISOString(),
    kind: String(kind || "unknown"),
    message: clip(message, MAX_MESSAGE_CHARS) || "",
    status: status == null ? null : Number(status) || null,
    detail: clip(detail, MAX_DETAIL_CHARS),
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
  void persistVoiceError(entry).catch(() => {});
  return entry;
}

export function listVoiceErrors() {
  return buffer.slice().reverse();
}

export function clearVoiceErrors() {
  buffer.length = 0;
}

/** Test hook — inject mock pool (mirrors toolStats pattern). */
export function _setVoiceErrorPoolForTests(testPool) {
  _testPool = testPool;
  schemaReady = false;
  schemaPromise = null;
}
