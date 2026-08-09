/**
 * Learning candidates — memory store + SM + offline eval + promote to KB.
 * Dual-write to Postgres when DATABASE_URL set (best-effort, non-blocking).
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

function persistBestEffort(row) {
  void (async () => {
    try {
      const db = getPool();
      if (!db) return;
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
    } catch {
      /* never block */
    }
  })();
}

/**
 * @param {{ delta?: object, scope?: string, source?: string, sessionId?: string }} input
 */
export function createCandidate(input = {}) {
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
    delta: input.delta || {},
    evalReport: null,
    trainingKbId: null,
    rejectReason: null,
    createdAt: now,
    updatedAt: now,
  };
  store.set(id, row);
  persistBestEffort(row);
  appendPaosEvent({
    type: "learning.candidate_created",
    sessionId: row.sessionId,
    payload: { id, state: row.state },
  });
  return { ...row };
}

export function getCandidate(id) {
  const row = store.get(String(id || ""));
  return row ? { ...row } : null;
}

export function listCandidates({ state } = {}) {
  let rows = [...store.values()];
  if (state) rows = rows.filter((r) => r.state === state);
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((r) => ({ ...r }));
}

/**
 * Run built-in offline eval (or use provided report).
 * @param {string} id
 * @param {{ pass?: boolean, details?: object } | null} [report]
 *   If null/undefined, runs evaluateCandidateOffline on delta.
 */
export function completeEvaluation(id, report = null) {
  const row = store.get(String(id || ""));
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
  persistBestEffort(row);
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
export function approveCandidate(id, mode = "canary") {
  if (!isPaosPromoteEnabled()) {
    const err = new Error("paos_promote_disabled");
    err.code = "PAOS_PROMOTE_DISABLED";
    throw err;
  }
  const row = store.get(String(id || ""));
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

  // Promote to Training KB (remaining G2)
  const promo = promoteCandidateToTrainingKb(row, mode);
  if (!promo.ok) {
    // roll state? keep approved state but surface error
    row.promoteError = promo.error;
  } else {
    row.trainingKbId = promo.trainingEntry?.id || null;
    row.promoteError = null;
  }

  store.set(row.id, row);
  persistBestEffort(row);
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

export function rejectCandidate(id, reason = "") {
  const row = store.get(String(id || ""));
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
  persistBestEffort(row);
  return { ...row };
}

export function rollbackCandidate(id) {
  const row = store.get(String(id || ""));
  if (!row) {
    const err = new Error("not_found");
    err.code = "PAOS_NOT_FOUND";
    throw err;
  }
  row.state = transition(row.state, "rolled_back");
  row.updatedAt = new Date().toISOString();
  store.set(row.id, row);
  persistBestEffort(row);
  appendPaosEvent({
    type: "learning.candidate_rolled_back",
    sessionId: row.sessionId,
    payload: { id: row.id, trainingKbId: row.trainingKbId },
  });
  return { ...row };
}
