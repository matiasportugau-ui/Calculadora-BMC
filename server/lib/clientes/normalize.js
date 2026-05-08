// ═══════════════════════════════════════════════════════════════════════════
// server/lib/clientes/normalize.js — pure normalization helpers.
// ───────────────────────────────────────────────────────────────────────────
// Used by customerResolver.js to canonicalize contact hints across channels.
// All exports are pure functions (no I/O, no globals).
//
// Rationale: Sheets, ML, Shopify, WhatsApp each store phone/email/RUT in
// different formats. Without normalization, the same person looks like 3+
// distinct customers. These helpers produce stable keys for matching.
// ═══════════════════════════════════════════════════════════════════════════

const UY_COUNTRY_CODE = "598";

/**
 * Normalize a phone number to E.164 (without the leading '+').
 *
 * Uruguay-specific rules:
 *   - Strip all non-digits.
 *   - If empty after stripping, return null.
 *   - If already starts with country code 598 and length 11-12 → keep.
 *   - If 8-9 digits → prepend 598 (typical UY local format).
 *   - If has leading '00598...' (international dial prefix) → drop the '00'.
 *   - Otherwise return the digits as-is (foreign number, not UY).
 *
 * @param {string|null|undefined} input
 * @returns {string|null} E.164 digits without '+', or null if invalid.
 */
export function normalizePhoneE164UY(input) {
  if (input == null) return null;
  let digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  // Drop international dial prefix '00' (e.g. '0059899...')
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Already E.164 with UY country code: keep
  if (digits.startsWith(UY_COUNTRY_CODE) && digits.length === 11) {
    return digits;
  }
  // 9 digits starting with '0' = local format with trunk prefix → drop the 0
  if (digits.length === 9 && digits.startsWith("0")) {
    return UY_COUNTRY_CODE + digits.slice(1);
  }
  // 8 digits = local subscriber without trunk prefix → prepend country code
  if (digits.length === 8) {
    return UY_COUNTRY_CODE + digits;
  }
  // Anything else: foreign number or invalid length — return digits as-is
  return digits;
}

/**
 * Normalize an email: lowercase + trim. Returns null if empty or not email-shaped.
 * @param {string|null|undefined} input
 * @returns {string|null}
 */
export function normalizeEmail(input) {
  if (input == null) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  if (!s.includes("@") || s.indexOf("@") === 0 || s.endsWith("@")) return null;
  return s;
}

/**
 * Normalize a RUT (Uruguay) to digit-only form.
 * UY RUT is 12 digits. Returns null if empty after digit-strip,
 * or if not exactly 12 digits (so we don't false-positive on partial input).
 * @param {string|null|undefined} input
 * @returns {string|null}
 */
export function normalizeRut(input) {
  if (input == null) return null;
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length !== 12) return null;
  return digits;
}

/**
 * Normalize a display name for fuzzy comparison: lowercase + collapse
 * whitespace + strip diacritics + drop punctuation. Used as input to
 * Levenshtein distance.
 * @param {string|null|undefined} input
 * @returns {string}
 */
export function normalizeDisplayName(input) {
  if (input == null) return "";
  return String(input)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Levenshtein edit distance between two strings.
 * Iterative two-row implementation, O(n·m) time, O(min(n,m)) space.
 * Returns Infinity when either input is null/undefined.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  if (a == null || b == null) return Infinity;
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (a.length < b.length) {
    const tmp = a;
    a = b;
    b = tmp;
  }
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[b.length];
}

/**
 * Convenience: are two display names a fuzzy match within `maxDistance`?
 * Uses normalizeDisplayName before computing distance. Empty inputs never match.
 * @param {string} a
 * @param {string} b
 * @param {number} maxDistance default 2
 * @returns {boolean}
 */
export function namesAreFuzzyMatch(a, b, maxDistance = 2) {
  const na = normalizeDisplayName(a);
  const nb = normalizeDisplayName(b);
  if (!na || !nb) return false;
  return levenshtein(na, nb) <= maxDistance;
}
