/**
 * crmRowMapper — header-anchored, KEY-BASED row builder for CRM_Operativo writes.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every Sheets writer in this repo used to build rows by *blind position*:
 * a hand-counted array `[fecha, cliente, telefono, ubicacion, …]` appended to
 * `B:AK`, or range-anchored updates that assume B=Fecha, C=Cliente, D=Teléfono…
 * That contract is fragile: the day a column is inserted/renamed in the sheet,
 * or a writer forgets one field, every subsequent value silently shifts one
 * column to the left (e.g. a missing `Teléfono` pushes Ubicación into the
 * Teléfono column and so on down the row).
 *
 * This module makes the column contract EXPLICIT and KEY-BASED:
 *   1. Read the real headers from row 3 of CRM_Operativo.
 *   2. Map each logical lead key to the column whose header matches it
 *      (accent/case-insensitive), falling back to the documented column letter
 *      when the header can't be found.
 *   3. Place every value at its resolved index; fields the caller didn't
 *      provide stay "" (the key is never omitted, the index never skipped).
 *   4. Validate the built row BEFORE it hits `spreadsheets.values` so a
 *      structurally broken sheet degrades gracefully instead of writing a
 *      shifted/corrupted row.
 *
 * Canon for column letters/headers:
 *   - server/routes/bmcDashboard.js  CRM_TO_BMC (read-side header text)
 *   - server/lib/crmRowParse.js      parseCrmRowAtoAK (read-side positions)
 *   - server/lib/crmOperativoLayout.js (AG–AN gate/taxonomy block)
 *   - docs/team/panelsim/CRM-OPERATIVO-COCKPIT.md
 */

import { colLetterToIndex } from "./sheetColumnLetters.js";

/**
 * Single source of truth for the CRM_Operativo write contract.
 * `key`     logical field name used by callers (and by the email/quote leads).
 * `col`     documented column LETTER — used as fallback when the header text
 *           can't be matched, so behaviour never regresses below today's.
 * `headers` accepted header strings (row 3). Matched accent/case-insensitively;
 *           the first header in row 3 matching ANY alias wins.
 *
 * Order mirrors physical column order for readability; it does NOT drive
 * placement (placement is always by resolved index).
 */
export const CRM_WRITE_CONTRACT = Object.freeze([
  { key: "fecha", col: "B", headers: ["Fecha"] },
  { key: "cliente", col: "C", headers: ["Cliente"] },
  { key: "telefono", col: "D", headers: ["Teléfono", "Telefono"] },
  { key: "ubicacion", col: "E", headers: ["Ubicación / Dirección", "Ubicación", "Dirección", "Ubicacion", "Direccion"] },
  { key: "origen", col: "F", headers: ["Origen"] },
  { key: "consulta", col: "G", headers: ["Consulta / Pedido", "Consulta", "Pedido"] },
  { key: "categoria", col: "H", headers: ["Categoría", "Categoria"] },
  { key: "estado", col: "J", headers: ["Estado"] },
  { key: "responsable", col: "K", headers: ["Responsable"] },
  { key: "probabilidad", col: "R", headers: ["Probabilidad de cierre", "Probabilidad cierre", "Probabilidad"] },
  { key: "urgencia", col: "S", headers: ["Urgencia"] },
  { key: "validarStock", col: "T", headers: ["Validar stock", "Validar Stock"] },
  { key: "tipoCliente", col: "V", headers: ["Tipo de cliente", "Tipo cliente"] },
  { key: "observaciones", col: "W", headers: ["Observaciones"] },
  // AG–AK gate block (crmOperativoLayout.js). Header text from CRM-OPERATIVO-COCKPIT.md.
  { key: "providerIa", col: "AG", headers: ["Provider IA"] },
  { key: "linkPresupuesto", col: "AH", headers: ["Link presupuesto"] },
  { key: "aprobadoEnviar", col: "AI", headers: ["Aprobado enviar"] },
  { key: "enviadoEl", col: "AJ", headers: ["Enviado el"] },
  { key: "bloquearAuto", col: "AK", headers: ["Bloquear auto"] },
]);

