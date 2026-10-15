// ═══════════════════════════════════════════════════════════════════════════
// matrizSnapshot — Capture frozen Matriz state for desk_reviews FK (D6)
//
// Freezes the current MATRIZ CSV at quote-creation time so desk reviews
// always compare quotes against the snapshot taken then, not live prices.
//
// Schema: matriz_snapshots(id, version, data, source, created_by, created_at)
// FK: desk_reviews.matriz_version → matriz_snapshots.version
// ═══════════════════════════════════════════════════════════════════════════
import { getOmniPool } from "./omni/omniDb.js";
import { config } from "../config.js";
import crypto from "crypto";

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

/**
 * Parse CSV data into structured format for matriz_snapshots.data
 * @param {string} csv - Raw CSV text
 * @returns {object} Parsed matrix data with headers and rows
 */
function parseMatrizCSV(csv) {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) {
    throw Object.assign(new Error("invalid_matriz_csv"), { status: 400 });
  }

  // First row = headers
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (assumes no commas in values)
    const values = line.split(",").map(v => v.trim());
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || null;
    }
    rows.push(row);
  }

  return {
    headers,
    rowCount: rows.length,
    rows,
    parsedAt: new Date().toISOString(),
  };
}

/**
 * Generate unique version ID for this matriz snapshot
 * Format: MATRIZ-YYYYMMDD-HHmmss-xxxx (xxxx = first 4 chars of CSV content hash)
 * @param {string} csv - CSV content to hash
 * @returns {string} Version string
 */
function generateVersion(csv) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 19).replace(/[-:]/g, "");
  const hash = crypto.createHash("sha256").update(csv).digest("hex").slice(0, 4);
  return `MATRIZ-${dateStr}-${hash}`;
}

/**
 * Freeze current Matriz state into postgres
 * Called at quote-creation time (desk_reviews will reference this snapshot)
 *
 * @param {string} csv - Raw CSV content from MATRIZ sheet
 * @param {string} [createdBy] - User/system identifier (optional)
 * @param {object} [poolOverride] - Test pool override
 * @returns {Promise<string>} Version ID (for FK reference)
 * @throws {Error} with status 503 if DB unavailable, 400 if CSV invalid
 */
export async function freezeMatriz(csv, createdBy = "system", poolOverride) {
  if (!csv || typeof csv !== "string") {
    throw Object.assign(new Error("csv_required"), { status: 400 });
  }

  const version = generateVersion(csv);

  try {
    const data = parseMatrizCSV(csv);
    const p = poolOverride || pool();

    // Check if this version already exists (idempotent)
    const existing = await p.query(
      "SELECT id FROM matriz_snapshots WHERE version = $1 LIMIT 1",
      [version]
    );

    if (existing.rows.length > 0) {
      // Already frozen with same content; return existing version
      return version;
    }

    // Insert new snapshot
    const result = await p.query(
      `INSERT INTO matriz_snapshots (version, data, source, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING version`,
      [
        version,
        JSON.stringify(data),
        "MATRIZ",
        createdBy,
      ]
    );

    if (!result.rows.length) {
      throw Object.assign(new Error("insert_failed"), { status: 500 });
    }

    return result.rows[0].version;
  } catch (err) {
    // Re-throw with status if already set
    if (err.status) throw err;

    // Postgres unavailable or syntax error
    if (err.message?.includes("connect") || err.code === "ECONNREFUSED") {
      throw Object.assign(new Error("db_unavailable"), { status: 503 });
    }

    // Other DB error
    throw Object.assign(new Error(`freeze_error: ${err.message}`), { status: 500 });
  }
}

/**
 * Get a frozen snapshot by version
 * @param {string} version - Version ID
 * @param {object} [poolOverride] - Test pool override
 * @returns {Promise<object|null>} Snapshot data or null if not found
 */
export async function getMatrizSnapshot(version, poolOverride) {
  if (!version) return null;

  try {
    const p = poolOverride || pool();
    const result = await p.query(
      `SELECT id, version, data, source, created_at FROM matriz_snapshots
       WHERE version = $1 LIMIT 1`,
      [version]
    );

    return result.rows[0] || null;
  } catch (err) {
    // Log but don't throw — graceful fallback if lookup fails
    console.error("[matrizSnapshot] lookup error:", err.message);
    return null;
  }
}

/**
 * List recent matriz snapshots (for debugging/audit)
 * @param {number} [limit=10] - Max snapshots to return
 * @param {object} [poolOverride] - Test pool override
 * @returns {Promise<Array>} Recent snapshots, newest first
 */
export async function listMatrizSnapshots(limit = 10, poolOverride) {
  try {
    const p = poolOverride || pool();
    const result = await p.query(
      `SELECT id, version, source, created_by, created_at
       FROM matriz_snapshots
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.min(limit, 100)]
    );

    return result.rows;
  } catch (err) {
    console.error("[matrizSnapshot] list error:", err.message);
    return [];
  }
}
