/**
 * Open (or focus) the Panelin Co-Work desk window.
 * Named window "panelin-cowork" — reopen focuses the same instance (SDD §10.4.2 / §20 #12).
 */

export const PANELIN_COWORK_WINDOW_NAME = "panelin-cowork";

const RECT_KEY = "panelin-cowork-desk-rect";

/** Safe Vite env read (works under Node tests without import.meta.env). */
function viteEnv(name) {
  try {
    const env = import.meta.env;
    return env?.[name];
  } catch {
    return undefined;
  }
}

/**
 * Basename without importing routerBasename (avoids hard import.meta.env throw in Node).
 * @returns {string | undefined}
 */
function getBasename() {
  const raw = viteEnv("BASE_URL") || "/";
  const b = String(raw).replace(/\/+$/, "");
  if (b === "" || b === "/") return undefined;
  return b;
}

function envInt(name, fallback) {
  const n = Number(viteEnv(name));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

export function defaultDeskSize() {
  return {
    width: envInt("VITE_COWORK_DESK_DEFAULT_W", 420),
    height: envInt("VITE_COWORK_DESK_DEFAULT_H", 720),
  };
}

/** @returns {{ width: number, height: number }} */
export function readStoredDeskSize() {
  const fallback = defaultDeskSize();
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(RECT_KEY);
    if (!raw) return fallback;
    const o = JSON.parse(raw);
    const width = Number(o?.width);
    const height = Number(o?.height);
    return {
      width: Number.isFinite(width) && width >= 320 ? Math.round(width) : fallback.width,
      height: Number.isFinite(height) && height >= 400 ? Math.round(height) : fallback.height,
    };
  } catch {
    return fallback;
  }
}

/** @param {{ width?: number, height?: number }} rect */
export function persistDeskSize(rect) {
  try {
    if (typeof localStorage === "undefined") return;
    const cur = readStoredDeskSize();
    localStorage.setItem(
      RECT_KEY,
      JSON.stringify({
        width: Number(rect?.width) > 0 ? Math.round(rect.width) : cur.width,
        height: Number(rect?.height) > 0 ? Math.round(rect.height) : cur.height,
      }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Build absolute URL for the desk route (respects Vite basename).
 * @param {{ origin?: string, searchParams?: Record<string, string> }} [opts]
 */
export function buildPanelinCoworkDeskUrl(opts = {}) {
  const origin =
    opts.origin ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const basename = getBasename();
  const basePath = basename ? `${basename}/panelin/cowork` : "/panelin/cowork";
  const url = new URL(basePath, origin.endsWith("/") ? origin : `${origin}/`);
  url.searchParams.set("floating", "1");
  url.searchParams.set("cowork", "1");
  if (opts.searchParams && typeof opts.searchParams === "object") {
    for (const [k, v] of Object.entries(opts.searchParams)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Open or focus the named Co-Work desk popup.
 * @param {{ width?: number, height?: number, origin?: string }} [opts]
 * @returns {Window | null}
 */
export function openPanelinCoworkDesk(opts = {}) {
  if (typeof window === "undefined") return null;
  const size = {
    ...readStoredDeskSize(),
    ...(opts.width ? { width: opts.width } : {}),
    ...(opts.height ? { height: opts.height } : {}),
  };
  const url = buildPanelinCoworkDeskUrl({ origin: opts.origin || window.location.origin });
  const features = [
    "popup=yes",
    `width=${size.width}`,
    `height=${size.height}`,
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
  // Same name → browser reuses/focuses existing window when possible.
  const win = window.open(url, PANELIN_COWORK_WINDOW_NAME, features);
  try {
    win?.focus?.();
  } catch {
    /* cross-origin focus rare on same-origin */
  }
  return win;
}

export function isPanelinCoworkDeskWindow() {
  if (typeof window === "undefined") return false;
  try {
    const p = new URLSearchParams(window.location.search);
    return (
      window.location.pathname.replace(/\/+$/, "").endsWith("/panelin/cowork") ||
      (p.get("cowork") === "1" && p.get("floating") === "1")
    );
  } catch {
    return false;
  }
}
