/**
 * BMC Envíos — allowlist hrefs for operator-facing links (map / PDF / tel).
 * Stops javascript:/data:/etc. XSS when sheet or form fields land in <a href>.
 */

/**
 * Allow only absolute http(s) URLs for target=_blank navigation.
 * @param {unknown} raw
 * @returns {string} safe href or "" when rejected
 */
export function safeExternalHref(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  let u;
  try {
    u = new URL(s);
  } catch {
    return "";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  // Normalize so browsers never see mixed-case javascript: smuggling leftovers.
  return u.href;
}

/**
 * Build a tel: href from free-text phone; reject scheme breakouts.
 * @param {unknown} raw
 * @returns {string} "tel:..." or "" when empty/unsafe
 */
export function safeTelHref(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  // Digits and common phone punctuation only (no colon / scheme injection).
  const cleaned = s.replace(/[^\d+*#().\-\s]/g, "").replace(/\s+/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return "";
  if (cleaned.length > 32) return "";
  return `tel:${cleaned}`;
}
