/**
 * Phone number normalization for WA Cockpit ilike search.
 *
 * The backend `/api/wa/conversations?q=<x>` runs `phone ilike '%x%'` over
 * `wa_conversations.phone` (stored as digit-only with UY country code, e.g.
 * "59899162401"). Any non-digit chars in `x` (spaces, dashes, parens, plus
 * sign, "+598" prefix wonkiness) will silently miss matches.
 *
 * This helper strips everything that's not a digit and prepends "598" when
 * the number looks like a UY domestic line (8 or 9 digits, no country code).
 *
 * Examples:
 *   "+598 99 162 401"   → "59899162401"
 *   "99 162 401"        → "59899162401"
 *   "42224031"          → "59842224031"
 *   "099162401"         → "598099162401"  (leading 0 kept — ilike still matches)
 *   "(55) 41 9799-0617" → "554197990617"  (foreign 12 digits, no prefix added)
 *
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function normalizePhoneForWaQuery(raw) {
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if ((digits.length === 8 || digits.length === 9) && !digits.startsWith("598")) {
    return `598${digits}`;
  }
  return digits;
}
