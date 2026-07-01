/** True when Vite dev server or localhost SPA (skip Google OAuth). */
export function isLocalDevApp() {
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) return true;
  if (typeof window === "undefined") return false;
  return /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
}

/**
 * Mint bmc_sess via dev-only API (no Google popup). Returns auth JSON or null.
 */
export async function devBrowserLogin(apiBase = "") {
  if (!isLocalDevApp()) return null;
  const base = String(apiBase).replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/auth/dev-browser-login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user ? data : null;
  } catch {
    return null;
  }
}