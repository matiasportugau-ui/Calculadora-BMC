/**
 * Resolve `?openBmc=` deep-link targets to a public GCS .bmc.json URL.
 *
 * Allowlist: https://storage.googleapis.com/bmc-cotizaciones/... only.
 * Short keys are expanded under quotes/bmc-json/; path traversal (`..`,
 * encoded dots) must not escape that bucket after URL normalization.
 */

export const OPEN_BMC_GCS_PREFIX = "https://storage.googleapis.com/bmc-cotizaciones/";

/**
 * @param {string} raw
 * @returns {string|null} Absolute https URL inside bmc-cotizaciones, or null
 */
export function resolveOpenBmcUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;

  let candidate;
  if (/^https?:\/\//i.test(s)) {
    candidate = s;
  } else {
    const key = s.replace(/^\//, "");
    if (!key) return null;
    // Reject traversal before concat (raw or once-decoded).
    let decoded = key;
    try {
      decoded = decodeURIComponent(key);
    } catch {
      /* keep raw */
    }
    if (decoded.split("/").some((seg) => seg === ".." || seg === ".")) return null;
    if (/%2e%2e/i.test(key)) return null;

    const path = key.includes("/")
      ? key
      : `quotes/bmc-json/${key.endsWith(".bmc.json") || key.endsWith(".json") ? key : `${key}.bmc.json`}`;
    candidate = `${OPEN_BMC_GCS_PREFIX}${path.replace(/^bmc-cotizaciones\//, "")}`;
  }

  try {
    const u = new URL(candidate);
    // URL() normalizes `..` / `%2e%2e` — re-check allowlist on the final path.
    if (u.protocol !== "https:") return null;
    if (u.hostname !== "storage.googleapis.com") return null;
    if (!u.pathname.startsWith("/bmc-cotizaciones/")) return null;
    const lower = u.pathname.toLowerCase();
    if (!lower.endsWith(".bmc.json") && !lower.endsWith(".json")) return null;
    if (u.pathname.split("/").some((seg) => seg === ".." || seg === ".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}
