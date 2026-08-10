/**
 * Envíos adjunto-fetch — URL allowlist + bounded body read (SSRF / DoS guard).
 * Used by POST /api/envios/adjunto-fetch.
 */

import { extractAdjuntoHttpsUrl } from "../../src/utils/logistica/adjuntoUrl.js";

export const ADJUNTO_MAX_BYTES = 12 * 1024 * 1024;
export const ADJUNTO_MAX_REDIRECTS = 5;
export const ADJUNTO_FETCH_TIMEOUT_MS = 25_000;

/**
 * Hosts allowed for the *initial* client URL and rewritten fetch URL.
 * Keep in sync with Vercel CSP `connect-src` adjunto hosts in `vercel.json`
 * (exact https://host entries; googleusercontent uses wildcard suffix rule).
 * Enforced by `tests/cspAdjuntoConnectSrc.test.js`.
 */
export const ADJUNTO_ALLOWED_HOSTS = Object.freeze([
  "drive.google.com",
  "docs.google.com",
  "www.dropbox.com",
  "dropbox.com",
  "dl.dropbox.com",
  "dl.dropboxusercontent.com",
]);

const ADJUNTO_HOST_ALLOW = new Set(ADJUNTO_ALLOWED_HOSTS);

/**
 * Drive/Docs often redirect download to *.googleusercontent.com CDNs.
 * @param {string} hostname
 */
export function isAllowedAdjuntoHost(hostname) {
  const h = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (!h) return false;
  if (ADJUNTO_HOST_ALLOW.has(h)) return true;
  if (h === "googleusercontent.com" || h.endsWith(".googleusercontent.com")) return true;
  return false;
}

/**
 * @param {string} hostname
 */
function looksLikeIpLiteral(hostname) {
  const h = String(hostname || "").replace(/^\[|\]$/g, "");
  // IPv4
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(h)) return true;
  // IPv6 (coarse)
  if (h.includes(":")) return true;
  return false;
}

/**
 * Validate an absolute adjunto URL for server-side fetch (SSRF guard).
 * @param {string} raw
 * @returns {{ href: string, url: URL }}
 */
export function assertAllowedAdjuntoUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) {
    const err = new Error("url_required");
    err.code = "url_required";
    throw err;
  }
  let u;
  try {
    u = new URL(s);
  } catch {
    const err = new Error("url_invalid");
    err.code = "url_invalid";
    throw err;
  }
  if (u.protocol !== "https:") {
    const err = new Error("url_https_required");
    err.code = "url_https_required";
    throw err;
  }
  if (u.username || u.password) {
    const err = new Error("url_credentials_forbidden");
    err.code = "url_credentials_forbidden";
    throw err;
  }
  if (looksLikeIpLiteral(u.hostname)) {
    const err = new Error("url_host_forbidden");
    err.code = "url_host_forbidden";
    throw err;
  }
  if (!isAllowedAdjuntoHost(u.hostname)) {
    const err = new Error("url_host_forbidden");
    err.code = "url_host_forbidden";
    throw err;
  }
  return { href: u.href, url: u };
}

export function extractGoogleDriveFileId(url) {
  const s = String(url || "");
  const m1 = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return "";
}

/**
 * Rewrite Drive/Dropbox share links to a direct-download form.
 * Caller must still pass the result through assertAllowedAdjuntoUrl.
 * @param {string} url
 */
export function toServerFetchablePdfUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  const driveId = extractGoogleDriveFileId(raw);
  if (driveId) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (host === "www.dropbox.com" || host === "dropbox.com" || host === "dl.dropbox.com") {
      u.searchParams.set("dl", "1");
      return u.toString();
    }
  } catch {
    /* fall through */
  }
  return raw;
}

/**
 * Read response body up to maxBytes; reject oversized Content-Length early.
 * @param {Response} response
 * @param {number} [maxBytes]
 */
export async function readBodyWithLimit(response, maxBytes = ADJUNTO_MAX_BYTES) {
  const cl = response.headers?.get?.("content-length");
  if (cl != null && cl !== "" && Number(cl) > maxBytes) {
    const err = new Error("file_too_large");
    err.code = "file_too_large";
    throw err;
  }

  const reader = response.body?.getReader?.();
  if (!reader) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      const err = new Error("file_too_large");
      err.code = "file_too_large";
      throw err;
    }
    return buf;
  }

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      const err = new Error("file_too_large");
      err.code = "file_too_large";
      throw err;
    }
    chunks.push(Buffer.from(value));
  }
  return chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
}

/**
 * Fetch adjunto with host allowlist re-checked on every redirect hop.
 * @param {string} startUrl already rewritten / validated preferred
 * @param {{ fetchImpl?: typeof fetch, maxRedirects?: number, timeoutMs?: number }} [opts]
 */
export async function fetchAdjuntoUpstream(startUrl, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const maxRedirects = opts.maxRedirects ?? ADJUNTO_MAX_REDIRECTS;
  const timeoutMs = opts.timeoutMs ?? ADJUNTO_FETCH_TIMEOUT_MS;

  let current = String(startUrl || "").trim();
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const { href } = assertAllowedAdjuntoUrl(current);
    const upstream = await fetchImpl(href, {
      headers: {
        Accept: "application/pdf,application/octet-stream,*/*",
        "User-Agent": "BMC-Envios/1.0 (adjunto-fetch)",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const loc = upstream.headers.get("location");
      if (!loc) {
        const err = new Error("redirect_missing_location");
        err.code = "redirect_missing_location";
        throw err;
      }
      // Relative Location → resolve against current
      current = new URL(loc, href).href;
      continue;
    }

    return { upstream, fetchUrl: href };
  }

  const err = new Error("too_many_redirects");
  err.code = "too_many_redirects";
  throw err;
}

/**
 * Resolve client URL → validated fetch URL (allowlist + Drive/Dropbox rewrite).
 * Accepts messy cells (HYPERLINK, "Ver PDF https://…") via extractAdjuntoHttpsUrl.
 * @param {string} clientUrl
 */
export function resolveAdjuntoFetchUrl(clientUrl) {
  const extracted = extractAdjuntoHttpsUrl(clientUrl) || String(clientUrl || "").trim();
  // Validate the (possibly cleaned) URL first (blocks SSRF before rewrite).
  assertAllowedAdjuntoUrl(extracted);
  const fetchUrl = toServerFetchablePdfUrl(extracted);
  return assertAllowedAdjuntoUrl(fetchUrl).href;
}
