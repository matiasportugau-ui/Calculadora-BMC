/**
 * BROU-of-the-day FX helper (UYU per 1 USD).
 * Injectable for tests; browser fetch is best-effort with cache.
 */

/** @type {number|null} */
let injectedRate = null;
/** @type {{ rate: number, at: number }|null} */
let memoryCache = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * @param {number|null} rate UYU per USD, or null to clear
 */
export function setBrouFxForTests(rate) {
  injectedRate = rate == null || !Number.isFinite(Number(rate)) ? null : Number(rate);
}

export function clearBrouFxCache() {
  memoryCache = null;
}

/**
 * @param {number} uyu
 * @param {number} uyuPerUsd
 * @returns {number|null} integer USD or null
 */
export function uyuToUsdInteger(uyu, uyuPerUsd) {
  const u = Number(uyu);
  const r = Number(uyuPerUsd);
  if (!Number.isFinite(u) || !Number.isFinite(r) || r <= 0) return null;
  return Math.round(u / r);
}

/**
 * Resolve FX rate: injected → memory → optional fetch.
 * @param {{ fetchImpl?: typeof fetch, forceRefresh?: boolean }} [opts]
 * @returns {Promise<{ rate: number|null, source: string, error?: string }>}
 */
export async function getBrouUsdSellRate(opts = {}) {
  if (injectedRate != null) {
    return { rate: injectedRate, source: "injected" };
  }
  const now = Date.now();
  if (!opts.forceRefresh && memoryCache && now - memoryCache.at < CACHE_TTL_MS) {
    return { rate: memoryCache.rate, source: "memory_cache" };
  }

  const fetchImpl = opts.fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!fetchImpl) {
    return { rate: null, source: "unavailable", error: "no_fetch" };
  }

  try {
    // Public Uruguay USD quotes (venta ≈ sell). Best-effort; not an official BROU API.
    const res = await fetchImpl("https://uy.dolarapi.com/v1/cotizaciones/usd", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { rate: memoryCache?.rate ?? null, source: memoryCache ? "stale_cache" : "http_error", error: `http_${res.status}` };
    }
    const data = await res.json();
    const venta = Number(data?.venta ?? data?.sell ?? data?.value);
    if (!Number.isFinite(venta) || venta <= 0) {
      return { rate: memoryCache?.rate ?? null, source: memoryCache ? "stale_cache" : "parse_error", error: "invalid_payload" };
    }
    memoryCache = { rate: venta, at: now };
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("bmc.brouFx", JSON.stringify(memoryCache));
      }
    } catch {
      /* ignore */
    }
    return { rate: venta, source: "dolarapi_uy" };
  } catch (err) {
    try {
      if (typeof sessionStorage !== "undefined") {
        const raw = sessionStorage.getItem("bmc.brouFx");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Number.isFinite(parsed?.rate) && parsed.rate > 0) {
            memoryCache = { rate: parsed.rate, at: parsed.at || now };
            return { rate: memoryCache.rate, source: "session_cache", error: String(err?.message || err) };
          }
        }
      }
    } catch {
      /* ignore */
    }
    return { rate: memoryCache?.rate ?? null, source: memoryCache ? "stale_cache" : "network_error", error: String(err?.message || err) };
  }
}
