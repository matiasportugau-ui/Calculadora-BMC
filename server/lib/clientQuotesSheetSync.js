// ═══════════════════════════════════════════════════════════════════════════
// clientQuotesSheetSync — opt-in admin sync of identity.quotes to Google
// Sheets tab «Base de datos cotis de clientes».
// ───────────────────────────────────────────────────────────────────────────
// v1 column contract (column A is the idempotency key):
//   A quote_id
//   B user_email
//   C user_name
//   D created_at
//   E status
//   F total_usd
//   G total_uyu
//   H pdf_url
//   I drive_file_id
//   J sync_batch_id
//   K wizard_payload_json
//
// Triggers:
//   - enqueue(quoteId): debounced 60s flush after a quote transitions to
//     status='completed'
//   - reconcile(): scan identity.quotes where sheet_synced_at IS NULL
//   - syncQuote(quoteId): single retry
//
// Spreadsheet: config.bmcSheetId (same workbook used by bmcDashboard).
// Tab name: config.sheetsClientQuotesTab (default literal per master plan §7).
// Toggle: SHEETS_CLIENT_QUOTES_ENABLED (default false).
// ═══════════════════════════════════════════════════════════════════════════

import { google } from "googleapis";
import { getGoogleAuthClient } from "./googleAuthCache.js";
import { config } from "../config.js";
import { getWaPool } from "./waDb.js";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const COLUMNS = ["quote_id","user_email","user_name","created_at","status","total_usd","total_uyu","pdf_url","drive_file_id","sync_batch_id","wizard_payload_json"];
const COLUMN_RANGE = "A:K";
const DEBOUNCE_MS = 60_000;

let _logger = console;
let _pendingTimer = null;
const _pendingIds = new Set();

export function configureLogger(logger) { _logger = logger || console; }

