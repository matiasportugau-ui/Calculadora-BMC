/**
 * sheetsCsvGuard — shared CSV/formula injection guard for Sheets writes.
 *
 * Google Sheets `valueInputOption: "USER_ENTERED"` interprets cell values
 * starting with `=`, `+`, `-`, `@`, tab, or carriage return as formulas.
 * That makes user-supplied strings dangerous: e.g. an operator typing
 * `=HYPERLINK("http://evil.com")` into a Wolfboard reply, or a customer
 * name like `=cmd|'/c calc'!A1`, executes when the sheet recalculates.
 *
 * Sanitize by prefixing such values with a single apostrophe, which Sheets
 * treats as the "force literal text" marker (not displayed to the user).
 *
 * Centralized so every write path uses the exact same rules — Cursor's
 * security finding on `crmAppend.js` was the trigger; this module extends
 * the same guard to `server/routes/wolfboard.js` `/row` writes.
 */

const UNSAFE_LEADING = new Set(["=", "+", "-", "@", "\t", "\r", "\n"]);

/**
 * Sanitize a single cell value before writing with USER_ENTERED.
 * Checks the first *non-whitespace* character to defeat the bypass where a
 * leading space hides a formula trigger (e.g. " =HYPERLINK(...)" — Sheets
 * trims display whitespace but still evaluates the formula).
 * @param {unknown} s — anything coercible to string
 * @returns {string} — original value, or apostrophe-prefixed if leading non-WS char is a formula trigger
 */
export function sanitizeCellValue(s) {
  const v = String(s ?? "");
  if (!v) return "";
  // Raw first char check catches \t and \r directly (trimStart() would strip them
  // before they could be detected by the space-bypass check below).
  if (UNSAFE_LEADING.has(v.charAt(0))) return "'" + v;
  // Trim leading spaces to catch the " =formula" space-hiding bypass.
  const trimmed = v.trimStart();
  if (trimmed && UNSAFE_LEADING.has(trimmed.charAt(0))) return "'" + v;
  return v;
}
