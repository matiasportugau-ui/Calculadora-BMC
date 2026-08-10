/**
 * Resolve `?openBmc=` deep-link values to a fetchable public GCS URL.
 * Only https://storage.googleapis.com/bmc-cotizaciones/…/*.json is allowed.
 *
 * Short keys (no scheme):
 * - `Sory-IsoRoof-Foil-30` → quotes/bmc-json/<key>.bmc.json
 * - `quotes/bmc-json/foo.bmc.json` → same path under the bucket
 *
 * Full URLs must already target the allowlisted host+bucket; path is re-checked
 * after URL normalization so `../` cannot escape the bucket.
 */

const GCS_HOST = "storage.googleapis.com";
const GCS_BUCKET_PREFIX = "/bmc-cotizaciones/";
const GCS_BASE = `https://${GCS_HOST}${GCS_BUCKET_PREFIX}`;

/**
 * @param {string} href
 * @returns {boolean}
 */
export function isAllowedOpenBmcUrl(href) {
  let u;
  try {
    u = new URL(href);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.hostname !== GCS_HOST) return false;
  if (u.username || u.password) return false;
  // URL() normalizes `.` / `..`; reject any residual traversal markers.
  if (u.pathname.includes("..")) return false;
  if (!u.pathname.startsWith(GCS_BUCKET_PREFIX)) return false;
  if (u.pathname.length <= GCS_BUCKET_PREFIX.length) return false;
  const lower = u.pathname.toLowerCase();
  if (!lower.endsWith(".bmc.json") && !lower.endsWith(".json")) return false;
  return true;
}

/**
 * @param {unknown} raw
 * @returns {string|null} Absolute https URL or null if rejected
 */
export function resolveOpenBmcUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  let candidate;
  if (/^https?:\/\//i.test(s)) {
    candidate = s;
  } else {
    // Reject traversal / encoding tricks before joining onto the bucket base.
    if (
      s.includes("..")
      || s.includes("\\")
      || /%2e/i.test(s)
      || /%5c/i.test(s)
      || /%2f/i.test(s)
    ) {
      return null;
    }
    const key = s.replace(/^\//, "");
    if (!key) return null;
    const path = key.includes("/")
      ? key
      : `quotes/bmc-json/${key.endsWith(".bmc.json") || key.endsWith(".json") ? key : `${key}.bmc.json`}`;
    candidate = `${GCS_BASE}${path.replace(/^bmc-cotizaciones\//, "")}`;
  }

  let u;
  try {
    u = new URL(candidate);
  } catch {
    return null;
  }
  // Drop query/hash — object identity is the path only.
  u.search = "";
  u.hash = "";
  if (!isAllowedOpenBmcUrl(u.href)) return null;
  return u.href;
}
