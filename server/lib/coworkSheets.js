/**
 * Panelin Co-Work — allowlisted Google Sheets read/write helpers.
 * Spec: docs/team/SDD-PANELIN-COWORK.md
 */

import { google } from "googleapis";
import { config } from "../config.js";
import { sanitizeCellValue } from "./sheetsCsvGuard.js";
import { getBmcChatInquiries } from "./bmcChatSheets.js";

/**
 * @returns {Record<string, string>} alias → spreadsheetId
 */
export function sheetsAllowlist() {
  const map = {};
  if (config.wolfbAdminSheetId) {
    map.admin = String(config.wolfbAdminSheetId);
    map.wolfboard = map.admin;
  }
  if (config.wolfbCrmSheetId) {
    map.crm = String(config.wolfbCrmSheetId);
    map.crm_operativo = map.crm;
  }
  return map;
}

/**
 * Resolve workbook alias or raw id against allowlist.
 * @param {string} workbook
 * @returns {{ ok: true, alias: string, spreadsheetId: string } | { ok: false, error: string }}
 */
export function resolveWorkbook(workbook) {
  const allow = sheetsAllowlist();
  const key = String(workbook || "admin").trim().toLowerCase();
  if (allow[key]) {
    return { ok: true, alias: key === "wolfboard" ? "admin" : key === "crm_operativo" ? "crm" : key, spreadsheetId: allow[key] };
  }
  // Exact id match only if it appears in allowlist values
  for (const [alias, id] of Object.entries(allow)) {
    if (id && id === workbook) {
      return { ok: true, alias: alias === "wolfboard" ? "admin" : alias, spreadsheetId: id };
    }
  }
  return {
    ok: false,
    error: "spreadsheet_not_allowlisted",
    hint: `Usá workbook "admin" o "crm". Permitidos: ${Object.keys(allow).join(", ") || "(ninguno configurado)"}`,
  };
}

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

/**
 * List sheet tabs for an allowlisted workbook.
 */
export async function listTabs(workbook = "admin") {
  const resolved = resolveWorkbook(workbook);
  if (!resolved.ok) return resolved;
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: resolved.spreadsheetId,
    fields: "sheets.properties(title,sheetId,index,gridProperties)",
  });
  const tabs = (meta.data.sheets || []).map((s) => ({
    title: s.properties?.title,
    sheetId: s.properties?.sheetId,
    index: s.properties?.index,
    rowCount: s.properties?.gridProperties?.rowCount,
    columnCount: s.properties?.gridProperties?.columnCount,
  }));
  return { ok: true, workbook: resolved.alias, spreadsheetId: resolved.spreadsheetId, tabs };
}

/**
 * Read an A1 range. Tab titles with special chars should be quoted by caller or we quote if needed.
 * @param {{ workbook?: string, range: string, maxRows?: number }} opts
 */
export async function readRange({ workbook = "admin", range, maxRows = 100 } = {}) {
  const resolved = resolveWorkbook(workbook);
  if (!resolved.ok) return resolved;
  if (!range || !String(range).trim()) {
    return { ok: false, error: "range_required", hint: 'Ej: "Admin.!A1:M20" o "CRM_Operativo!A1:AH5"' };
  }
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: resolved.spreadsheetId,
    range: String(range).trim(),
    valueRenderOption: "FORMATTED_VALUE",
  });
  let values = res.data.values || [];
  const cap = Math.min(500, Math.max(1, Number(maxRows) || 100));
  if (values.length > cap) values = values.slice(0, cap);
  const headers = values[0] || [];
  return {
    ok: true,
    workbook: resolved.alias,
    range: res.data.range || range,
    rowCount: values.length,
    headers,
    values,
    truncated: (res.data.values || []).length > cap,
  };
}

/**
 * Search text in a column range; return matching rows with row numbers.
 * @param {{ workbook?: string, range: string, query: string, maxHits?: number }} opts
 */
export async function findInRange({ workbook = "admin", range, query, maxHits = 15 } = {}) {
  const resolved = resolveWorkbook(workbook);
  if (!resolved.ok) return resolved;
  const q = String(query || "").trim().toLowerCase();
  if (!q) return { ok: false, error: "query_required" };
  if (!range) return { ok: false, error: "range_required" };

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: resolved.spreadsheetId,
    range: String(range).trim(),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = res.data.values || [];
  const hits = [];
  const cap = Math.min(50, Math.max(1, Number(maxHits) || 15));

  // Try to parse start row from A1 (e.g. Admin.!A2:M200 → 2)
  const startRowMatch = String(range).match(/![A-Z]+(\d+)/i);
  const startRow = startRowMatch ? Number(startRowMatch[1]) : 1;

  for (let i = 0; i < values.length; i++) {
    const row = values[i] || [];
    const joined = row.map((c) => String(c ?? "")).join(" \t ").toLowerCase();
    if (joined.includes(q)) {
      hits.push({
        row: startRow + i,
        values: row.slice(0, 20),
        preview: row.slice(0, 8).map((c) => String(c ?? "").slice(0, 80)).join(" | "),
      });
      if (hits.length >= cap) break;
    }
  }
  return {
    ok: true,
    workbook: resolved.alias,
    range: res.data.range || range,
    query: q,
    hitCount: hits.length,
    hits,
  };
}

/**
 * Pending Admin inquiries (I filled, M empty).
 */
export async function getPendingAdmin(logger) {
  try {
    const rows = await getBmcChatInquiries(config, logger);
    return { ok: true, count: rows.length, inquiries: rows };
  } catch (err) {
    return { ok: false, error: err.message || "pending_admin_failed" };
  }
}

/**
 * Dry-run write proposal (no mutation).
 */
export function proposeWrite({ workbook = "admin", range, values } = {}) {
  const resolved = resolveWorkbook(workbook);
  if (!resolved.ok) return resolved;
  if (!range) return { ok: false, error: "range_required" };
  if (!Array.isArray(values) || values.length === 0) {
    return { ok: false, error: "values_required", hint: "values: array of rows, each row array of cells" };
  }
  const sanitized = values.map((row) =>
    (Array.isArray(row) ? row : [row]).map((c) => sanitizeCellValue(c))
  );
  return {
    ok: true,
    dry_run: true,
    workbook: resolved.alias,
    spreadsheetId: resolved.spreadsheetId,
    range: String(range).trim(),
    values: sanitized,
    message: "Propuesta lista. Para ejecutar, pedí confirmación al operador y llamá sheets_write_range con user_confirmed=true y los mismos values.",
  };
}

/**
 * Confirmed write to allowlisted sheet.
 */
export async function writeRange({ workbook = "admin", range, values } = {}) {
  const resolved = resolveWorkbook(workbook);
  if (!resolved.ok) return resolved;
  if (!range) return { ok: false, error: "range_required" };
  if (!Array.isArray(values) || values.length === 0) {
    return { ok: false, error: "values_required" };
  }
  const sanitized = values.map((row) =>
    (Array.isArray(row) ? row : [row]).map((c) => sanitizeCellValue(c))
  );
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.update({
    spreadsheetId: resolved.spreadsheetId,
    range: String(range).trim(),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: sanitized },
  });
  return {
    ok: true,
    workbook: resolved.alias,
    updatedRange: res.data.updatedRange,
    updatedCells: res.data.updatedCells,
    updatedRows: res.data.updatedRows,
  };
}
