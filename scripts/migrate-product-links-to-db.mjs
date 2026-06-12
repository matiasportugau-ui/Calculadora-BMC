#!/usr/bin/env node
/**
 * One-time seed: .runtime/product-links.json + MATRIZ_SKU_TO_PATH → bmc_catalog.products
 *
 * Idempotente (upsert por SKU). Corre DESPUÉS de `npm run catalog:migrate`.
 * Uso: DATABASE_URL=postgres://... node scripts/migrate-product-links-to-db.mjs [--dry-run]
 *
 * Seedea:
 *   - Todo SKU del mapping MATRIZ → calc_path (registro canónico mínimo)
 *   - Los links SKU → CODIGO del JSON legacy (si el archivo existe)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { MATRIZ_SKU_TO_PATH } from "../src/data/matrizPreciosMapping.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const LINKS_FILE = path.join(root, ".runtime", "product-links.json");

const dryRun = process.argv.includes("--dry-run");

function loadLegacyLinks() {
  try {
    if (fs.existsSync(LINKS_FILE)) {
      const data = JSON.parse(fs.readFileSync(LINKS_FILE, "utf8"));
      return data.links || {};
    }
  } catch (e) {
    console.warn(`No se pudo leer ${LINKS_FILE}: ${e.message}`);
  }
  return {};
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl && !dryRun) {
    console.error("DATABASE_URL is required (use --dry-run to preview without DB)");
    process.exit(1);
  }

  const legacyLinks = loadLegacyLinks();
  const skuToPath = MATRIZ_SKU_TO_PATH || {};

  // Unión de SKUs: mapping (calc_path) + JSON legacy (codigo_stock)
  const allSkus = new Set([...Object.keys(skuToPath), ...Object.keys(legacyLinks)]);
  console.log(
    `Seed: ${allSkus.size} SKUs (${Object.keys(skuToPath).length} del mapping, ` +
      `${Object.keys(legacyLinks).length} links legacy)${dryRun ? " [DRY RUN]" : ""}`,
  );

  if (dryRun) {
    for (const sku of [...allSkus].slice(0, 10)) {
      console.log(`  ${sku} → path=${skuToPath[sku] || "-"} codigo=${legacyLinks[sku] || "-"}`);
    }
    if (allSkus.size > 10) console.log(`  ... y ${allSkus.size - 10} más`);
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  let inserted = 0;
  let updated = 0;
  try {
    for (const sku of allSkus) {
      const res = await pool.query(
        `insert into bmc_catalog.products (sku, codigo_stock, calc_path, updated_by)
         values ($1, $2, $3, 'migrate-product-links-to-db')
         on conflict (sku) do update set
           codigo_stock = coalesce(excluded.codigo_stock, bmc_catalog.products.codigo_stock),
           calc_path    = coalesce(excluded.calc_path, bmc_catalog.products.calc_path),
           updated_by   = excluded.updated_by
         returning (xmax = 0) as is_insert`,
        [sku, legacyLinks[sku] || null, skuToPath[sku] || null],
      );
      if (res.rows[0]?.is_insert) inserted += 1;
      else updated += 1;
    }

    const { rows } = await pool.query(
      `select count(*)::int as total,
              count(codigo_stock)::int as linked
       from bmc_catalog.products`,
    );
    console.log(`Hecho: ${inserted} insertados, ${updated} actualizados.`);
    console.log(`Estado DB: ${rows[0].total} productos, ${rows[0].linked} con link a Stock.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
