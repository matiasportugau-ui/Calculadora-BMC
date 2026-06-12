/**
 * bmc_catalog — lazy Postgres pool (same pattern as marketIntel/etl/runner.js).
 *
 * The pool is created on first use, never at import time, so the server keeps
 * booting in environments without DATABASE_URL (local dev without DB falls
 * back to the legacy .runtime/product-links.json store in productosMaestro).
 *
 * Tests inject a shim via __test__.setPool(pool).
 */
import pg from "pg";

let _pool = null;
let _injected = null;

export function hasCatalogDb() {
  return !!(_injected || process.env.DATABASE_URL);
}

export function getCatalogPool() {
  if (_injected) return _injected;
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL required for bmc_catalog");
    }
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export const __test__ = {
  setPool(pool) {
    _injected = pool;
  },
  reset() {
    _injected = null;
    _pool = null;
  },
};
