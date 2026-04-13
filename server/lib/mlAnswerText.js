/**
 * Mercado Libre strips "$" (ASCII and often U+FF04) from answer text sent via POST /answers.
 * Uruguayan "U$S" then degrades visually to "US" next to amounts. We map **U$S → USD**
 * (ASCII, no dollar glyph) before send. Any remaining ASCII `$` is still mapped to
 * fullwidth U+FF04 as a best-effort for lone symbols.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeMlAnswerCurrencyText(text) {
  let s = String(text);
  s = s.replace(/U\$S/gi, "USD");
  s = s.replace(/\$/g, "\uFF04");
  return s;
}
