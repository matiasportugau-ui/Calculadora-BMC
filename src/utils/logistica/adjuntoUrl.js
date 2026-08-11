/**
 * Extract a clean Drive/Dropbox https URL from messy Ventas ENCARGO cells.
 *
 * gviz CSV often exports HYPERLINK display text (filename.pdf) without the URL,
 * or cells wrap the link ("Ver PDF https://drive…", quotes, =HYPERLINK(...)).
 * The adjunto proxy only accepts https Drive/Dropbox — bare filenames must not
 * be sent as URLs (they become url_invalid → "URL no permitida").
 */

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isAdjuntoAllowedHost(hostname) {
  const h = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (!h) return false;
  if (
    h === "drive.google.com" ||
    h === "docs.google.com" ||
    // Drive uc?export=download 303 target (2026+) — not under *.googleusercontent.com
    h === "drive.usercontent.google.com" ||
    h === "www.dropbox.com" ||
    h === "dropbox.com" ||
    h === "dl.dropbox.com" ||
    h === "dl.dropboxusercontent.com"
  ) {
    return true;
  }
  if (h === "googleusercontent.com" || h.endsWith(".googleusercontent.com")) return true;
  if (h.endsWith(".drive.usercontent.google.com")) return true;
  if (h.endsWith(".dropboxusercontent.com")) return true;
  return false;
}

/**
 * @param {string} url
 * @returns {string}
 */
export function extractGoogleDriveFileId(url) {
  const s = String(url || "");
  const m1 = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return "";
}

/**
 * Pull the first usable Drive/Dropbox https URL from a cell / paste.
 * @param {string} raw
 * @returns {string} absolute https URL or ""
 */
export function extractAdjuntoHttpsUrl(raw) {
  const t = String(raw || "").trim();
  if (!t) return "";

  let s = t.replace(/^["'`«»]+|["'`«»]+$/g, "").trim();

  // =HYPERLINK("url","label") / HYPERLINK("url"; "label")
  const hl =
    s.match(/HYPERLINK\s*\(\s*"([^"]+)"/i) ||
    s.match(/HYPERLINK\s*\(\s*'([^']+)'/i);
  if (hl?.[1]) s = String(hl[1]).trim();

  // First https://… candidate that lands on an allowed host
  const httpsMatches = s.match(/https:\/\/[^\s<>"'`)\]}]+/gi) || [];
  for (const m of httpsMatches) {
    const cleaned = m.replace(/[),.;]+$/g, "");
    try {
      const u = new URL(cleaned);
      if (u.protocol === "https:" && isAdjuntoAllowedHost(u.hostname)) {
        return u.href;
      }
    } catch {
      /* try next */
    }
  }

  // Protocol-less drive/docs/dropbox (common paste)
  const protoLess = s.match(
    /(?:^|[\s(])((?:drive|docs)\.google\.com\/[^\s<>"')\]]+|www\.dropbox\.com\/[^\s<>"')\]]+|dropbox\.com\/[^\s<>"')\]]+|dl\.dropbox(?:usercontent)?\.com\/[^\s<>"')\]]+)/i,
  );
  if (protoLess?.[1]) {
    const candidate = `https://${protoLess[1].replace(/[),.;]+$/g, "")}`;
    try {
      const u = new URL(candidate);
      if (isAdjuntoAllowedHost(u.hostname)) return u.href;
    } catch {
      /* fall through */
    }
  }

  // Drive file id embedded without full host (rare)
  const fileId =
    s.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/) ||
    (/drive|google|docs/i.test(s) ? s.match(/(?:^|[?&\s])id=([a-zA-Z0-9_-]{10,})/i) : null);
  if (fileId?.[1]) {
    return `https://drive.google.com/file/d/${fileId[1]}/view`;
  }

  // Already a clean single https URL?
  if (/^https:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol === "https:" && isAdjuntoAllowedHost(u.hostname)) return u.href;
    } catch {
      /* ignore */
    }
  }

  return "";
}

/**
 * Operator-facing hint when a cell looks like a filename, not a share link.
 * @param {string} raw
 * @returns {string}
 */
export function adjuntoUrlMissingHint(raw) {
  const t = String(raw || "").trim();
  if (!t) return "Sin URL de adjunto.";
  if (/\.pdf(\?|$)/i.test(t) || /cotizaci|encargo|presupuesto/i.test(t)) {
    return (
      "ENCARGO trae nombre de archivo (o texto), no un enlace https de Drive/Dropbox. " +
      "La planilla a veces exporta solo el título del HYPERLINK. " +
      "Pegá el link «Compartir» del PDF en «Link PDF pedido», o copiá las líneas de producto."
    );
  }
  return (
    "URL de adjunto no permitida (solo https Drive/Dropbox). " +
    "Revisá el campo «Link PDF pedido»."
  );
}
