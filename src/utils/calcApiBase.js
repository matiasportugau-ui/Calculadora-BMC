/**
 * Base URL for calculator → API calls (MATRIZ CSV, /calc/*, etc.).
 *
 * - **VITE_API_URL** (optional): explicit API host, required when the SPA is on a
 *   different origin than the API (e.g. Vercel → Cloud Run).
 * - **VITE_SAME_ORIGIN_API** = `1` / `true`: at build time, use `window.location.origin`
 *   in the browser (same Cloud Run service serves `/calculadora` and `/api`).
 * - **import.meta.env.DEV**: local Vite dev → `http://localhost:3001` unless VITE_API_URL is set.
 */

function trimBase(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

export function getCalcApiBase() {
  const fromEnv = typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_URL : undefined;
  if (fromEnv != null && String(fromEnv).trim() !== "") {
    return trimBase(fromEnv);
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    return "http://localhost:3001";
  }
  const sameOrigin =
    typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_SAME_ORIGIN_API === "1" ||
      String(import.meta.env?.VITE_SAME_ORIGIN_API || "").toLowerCase() === "true");
  if (sameOrigin && typeof window !== "undefined" && window.location?.origin) {
    return trimBase(window.location.origin);
  }
  return "http://localhost:3001";
}
