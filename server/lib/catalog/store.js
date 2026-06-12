/**
 * bmc_catalog.products — durable store for the Products Module (Fase 0).
 *
 * Replaces .runtime/product-links.json (ephemeral on Cloud Run). In Fase 1
 * prices stay canonical in the MATRIZ Sheet — this store only owns the link
 * graph (sku ↔ codigo_stock ↔ calc_path) and enrichment fields.
 *
 * Link semantics preserved from the JSON file: a "links" map is
 * { SKU: CODIGO }. saveLinks() is a full replace (PUT semantics) — SKUs not
 * present in the incoming map get their codigo_stock cleared, never deleted
 * as products (enrichment survives unlinking).
 */
import { getCatalogPool } from "./db.js";

/** Returns { sku: codigo_stock } for every linked product. */
export async function getLinks() {
  const pool = getCatalogPool();
  const { rows } = await pool.query(
    `select sku, codigo_stock from bmc_catalog.products
     where codigo_stock is not null and sku is not null`,
  );
  const links = {};
  for (const r of rows) links[r.sku] = r.codigo_stock;
  return links;
}

/**
 * Full-replace of the link map (mirrors the old JSON file semantics).
 * @param {Object} links - { SKU: CODIGO }
 * @param {Object} [opts]
 * @param {string} [opts.updatedBy]
 * @param {Object} [opts.calcPathBySku] - optional SKU → constants.js path, set on insert
 */
export async function saveLinks(links, { updatedBy = null, calcPathBySku = {} } = {}) {
  const pool = getCatalogPool();
  const clean = {};
  for (const [sku, codigo] of Object.entries(links || {})) {
    const s = String(sku || "").trim();
    const c = String(codigo || "").trim();
    if (s && c) clean[s] = c;
  }
  const skus = Object.keys(clean);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Unlink products no longer present in the incoming map.
    await client.query(
      `update bmc_catalog.products
       set codigo_stock = null, updated_by = $2
       where codigo_stock is not null and (sku is null or not (sku = any($1::text[])))`,
      [skus, updatedBy],
    );
    for (const sku of skus) {
      await client.query(
        `insert into bmc_catalog.products (sku, codigo_stock, calc_path, updated_by)
         values ($1, $2, $3, $4)
         on conflict (sku) do update set
           codigo_stock = excluded.codigo_stock,
           calc_path = coalesce(bmc_catalog.products.calc_path, excluded.calc_path),
           updated_by = excluded.updated_by`,
        [sku, clean[sku], calcPathBySku[sku] || null, updatedBy],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    links: clean,
    meta: { storage: "postgres", note: "SKU (MATRIZ) → CODIGO (Stock). bmc_catalog.products" },
  };
}

/** Idempotent upsert of a canonical product row (seed + future enrichment). */
export async function upsertProduct({
  sku,
  codigoStock = null,
  calcPath = null,
  nombre = null,
  categoria = null,
  family = null,
  attrs = null,
  status = null,
  updatedBy = null,
}) {
  const pool = getCatalogPool();
  const { rows } = await pool.query(
    `insert into bmc_catalog.products (sku, codigo_stock, calc_path, nombre, categoria, family, attrs, status, updated_by)
     values ($1, $2, $3, $4, $5, $6, coalesce($7::jsonb, '{}'::jsonb), coalesce($8, 'active'), $9)
     on conflict (sku) do update set
       codigo_stock = coalesce(excluded.codigo_stock, bmc_catalog.products.codigo_stock),
       calc_path    = coalesce(excluded.calc_path, bmc_catalog.products.calc_path),
       nombre       = coalesce(excluded.nombre, bmc_catalog.products.nombre),
       categoria    = coalesce(excluded.categoria, bmc_catalog.products.categoria),
       family       = coalesce(excluded.family, bmc_catalog.products.family),
       attrs        = case when $7::jsonb is null then bmc_catalog.products.attrs else excluded.attrs end,
       status       = coalesce($8, bmc_catalog.products.status),
       updated_by   = excluded.updated_by
     returning id, sku`,
    [sku, codigoStock, calcPath, nombre, categoria, family, attrs ? JSON.stringify(attrs) : null, status, updatedBy],
  );
  return rows[0];
}

export async function listProducts({ limit = 1000 } = {}) {
  const pool = getCatalogPool();
  const { rows } = await pool.query(
    `select id, sku, codigo_stock, calc_path, nombre, categoria, family, status, updated_at
     from bmc_catalog.products
     order by sku nulls last
     limit $1`,
    [limit],
  );
  return rows;
}
