/**
 * productStockHints.js — cache ligero de stock por path (lista web).
 */

import { getCalcApiBase } from "./calcApiBase.js";

let _cache = null;
let _cacheAt = 0;
const TTL_MS = 5 * 60 * 1000;

/**
 * @returns {Promise<Map<string, { stock: number|null, bajoStock: boolean }>>}
 */
export async function fetchProductStockByPath(token) {
  const now = Date.now();
  if (_cache && now - _cacheAt < TTL_MS) return _cache;

  const base = getCalcApiBase();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const res = await fetch(`${base}/api/productos-maestro`, { cache: "no-store", headers });
    if (!res.ok) return new Map();
    const data = await res.json();
    const map = new Map();
    for (const item of data.items || []) {
      if (!item.path) continue;
      map.set(item.path, {
        stock: item.stock,
        bajoStock: item.estados?.includes("bajo_stock") || (item.stock != null && item.stock < 5),
        sinStock: item.estados?.includes("sin_stock_link"),
      });
    }
    _cache = map;
    _cacheAt = now;
    return map;
  } catch {
    return new Map();
  }
}

export function invalidateProductStockCache() {
  _cache = null;
  _cacheAt = 0;
}

/**
 * @param {Map<string, object>} map
 * @param {string} path
 * @returns {string|null} badge text or null
 */
export function stockBadgeForPath(map, path) {
  const h = map?.get(path);
  if (!h) return null;
  if (h.sinStock) return "Stock no vinculado";
  if (h.bajoStock) return `Bajo stock (${h.stock ?? "?"})`;
  return null;
}
