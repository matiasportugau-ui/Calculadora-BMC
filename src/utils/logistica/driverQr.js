/**
 * BMC Driver QR payloads. Always SPA host, never Cloud Run.
 */
import { conductorPublicUrl } from "../conductorUrl.js";

export function spaOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return String(window.location.origin).replace(/\/+$/, "");
  }
  return "https://calculadora-bmc.vercel.app";
}

export function driverInstallUrl(frontendBaseUrl) {
  return conductorPublicUrl(frontendBaseUrl, "");
}

export function driverRouteUrl(frontendBaseUrl, token) {
  return conductorPublicUrl(frontendBaseUrl, token);
}

export function isDriverRouteUrl(url) {
  const u = String(url || "");
  return u.includes("/conductor") && /[?&]t=/.test(u);
}

/** Escape text for HTML document.write (print QR). Prevents caption/URL XSS. */
export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Print-window HTML for a Driver QR. Caption and href are escaped;
 * src must be a data:image URL from QRCode.toDataURL.
 */
export function buildDriverQrPrintHtml({ caption, href, src, size = 240 } = {}) {
  const title = escapeHtml(caption || "BMC Driver");
  const safeHref = escapeHtml(href || "");
  const safeSrc = String(src || "");
  if (!safeSrc.startsWith("data:image/")) {
    return "";
  }
  const dim = Math.max(64, Math.min(1024, Number(size) || 240));
  return `<!doctype html><title>${title}</title><body style="font-family:system-ui;text-align:center;padding:24px">
       <h1 style="font-size:18px">${title}</h1>
       <img src="${safeSrc}" width="${dim}" height="${dim}" alt="QR" />
       <p style="font-size:12px;word-break:break-all">${safeHref}</p></body>`;
}
