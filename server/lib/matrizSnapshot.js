// ═══════════════════════════════════════════════════════════════════════════
// matrizSnapshot — Capture frozen Matriz state for desk_reviews FK (D6)
//
// Freezes the MATRIZ CSV at quote-creation time so desk reviews compare quotes
// against the prices seen then, not live prices.
//
// Schema (server/migrations/desk/001_desk.sql):
//   matriz_snapshots(id, version UNIQUE, data, source, created_by, created_at)
//   desk_reviews.matriz_version → matriz_snapshots.version
// ═══════════════════════════════════════════════════════════════════════════
import crypto from "node:crypto";
import { getOmniPool } from "./omni/omniDb.js";
import { config } from "../config.js";
import { parseCsvRows } from "./bancoStatementParser.js";
import { isDbConnectionError } from "./workspaceDb.js";

const QUERY_TIMEOUT_MS = 10_000;
const MAX_CSV_CHARS = 5_000_000;

let _testPool = null;
function pool() {
  if (_testPool) return _testPool;
  const p = getOmniPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

export const __test__ = {
  setPool(p) { _testPool = p; },
  reset() { _testPool = null; },
};

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function query(p, text, values) {
  return p.query({ text, values, query_timeout: QUERY_TIMEOUT_MS });
}

/** Map pg/network failures to 503 (retryable) vs 500; keep statuses already set. */
function toDbError(err, op) {
  if (err?.status) return err;
  const timedOut = /timeout/i.test(String(err?.message || ""));
  if (timedOut || isDbConnectionError(err)) return httpError("db_unavailable", 503);
  return httpError(`${op}_error: ${err?.message || "unknown"}`, 500);
}

export function parseMatrizCSV(csv) {
  const parsed = parseCsvRows(csv).filter((r) => r.some((v) => String(v).trim() !== ""));
  if (parsed.length < 2) throw httpError("invalid_matriz_csv", 400);
  const headers = parsed[0].map((h) => String(h).trim());
  const rows = parsed.slice(1).map((values) => {
    const row = {};
    headers.forEach((h, j) => {
      const v = values[j] == null ? "" : String(values[j]).trim();
      row[h] = v === "" ? null : v;
    });
    return row;
  });
  return { headers, rowCount: rows.length, rows };
}

/** Content-addressed: identical CSV always yields the same version, regardless of time. */
export function matrizVersionFor(csv) {
  const normalized = String(csv).replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  const hash = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return `MATRIZ-${hash}`;
}

/**
 * Freeze a Matriz CSV into postgres and return its version (FK for desk_reviews).
 * Idempotent and concurrency-safe via ON CONFLICT on the unique version.
 * @throws {Error} status 400 invalid CSV, 503 DB unavailable/timeout, 500 other DB error
 */
export async function freezeMatriz(csv, createdBy = "system", poolOverride) {
  if (!csv || typeof csv !== "string") throw httpError("csv_required", 400);
  if (csv.length > MAX_CSV_CHARS) throw httpError("csv_too_large", 413);

  const data = parseMatrizCSV(csv);
  const version = matrizVersionFor(csv);
  try {
    const p = poolOverride || pool();
    await query(
      p,
      `INSERT INTO matriz_snapshots (version, data, source, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (version) DO NOTHING`,
      [version, JSON.stringify(data), "MATRIZ", createdBy],
    );
    return version;
  } catch (err) {
    throw toDbError(err, "freeze");
  }
}

/** @returns {Promise<object|null>} null only when the version does not exist; DB failures throw. */
export async function getMatrizSnapshot(version, poolOverride) {
  if (!version) return null;
  try {
    const p = poolOverride || pool();
    const result = await query(
      p,
      `SELECT id, version, data, source, created_by, created_at
       FROM matriz_snapshots WHERE version = $1 LIMIT 1`,
      [version],
    );
    return result.rows[0] || null;
  } catch (err) {
    throw toDbError(err, "lookup");
  }
}

export async function listMatrizSnapshots(limit = 10, poolOverride) {
  const n = Math.max(1, Math.min(Number(limit) || 10, 100));
  try {
    const p = poolOverride || pool();
    const result = await query(
      p,
      `SELECT id, version, source, created_by, created_at
       FROM matriz_snapshots ORDER BY created_at DESC LIMIT $1`,
      [n],
    );
    return result.rows;
  } catch (err) {
    throw toDbError(err, "list");
  }
}
