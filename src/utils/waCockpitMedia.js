/**
 * WA Cockpit media display helpers.
 *
 * <img>/<audio> cannot send Authorization headers. Putting JWT or API_AUTH_TOKEN
 * in ?key= fails for identity JWTs (requireWaAccess only accepts shared token
 * there) and leaks secrets via history / Referer on the 302→GCS redirect.
 *
 * Resolve a short-lived signed GCS URL via Bearer + ?json=1 instead.
 */

/**
 * @param {string} apiBase
 * @param {string} mediaUrl relative `/api/wa/media/...` or absolute URL
 * @returns {string|null}
 */
export function buildWaMediaJsonUrl(apiBase, mediaUrl) {
  if (!mediaUrl) return null;
  const base = String(apiBase || "").replace(/\/+$/, "");
  const path = mediaUrl.startsWith("http")
    ? mediaUrl
    : `${base}${mediaUrl.startsWith("/") ? "" : "/"}${mediaUrl}`;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}json=1`;
}

/**
 * @param {string} apiBase
 * @param {string} mediaUrl
 * @param {string} token Bearer token (identity JWT or API_AUTH_TOKEN)
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<string|null>} signed GCS URL or null
 */
export async function resolveWaMediaSignedUrl(apiBase, mediaUrl, token, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const jsonUrl = buildWaMediaJsonUrl(apiBase, mediaUrl);
  if (!jsonUrl || !token || typeof fetchImpl !== "function") return null;

  const headers = { Authorization: `Bearer ${token}` };
  const r = await fetchImpl(jsonUrl, { headers, credentials: "include" });
  if (!r.ok) return null;
  let data;
  try {
    data = await r.json();
  } catch {
    return null;
  }
  const url = data?.url != null ? String(data.url).trim() : "";
  return url || null;
}
