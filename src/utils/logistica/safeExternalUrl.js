/**
 * Safe external URL helpers for map / PDF / tel links (Envíos /logistica).
 * Blocks javascript: and other dangerous schemes.
 *
 * Drawer uses these explicitly; `resolveSafeBtnHref` is the Btn gate so
 * search-result / stop-card PDF+Mapa buttons cannot execute sheet-controlled XSS.
 */

const BLOCKED = /^(javascript|data|vbscript|file):/i;

/**
 * Escape text for contexts that still go through HTML parsers (e.g. Leaflet
 * string tooltips historically used innerHTML). Prefer DOM textContent when
 * possible; this helper is for tests and any residual string sinks.
 * @param {unknown} raw
 * @returns {string}
 */
export function escapeHtml(raw) {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * @param {string} [raw]
 * @param {{ allowRelative?: boolean }} [opts]
 * @returns {string|null} safe href or null
 */
export function safeHttpUrl(raw, opts = {}) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (BLOCKED.test(s)) return null;
  if (s.startsWith("//")) {
    try {
      const u = new URL(`https:${s}`);
      if (u.protocol === "http:" || u.protocol === "https:") return u.href;
    } catch {
      return null;
    }
    return null;
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol === "http:" || u.protocol === "https:") return u.href;
    } catch {
      return null;
    }
    return null;
  }
  if (opts.allowRelative && s.startsWith("/")) return s;
  return null;
}

/**
 * Sanitize href for Envíos `<Btn href>` / `<a href>` (http(s) only).
 * @param {string} [raw]
 * @returns {string|null}
 */
export function resolveSafeBtnHref(raw) {
  return safeHttpUrl(raw);
}

/**
 * @param {string} [raw]
 * @returns {string|null} tel: href
 */
export function safeTelUrl(raw) {
  const digits = String(raw || "").replace(/[^\d+]/g, "");
  if (!digits || digits.length < 6) return null;
  if (!/^\+?\d{6,20}$/.test(digits)) return null;
  return `tel:${digits}`;
}