/** Minimum structural anchors that MUST resolve for a write to be trusted. */
export const REQUIRED_CRM_KEYS = Object.freeze(["fecha", "cliente", "estado"]);

const CONTRACT_BY_KEY = new Map(CRM_WRITE_CONTRACT.map((f) => [f.key, f]));

/** Furthest 0-based column index the contract can write (AK). */
const MAX_CONTRACT_INDEX = CRM_WRITE_CONTRACT.reduce(
  (max, f) => Math.max(max, colLetterToIndex(f.col)),
  0
);

/**
 * Normalize a header/alias for tolerant comparison: strip diacritics, lowercase,
 * collapse any run of non-alphanumeric chars to a single space, trim.
 * "Ubicación / Dirección" → "ubicacion direccion"; "Teléfono" → "telefono".
 * @param {unknown} s
 * @returns {string}
 */
export function normalizeHeader(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Build a `normalizedHeader -> first-occurrence index` lookup from a row-3 array.
 * @param {string[]} headers
 * @returns {Map<string, number>}
 */
export function buildHeaderIndex(headers) {
  const map = new Map();
  const arr = Array.isArray(headers) ? headers : [];
  for (let i = 0; i < arr.length; i++) {
    const norm = normalizeHeader(arr[i]);
    if (norm && !map.has(norm)) map.set(norm, i);
  }
  return map;
}

/**
 * Resolve the 0-based column index for a contract key.
 * @param {Map<string, number>} headerIndex - from buildHeaderIndex()
 * @param {string} key
 * @returns {{ index: number, source: "header"|"fallback"|"none" }}
 */
export function resolveCrmColumnIndex(headerIndex, key) {
  const field = CONTRACT_BY_KEY.get(key);
  if (!field) return { index: -1, source: "none" };
  for (const alias of field.headers) {
    const hit = headerIndex.get(normalizeHeader(alias));
    if (hit != null) return { index: hit, source: "header" };
  }
  return { index: colLetterToIndex(field.col), source: "fallback" };
}

/**
 * Build a header-anchored, key-based CRM row.
 *
 * @param {string[]} headers - row 3 of CRM_Operativo (`A3:ZZ3`). May be empty;
 *   with no headers every field resolves by its documented column letter.
 * @param {Record<string, unknown>} lead - logical field values. Missing/null
 *   fields are written as "" — the key is never omitted, no index is skipped.
 * @param {object} [opts]
 * @param {(v: unknown) => string} [opts.sanitize] - per-cell guard (CSV/formula).
 * @returns {{
 *   row: string[], resolved: Record<string, number>, fallbacks: string[],
 *   warnings: Array<{key:string, issue:string, index?:number}>,
 *   width: number, maxIndex: number
 * }}
 */
export function buildCrmRow(headers, lead = {}, opts = {}) {
  const sanitize = typeof opts.sanitize === "function" ? opts.sanitize : (v) => String(v ?? "");
  const headerIndex = buildHeaderIndex(headers);
  const headerLen = Array.isArray(headers) ? headers.length : 0;
  // Width must cover both the real sheet and every contract column we may touch.
  const width = Math.max(headerLen, MAX_CONTRACT_INDEX + 1);
  const row = new Array(width).fill("");
  const resolved = {};
  const fallbacks = [];
  const warnings = [];
  let maxIndex = 0;

  for (const field of CRM_WRITE_CONTRACT) {
    const value = lead[field.key];
    if (value === undefined) continue; // caller didn't address this column → leave ""
    const { index, source } = resolveCrmColumnIndex(headerIndex, field.key);
    if (index < 0 || index >= width) {
      warnings.push({ key: field.key, issue: "column_unresolved" });
      continue;
    }
    row[index] = sanitize(value == null ? "" : String(value));
    resolved[field.key] = index;
    if (index > maxIndex) maxIndex = index;
    if (source === "fallback") {
      fallbacks.push(field.key);
      warnings.push({ key: field.key, issue: "header_fallback", index });
    }
  }

  return { row, resolved, fallbacks, warnings, width, maxIndex };
}

/**
 * Validate a built row BEFORE writing. Catches the structural anomalies that
 * cause column-shift corruption so the caller can degrade gracefully.
 *
 * @param {ReturnType<typeof buildCrmRow>} built
 * @param {string[]} headers
 * @param {object} [opts]
 * @param {string[]} [opts.required] - keys that must resolve in-range.
 * @param {boolean} [opts.requireHeaders] - when true (default), an absent/short
 *   row-3 header set is treated as a structural failure (used by the email
 *   ingest path, which must refuse to write rather than risk a shifted row).
 *   When false, fixed-letter fallback is acceptable (used by the quote append
 *   path, whose pre-existing behaviour never read headers at all).
 * @param {{from: string, to: string}} [opts.window] - the contiguous A1 column
 *   window the caller will actually write (e.g. {from:"B", to:"W"}). Because
 *   values are placed at ABSOLUTE header-resolved indices but emitted through a
 *   fixed slice (sliceCrmRange), a field whose header drifts OUTSIDE this window
 *   would be silently dropped from the write. When `window` is given, any
 *   resolved field outside [from,to] is reported as `field_outside_write_range`
 *   so the caller degrades/aborts instead of writing a row missing that field.
 *   This check is intentionally ungated by `requireHeaders` — a dropped field is
 *   unsafe on every path.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateCrmRow(built, headers, opts = {}) {
  const required = opts.required || REQUIRED_CRM_KEYS;
  const requireHeaders = opts.requireHeaders !== false;
  const headerLen = Array.isArray(headers) ? headers.length : 0;
  const errors = [];

  if (!built || !Array.isArray(built.row)) {
    return { ok: false, errors: ["row_not_built"] };
  }

  if (requireHeaders && headerLen === 0) errors.push("headers_unavailable");

  for (const key of required) {
    const idx = built.resolved[key];
    if (idx == null || idx < 0) {
      errors.push(`unresolved_required:${key}`);
    } else if (requireHeaders && idx >= headerLen) {
      errors.push(`required_out_of_range:${key}`);
    }
  }

  // The furthest column we intend to write must exist in the real sheet,
  // otherwise the write would append phantom columns / shift the layout.
  if (requireHeaders && headerLen > 0 && built.maxIndex >= headerLen) {
    errors.push("row_exceeds_headers");
  }

  // Every resolved field must fall inside the caller's actual write window —
  // a field whose header drifted past the window edge would be dropped from the
  // contiguous slice while the rest still writes, which is silent corruption.
  if (opts.window && opts.window.from && opts.window.to) {
    const fromIdx = colLetterToIndex(opts.window.from);
    const toIdx = colLetterToIndex(opts.window.to);
    for (const [key, idx] of Object.entries(built.resolved)) {
      if (idx < fromIdx || idx > toIdx) {
        errors.push(`field_outside_write_range:${key}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Extract the contiguous A1 window `fromLetter:toLetter` from a full-width row,
 * so a writer can target an explicit range (e.g. "B".."W").
 * @param {string[]} row
 * @param {string} fromLetter
 * @param {string} toLetter
 * @returns {string[]}
 */
export function sliceCrmRange(row, fromLetter, toLetter) {
  const from = colLetterToIndex(fromLetter);
  const to = colLetterToIndex(toLetter);
  return row.slice(from, to + 1);
}

export default {
  CRM_WRITE_CONTRACT,
  REQUIRED_CRM_KEYS,
  normalizeHeader,
  buildHeaderIndex,
  resolveCrmColumnIndex,
  buildCrmRow,
  validateCrmRow,
  sliceCrmRange,
};
