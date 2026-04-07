/**
 * Mercado Libre strips ASCII "$" from answer text sent via POST /answers
 * (e.g. "U$S 1.234" becomes "U 1.234" in stored answer.text).
 * Fullwidth dollar U+FF04 is preserved and reads like U$S in the listing.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeMlAnswerCurrencyText(text) {
  return String(text).replace(/\$/g, "\uFF04");
}