function pool() {
  const p = getWaPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

function tabName() {
  return config.sheetsClientQuotesTab || "Base de datos cotis de clientes";
}

function isEnabled() {
  return !!config.sheetsClientQuotesEnabled;
}

function isConfigured() {
  return !!config.bmcSheetId;
}

async function _sheets() {
  const auth = await getGoogleAuthClient(SCOPE);
  return google.sheets({ version: "v4", auth });
}

function _row(quote) {
  const payloadJson = (() => {
    try { return JSON.stringify(quote.payload || {}); } catch { return ""; }
  })();
  return [
    quote.quote_id,
    quote.user_email || "",
    quote.user_name || "",
    quote.created_at instanceof Date ? quote.created_at.toISOString() : String(quote.created_at || ""),
    quote.status || "",
    quote.total_usd != null ? Number(quote.total_usd).toFixed(2) : "",
    quote.total_uyu != null ? Number(quote.total_uyu).toFixed(2) : "",
    quote.pdf_url || "",
    quote.drive_file_id || "",
    quote.sync_batch_id || "",
    payloadJson,
  ];
}

async function _ensureHeader(sheets) {
  const header = await sheets.spreadsheets.values.get({
    spreadsheetId: config.bmcSheetId,
    range: `${tabName()}!A1:K1`,
  }).catch(() => null);
  const haveHeader = !!header?.data?.values?.[0]?.length;
  if (!haveHeader) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.bmcSheetId,
      range: `${tabName()}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [COLUMNS] },
    });
  }
}

async function _findRowByQuoteId(sheets, quoteId) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: config.bmcSheetId,
    range: `${tabName()}!A:A`,
  }).catch(() => null);
  const rows = r?.data?.values || [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.[0] === quoteId) return i + 1; // 1-based, includes header
  }
  return null;
}

async function _writeRow(sheets, quoteId, values) {
  const existing = await _findRowByQuoteId(sheets, quoteId);
  if (existing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.bmcSheetId,
      range: `${tabName()}!A${existing}:K${existing}`,
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });
    return existing;
  }
  const append = await sheets.spreadsheets.values.append({
    spreadsheetId: config.bmcSheetId,
    range: `${tabName()}!${COLUMN_RANGE}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
  // updatedRange like "Tab!A12:K12"
  const updated = append.data?.updates?.updatedRange || "";
  const m = /![A-Z]+(\d+):/.exec(updated);
  return m ? Number(m[1]) : null;
}

async function _loadQuoteWithUser(quoteId) {
  const { rows } = await pool().query(
    `select q.quote_id, q.user_id, q.payload, q.total_usd, q.total_uyu, q.status,
            q.pdf_url, q.drive_file_id, q.created_at,
            u.email as user_email, u.name as user_name
       from identity.quotes q
       left join identity.users u on u.user_id = q.user_id
      where q.quote_id = $1`,
    [quoteId],
  );
  return rows[0] || null;
}

async function _markSynced(quoteId, sheetRowId, batchId) {
  await pool().query(
    `update identity.quotes
        set sheet_synced_at = now(), sheet_row_id = $2
      where quote_id = $1`,
    [quoteId, sheetRowId ? String(sheetRowId) : null],
  );
  await pool().query(
    `insert into identity.quote_events (quote_id, kind, payload)
     values ($1, 'sheet_pushed', $2::jsonb)`,
    [quoteId, JSON.stringify({ batch_id: batchId, sheet_row_id: sheetRowId })],
  );
}

async function _audit(actorUserId, action, payload) {
  try {
    await pool().query(
      `insert into identity.audit_log (actor_user_id, actor_kind, action, resource, payload)
       values ($1, $2, $3, 'sheets:base_clientes', $4::jsonb)`,
      [actorUserId || null, actorUserId ? "user" : "system", action, JSON.stringify(payload || {})],
    );
  } catch { /* best-effort */ }
}

// ─── Public API ────────────────────────────────────────────────────────

export function isSheetSyncEnabled() {
  return isEnabled() && isConfigured();
}

export async function syncQuote({ quoteId, batchId, actorUserId } = {}) {
  if (!isSheetSyncEnabled()) {
    return { ok: false, error: "disabled" };
  }
  const q = await _loadQuoteWithUser(quoteId);
  if (!q) throw Object.assign(new Error("quote_not_found"), { status: 404 });

  const sheets = await _sheets();
  await _ensureHeader(sheets);
  const enriched = { ...q, sync_batch_id: batchId || null };
  const rowId = await _writeRow(sheets, quoteId, _row(enriched));
  await _markSynced(quoteId, rowId, batchId);
  await _audit(actorUserId, "sync_run", { quote_id: quoteId, sheet_row_id: rowId, batch_id: batchId });
  return { ok: true, sheet_row_id: rowId };
}

export async function reconcile({ actorUserId, limit = 200 } = {}) {
  if (!isSheetSyncEnabled()) return { ok: false, error: "disabled" };
  const { rows } = await pool().query(
    `select quote_id from identity.quotes
      where sheet_synced_at is null and status = 'completed'
      order by created_at asc limit $1`,
    [limit],
  );
  const batchId = `recon-${Date.now().toString(36)}`;
  const results = { ok: 0, fail: 0, errors: [] };
  for (const r of rows) {
    try {
      await syncQuote({ quoteId: r.quote_id, batchId, actorUserId });
      results.ok += 1;
    } catch (e) {
      results.fail += 1;
      results.errors.push({ quote_id: r.quote_id, error: e.message });
      _logger.warn?.({ err: e, quote_id: r.quote_id }, "[clientQuotesSheetSync] reconcile failure");
    }
  }
  await _audit(actorUserId, "reconcile_run", { batch_id: batchId, ...results });
  return { ok: true, batch_id: batchId, ...results };
}

/** Debounced 60s aggregate flush for completion-time triggers. */
export function enqueue(quoteId) {
  if (!quoteId) return;
  _pendingIds.add(String(quoteId));
  if (_pendingTimer) return;
  _pendingTimer = setTimeout(async () => {
    const ids = Array.from(_pendingIds);
    _pendingIds.clear();
    _pendingTimer = null;
    if (!isSheetSyncEnabled()) return;
    const batchId = `enq-${Date.now().toString(36)}`;
    for (const id of ids) {
      try { await syncQuote({ quoteId: id, batchId }); }
      catch (e) {
        _logger.warn?.({ err: e, quote_id: id }, "[clientQuotesSheetSync] enqueue flush failure");
      }
    }
  }, DEBOUNCE_MS);
  _pendingTimer.unref?.();
}

export const __test__ = {
  flush() {
    if (_pendingTimer) clearTimeout(_pendingTimer);
    _pendingTimer = null;
    _pendingIds.clear();
  },
};
