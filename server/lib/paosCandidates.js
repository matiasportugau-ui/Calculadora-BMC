/**
 * Learning candidates — memory cache + SM + offline eval + promote to KB.
 * Postgres is SoT when DATABASE_URL is set (read-through + awaited dual-write).
 * Untrusted deltas strip forgeable calc provenance (money-guard integrity).
 */

import crypto from "node:crypto";
import pg from "pg";
import {
  canEnterPendingApproval,
  canTransition,
  transition,
} from "./paosCandidateSm.js";
import { isPaosEnabled, isPaosPromoteEnabled } from "./paosConfig.js";
import { appendPaosEvent } from "./paosEventLedger.js";
import { evaluateCandidateOffline } from "./paosEvaluate.js";
import { promoteCandidateToTrainingKb } from "./paosPromote.js";
import { rejectTrainingEntry, updateTrainingEntry } from "./trainingKB.js";

const { Pool } = pg;

/** @type {Map<string, object>} */
const store = new Map();

let _pool = null;
let schemaReady = false;
let schemaPromise = null;
let _testPool = null;

export const __paosCandidatesTest = {
  reset() {
    store.clear();
    schemaReady = false;
    schemaPromise = null;
    _testPool = null;
    if (_pool) {
      void _pool.end().catch(() => {});
      _pool = null;
    }
  },
  all() {
    return [...store.values()];
  },
  /** @param {import("pg").Pool | null} pool */
  setPool(pool) {
    _testPool = pool;
    schemaReady = false;
    schemaPromise = null;
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
      CREATE TABLE IF NOT EXISTS public.learning_candidates (
        id           text PRIMARY KEY,
        state        text NOT NULL,
        scope        text,
        source       text,
        session_id   text,
        delta        jsonb NOT NULL DEFAULT '{}'::jsonb,
        eval_report  jsonb,
        training_kb_id text,
        reject_reason text,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS learning_candidates_state_idx
        ON public.learning_candidates (state, updated_at DESC)
    `);
    schemaReady = true;
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });
  return schemaPromise;
}

/**
 * Strip client-forgeable money-oracle fields unless server attested.
 * @param {object} delta
 * @param {{ trustedProvenance?: boolean }} [opts]
 */
export function sanitizeCandidateDelta(delta = {}, opts = {}) {
  const out = delta && typeof delta === "object" ? { ...delta } : {};
  if (opts.trustedProvenance) return out;
  delete out.calcProvenance;
  delete out.totalUsd;
  delete out.calcResult;
  if (out.source === "calc_oracle") delete out.source;
  return out;
}

function tsIso(v) {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  try {
    return new Date(v).toISOString();
  } catch {
    return String(v);
  }
}

function rowFromPg(r) {
  return {
    id: r.id,
    state: r.state,
    scope: r.scope,
    source: r.source,
    sessionId: r.session_id ?? null,
    delta: r.delta && typeof r.delta === "object" ? r.delta : {},
    evalReport: r.eval_report ?? null,
    trainingKbId: r.training_kb_id ?? null,
    rejectReason: r.reject_reason ?? null,
    promoteError: null,
    createdAt: tsIso(r.created_at),
    updatedAt: tsIso(r.updated_at),
  };
}

async function persistRow(row) {
  const db = getPool();
  if (!db) return { ok: false, reason: "no_db" };
  await ensureSchema(db);
  await db.query(
    `INSERT INTO public.learning_candidates
       (id, state, scope, source, session_id, delta, eval_report, training_kb_id, reject_reason, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10::timestamptz,$11::timestamptz)
     ON CONFLICT (id) DO UPDATE SET
       state = EXCLUDED.state,
       scope = EXCLUDED.scope,
       source = EXCLUDED.source,
       session_id = EXCLUDED.session_id,
       delta = EXCLUDED.delta,
       eval_report = EXCLUDED.eval_report,
       training_kb_id = EXCLUDED.training_kb_id,
       reject_reason = EXCLUDED.reject_reason,
       updated_at = EXCLUDED.updated_at`,
    [
      row.id,
      row.state,
      row.scope,
      row.source,
      row.sessionId,
      JSON.stringify(row.delta || {}),
      row.evalReport ? JSON.stringify(row.evalReport) : null,
      row.trainingKbId || null,
      row.rejectReason || null,
      row.createdAt,
      row.updatedAt,
    ],
  );
  return { ok: true };
}

async function persistBestEffort(row) {
  try {
    return await persistRow(row);
  } catch {
    return { ok: false, reason: "persist_failed" };
  }
}

/**
 * Memory first, then Postgres read-through (Cloud Run multi-instance).
 * @param {string} id
 */
async function resolveRow(id) {
  const key = String(id || "");
  if (!key) return null;
  const mem = store.get(key);
  if (mem) return mem;
  const db = getPool();
  if (!db) return null;
  try {
    await ensureSchema(db);
    const { rows } = await db.query(
      `SELECT * FROM public.learning_candidates WHERE id = $1`,
      [key],
    );
    if (!rows[0]) return null;
    const row = rowFromPg(rows[0]);
    store.set(row.id, row);
    return row;
  } catch {
    return null;
  }
}

function revokeLinkedTrainingKb(row) {
  const kbId = row?.trainingKbId;
  if (!kbId) return { ok: false, reason: "no_kb" };
  try {
    rejectTrainingEntry(kbId, `paos_rollback:${row.id}`);
  } catch {
    /* may already be gone */
  }
  try {
    updateTrainingEntry(kbId, { permanent: false, status: "rejected" });
  } catch {
    /* ignore */
  }
  return { ok: true, trainingKbId: kbId };
}

/**
 * @param {{
 *   delta?: object,
 *   scope?: string,
 *   source?: string,
 *   sessionId?: string,
 *   trustedProvenance?: boolean,
 * }} input
 */
export async function createCandidate(input = {}) {
  if (!isPaosEnabled()) {
    const err = new Error("paos_disabled");
    err.code = "PAOS_DISABLED";
    throw err;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row = {
    id,
    state: "drafted",
    scope: input.scope || "org",
    source: input.source || "manual",
    sessionId: input.sessionId || null,
    delta: sanitizeCandidateDelta(input.delta || {}, {
      trustedProvenance: !!input.trustedProvenance,
    }),
    evalReport: null,
    trainingKbId: null,
    rejectReason: null,
    promoteError: null,
    createdAt: now,
    updatedAt: now,
  };
  store.set(id, row);
  await persistBestEffort(row);
  appendPaosEvent({
    type: "learning.candidate_created",
    sessionId: row.sessionId,
    payload: { id, state: row.state },
  });
  return { ...row };
}

export async function getCandidate(id) {
  const row = await resolveRow(id);
  return row ? { ...row } : null;
}

export async function listCandidates({ state } = {}) {
  const db = getPool();
  if (db) {
    try {
      await ensureSchema(db);
      const q = state
        ? await db.query(
            `SELECT * FROM public.learning_candidates WHERE state = $1 ORDER BY created_at DESC`,
            [state],
          )
        : await db.query(
            `SELECT * FROM public.learning_candidates ORDER BY created_at DESC`,
          );
      for (const r of q.rows) {
        const row = rowFromPg(r);
        const mem = store.get(row.id);
        if (!mem || String(mem.updatedAt || "") <= String(row.updatedAt || "")) {
          store.set(row.id, row);
        }
      }
    } catch {
      /* memory fallback */
    }
  }
  let rows = [...store.values()];
  if (state) rows = rows.filter((r) => r.state === state);
  return rows
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((r) => ({ ...r }));
}

/**
 * Run built-in offline eval (or use provided report from trusted internal callers).
 * HTTP API must pass report=null — never accept client {pass:true}.
 * @param {string} id
 * @param {{ pass?: boolean, details?: object } | null} [report]
 */
export async function completeEvaluation(id, report = null) {
  const row = await resolveRow(id);
  if (!row) {
    const err = new Error("not_found");
    err.code = "PAOS_NOT_FOUND";
    throw err;
  }
  if (row.state === "drafted") {
    row.state = transition(row.state, "evaluating");
  } else if (row.state !== "evaluating") {
    const err = new Error(`cannot_evaluate_from:${row.state}`);
    err.code = "PAOS_ILLEGAL_TRANSITION";
    throw err;
  }

  const evalReport =
    report && typeof report.pass === "boolean"
      ? report
      : evaluateCandidateOffline(row);

  row.evalReport = evalReport;
  row.updatedAt = new Date().toISOString();
  if (canEnterPendingApproval(row.evalReport)) {
    row.state = transition("evaluating", "pending_approval");
  } else {
    row.state = transition("evaluating", "rejected");
  }
  row.updatedAt = new Date().toISOString();
  store.set(row.id, row);
  await persistBestEffort(row);
  appendPaosEvent({
    type: "learning.candidate_evaluated",
    sessionId: row.sessionId,
    payload: { id: row.id, state: row.state, pass: !!row.evalReport?.pass },
  });
  return { ...row };
}

/**
 * @param {string} id
 * @param {"canary"|"active"} mode
 */
export async function approveCandidate(id, mode = "canary") {
  if (!isPaosPromoteEnabled()) {
    const err = new Error("paos_promote_disabled");
    err.code = "PAOS_PROMOTE_DISABLED";
    throw err;
  }
  const row = await resolveRow(id);
  if (!row) {
    const err = new Error("not_found");
    err.code = "PAOS_NOT_FOUND";
    throw err;
  }
  const to = mode === "active" ? "active" : "canary";
  const check = canTransition(row.state, to);
  if (!check.ok) {
    const err = new Error(check.error);
    err.code = "PAOS_ILLEGAL_TRANSITION";
    throw err;
  }
  row.state = transition(row.state, to);
  row.updatedAt = new Date().toISOString();

  const promo = promoteCandidateToTrainingKb(row, mode);
  if (!promo.ok) {
    row.promoteError = promo.error;
  } else {
    row.trainingKbId = promo.trainingEntry?.id || null;
    row.promoteError = null;
  }

  store.set(row.id, row);
  await persistBestEffort(row);
  appendPaosEvent({
    type: "learning.candidate_approved",
    sessionId: row.sessionId,
    payload: {
      id: row.id,
      state: row.state,
      trainingKbId: row.trainingKbId,
      promoteError: row.promoteError,
    },
  });
  return { ...row };
}

export async function rejectCandidate(id, reason = "") {
  const row = await resolveRow(id);
  if (!row) {
    const err = new Error("not_found");
    err.code = "PAOS_NOT_FOUND";
    throw err;
  }
  if (row.state === "rejected") return { ...row };
  const allowedFrom = ["detected", "drafted", "evaluating", "pending_approval", "canary"];
  if (!allowedFrom.includes(row.state) && row.state !== "rejected") {
    const check = canTransition(row.state, "rejected");
    if (!check.ok) {
      const err = new Error(check.error);
      err.code = "PAOS_ILLEGAL_TRANSITION";
      throw err;
    }
  }
  row.state = "rejected";
  row.rejectReason = String(reason || "");
  row.updatedAt = new Date().toISOString();
  store.set(row.id, row);
  await persistBestEffort(row);
  return { ...row };
}

export async function rollbackCandidate(id) {
  const row = await resolveRow(id);
  if (!row) {
    const err = new Error("not_found");
    err.code = "PAOS_NOT_FOUND";
    throw err;
  }
  row.state = transition(row.state, "rolled_back");
  row.updatedAt = new Date().toISOString();
  const revoked = revokeLinkedTrainingKb(row);
  store.set(row.id, row);
  await persistBestEffort(row);
  appendPaosEvent({
    type: "learning.candidate_rolled_back",
    sessionId: row.sessionId,
    payload: {
      id: row.id,
      trainingKbId: row.trainingKbId,
      kbRevoked: !!revoked.ok,
    },
  });
  return { ...row, kbRevoked: !!revoked.ok };
}
