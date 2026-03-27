/**
 * Google Sheets A1 column letters ↔ 0-based array index (row[col]).
 * Matches Excel / Sheets: A=0, Z=25, AA=26, …
 */

export function colIndexToLetter(index) {
  let letter = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/**
 * @param {string} letters e.g. "A", "Z", "AA"
 * @returns {number} 0-based index
 */
export function colLetterToIndex(letters) {
  const s = String(letters ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (!s.length) {
    throw new Error(`Invalid sheet column: ${JSON.stringify(letters)}`);
  }
  let num = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i) - 64;
    if (c < 1 || c > 26) {
      throw new Error(`Invalid sheet column: ${JSON.stringify(letters)}`);
    }
    num = num * 26 + c;
  }
  return num - 1;
}
