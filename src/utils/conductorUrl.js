/**
 * Public chofer PWA URL. Always the Vite SPA host, never Cloud Run.
 */
export function conductorPublicUrl(frontendBaseUrl, token) {
  const spa = String(frontendBaseUrl || "https://calculadora-bmc.vercel.app").replace(/\/$/, "");
  const q = token ? `?t=${encodeURIComponent(token)}` : "";
  return `${spa}/conductor${q}`;
}

export function conductorLegacyPath() {
  return "/calculadora/conductor";
}

/**
 * Chofer may paste the full confirm link or the raw t= value.
 */
export function extractDriverTokenFromPaste(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    const t = u.searchParams.get("t");
    if (t) return t;
  } catch {
    /* not an absolute URL */
  }
  const m = s.match(/[?&]t=([^&\s#]+)/i);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return s;
}
