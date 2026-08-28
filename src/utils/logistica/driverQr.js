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
