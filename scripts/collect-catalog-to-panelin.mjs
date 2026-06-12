#!/usr/bin/env node
/**
 * Product Centralization — Catalog Collector (Shopify-first MVP)
 *
 * Collects current channel state (Shopify catalog + variants + images + prices + inventory)
 * and seeds/enriches Panelin Postgres central (products + meta + stock signals).
 *
 * Follows:
 * - docs/team/PRODUCT-CENTRAL-PIM-INTELLIGENT-RUN-PLAN.md (Phase 1)
 * - docs/team/PRODUCT-CENTRALIZATION-STATUS.md §6/7
 * - .runtime/GOAL-product-centralization-collector-with-propagation.md
 *
 * Usage (recommended with doppler for secrets + tokens):
 *   node scripts/collect-catalog-to-panelin.mjs --shopify --dry-run --shop <myshop.myshopify.com>
 *   node scripts/collect-catalog-to-panelin.mjs --shopify --write --shop <myshop.myshopify.com> --maxPages 5
 *   node scripts/collect-catalog-to-panelin.mjs --list-shops
 *
 * Options:
 *   --shopify              Enable Shopify collection (primary for Phase 1)
 *   --shop <domain>        Specific shop (e.g. panelin-uy.myshopify.com). If omitted, uses first available.
 *   --dry-run              Default. Simulate, no DB writes. Always produces report.
 *   --write                Perform upserts + stock movements (idempotent).
 *   --limit <n>            Max variants to process (for safe testing).
 *   --maxPages <n>         Max pages from Shopify GraphQL (default 10, max 50).
 *   --list-shops           List known connected Shopify shops from local token store and exit.
 *
 * Output:
 *   .runtime/collect-catalog-to-panelin-*.{json,md}
 *   High-signal counts, matched SKUs, images added, samples, before/after notes.
 *
 * Safety:
 *   - Dry-run by default.
 *   - SKU mapping via productos-maestro links + heuristic normalize.
 *   - Meta merge (append images, update channels, preserve existing tech/desc).
 *   - Uses existing panelin_upsert_product + record_stock_movement.
 *   - Reports always written.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createShopifyStore } from '../server/shopifyStore.js';
import { getPanelinPool } from '../server/lib/panelinDb.js';
import { loadLinks } from '../server/lib/productosMaestro.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const asWrite = args.includes('--write');
const isDry = !asWrite; // dry-run is default and safe
const doShopify = args.includes('--shopify') || args.includes('--catalog');
const listShopsOnly = args.includes('--list-shops');

const shopArg = getArgValue(args, '--shop');
const limitArg = parseInt(getArgValue(args, '--limit') || '0', 10);
const maxPagesArg = parseInt(getArgValue(args, '--maxPages') || '10', 10);

function getArgValue(argv, flag) {
  const i = argv.indexOf(flag);
  return (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[i + 1] : null;
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
}

const shopifyStore = createShopifyStore({});

async function listShops() {
  // Best effort: scan .shopify-shops dir for .enc files (decrypted names are the shops)
  const base = path.resolve(ROOT, '.shopify-shops');
  try {
    const files = fs.readdirSync(base).filter(f => f.endsWith('.enc'));
    const shops = files.map(f => f.replace(/\.enc$/, ''));
    return shops;
  } catch {
    return [];
  }
}

function normalizeSku(raw) {
  if (!raw) return '';
  return String(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function mergeMeta(existing = {}, addition = {}) {
  const merged = { ...existing };
  // images: append + dedupe by url
  const imgs = [...(existing.images || []), ...(addition.images || [])];
  const seen = new Set();
  merged.images = imgs.filter(i => {
    const key = i.url || i;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // channels: deep merge
  merged.channels = {
    ...(existing.channels || {}),
    ...(addition.channels || {})
  };
  // descriptions / other top level from addition (non-destructive for tech)
  if (addition.description && !merged.description) merged.description = addition.description;
  if (addition.shopify) merged.shopify = { ...(merged.shopify || {}), ...addition.shopify };
  return merged;
}

async function pullShopifyCatalog(shop) {
  // Preferred dev path: hit the running API (under doppler). The server handles shopify tokens securely.
  const apiBase = process.env.BMC_API_BASE || 'http://127.0.0.1:3001';
  const apiAuth = process.env.API_AUTH_TOKEN;
  if (apiAuth) {
    try {
      const url = `${apiBase.replace(/\/$/, '')}/api/shopify/catalog/full?shop=${encodeURIComponent(shop)}&maxPages=${maxPagesArg || 10}`;
      const r = await fetch(url, { headers: { 'Authorization': `Bearer ${apiAuth}` } });
      if (r.ok) {
        const j = await r.json();
        if (j.ok && Array.isArray(j.data || j.products)) {
          const prods = j.data || j.products || [];
          console.log(`Pulled via BMC API (${prods.length} products) — recommended path when server running under doppler.`);
          return {
            shop,
            totalProducts: prods.length,
            products: prods,
            pagesFetched: j.meta?.pagesFetched || Math.ceil(prods.length / 100) || 1,
            source: 'api'
          };
        }
      }
      console.warn('API catalog endpoint returned non-ok; will try direct token if available.');
    } catch (e) {
      console.warn('BMC API catalog pull attempt failed (is the API up with doppler run -- npm run start:api ?), falling back to direct if tokens present:', e.message);
    }
  }

  // Direct fallback (requires .shopify-shops tokens in cwd or DOPPLER-provided files)
  const tokens = await shopifyStore.getTokens(shop);
  if (!tokens?.access_token) {
    throw new Error(`No access_token for shop ${shop}. Either run the API under doppler (preferred) or ensure .shopify-shops token exists for direct mode.`);
  }

  const pageSize = 100;
  const maxPages = Math.min(maxPagesArg || 10, 50);

  const query = `
    query ProductsPage($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor }
        edges {
          cursor
          node {
            id
            handle
            title
            status
            descriptionHtml
            images(first: 20) {
              edges { node { id url altText } }
            }
            variants(first: 100) {
              edges {
                node {
                  id title sku barcode price compareAtPrice inventoryQuantity inventoryPolicy
                  selectedOptions { name value }
                }
              }
            }
          }
        }
      }
    }
  `;

  const all = [];
  let after = null;
  let hasNext = true;
  let pages = 0;

  // Local shopifyGraphql (minimal, same as route)
  async function shopifyGraphqlCall(q, variables) {
    const resp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': tokens.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: q, variables }),
    });
    const json = await resp.json();
    if (!resp.ok || json.errors) {
      return { ok: false, status: resp.status, error: json.errors || resp.statusText };
    }
    return { ok: true, data: json.data };
  }

  while (hasNext && pages < maxPages) {
    const gql = await shopifyGraphqlCall(query, {
      first: pageSize,
      after,
      query: null,
    });
    if (!gql.ok) {
      throw new Error(`Shopify GraphQL error: ${JSON.stringify(gql.error || gql)}`);
    }
    const edges = gql.data?.products?.edges || [];
    for (const e of edges) {
      const node = e.node;
      all.push({
        ...node,
        images: (node.images?.edges || []).map(x => x.node),
        variants: (node.variants?.edges || []).map(x => x.node),
      });
    }
    hasNext = !!gql.data?.products?.pageInfo?.hasNextPage;
    after = gql.data?.products?.pageInfo?.endCursor || null;
    pages += 1;
    if (limitArg > 0 && all.length * 3 > limitArg) break; // rough early stop
  }

  return { shop, totalProducts: all.length, products: all, pagesFetched: pages, source: 'direct' };
}

async function main() {
  console.log('🧩 Product Centralization — Catalog Collector (Shopify-first)\n');

  const shopsAvailable = await listShops();
  if (listShopsOnly) {
    console.log('Connected shops (.shopify-shops):');
    console.log(shopsAvailable.length ? shopsAvailable.join('\n') : '(none found — run OAuth or place tokens)');
    process.exit(0);
  }

  if (!doShopify) {
    console.log('No sources selected. Use --shopify (or --catalog). See --help in comments.');
    process.exit(1);
  }

  const targetShop = shopArg || (shopsAvailable[0] || null);
  if (!targetShop) {
    console.error('No shop specified and none found in .shopify-shops. Use --shop <myshop.myshopify.com> or --list-shops.');
    process.exit(1);
  }

  console.log(`Source: Shopify (shop=${targetShop})  mode=${isDry ? 'DRY-RUN' : 'WRITE'}`);
  console.log(`Max pages: ${maxPagesArg}  limit: ${limitArg || 'none'}\n`);

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    mode: isDry ? 'dry-run' : 'write',
    sources: { shopify: { shop: targetShop } },
    summary: { productsProcessed: 0, variantsProcessed: 0, matched: 0, imagesAdded: 0, stockSignals: 0, upserts: 0 },
    matched: [],
    unmatchedSample: [],
    errors: [],
  };

  // 1. Pull catalog
  let catalog;
  try {
    catalog = await pullShopifyCatalog(targetShop);
    console.log(`Pulled ${catalog.totalProducts} products (${catalog.pagesFetched} pages)`);
  } catch (e) {
    report.ok = false;
    report.errors.push({ stage: 'shopify-pull', message: e.message });
    console.error('Shopify pull failed:', e.message);
  }

  // 2. Links for mapping (maestro)
  let links = {};
  try {
    const rawLinks = loadLinks();
    // loadLinks returns { [codigo or path]: sku or link obj } — adapt
    links = rawLinks || {};
  } catch (e) {
    console.warn('Could not load maestro links (proceeding with heuristic only):', e.message);
  }

  // 3. Panelin pool (for writes / enrichment)
  const databaseUrl = process.env.DATABASE_URL;
  const pool = getPanelinPool(databaseUrl);
  if (!pool && !isDry) {
    console.warn('No DATABASE_URL / panelin pool — WRITE will be skipped (report only).');
  }

  const allProducts = catalog?.products || [];

  for (const prod of allProducts) {
    if (limitArg && report.variantsProcessed >= limitArg) break;

    const prodImages = (prod.images || []).map(img => ({
      url: img.url,
      alt: img.altText || prod.title,
      role: 'shopify',
      source_channel: 'shopify',
    }));

    for (const v of (prod.variants || [])) {
      report.variantsProcessed += 1;
      if (!v.sku) continue;

      const rawSku = v.sku;
      const norm = normalizeSku(rawSku);

      // Mapping: try exact links first (maestro style), then norm
      let targetSku = null;
      // links shape from productosMaestro is usually codigo/path -> sku or object
      for (const [k, link] of Object.entries(links)) {
        const linkSku = typeof link === 'string' ? link : (link.sku || link.target || '');
        if (normalizeSku(k) === norm || normalizeSku(linkSku) === norm) {
          targetSku = linkSku || k;
          break;
        }
      }
      if (!targetSku) targetSku = rawSku; // fallback to channel sku itself

      const addition = {
        images: prodImages,
        channels: {
          shopify: {
            product_id: prod.id,
            handle: prod.handle,
            title: prod.title,
            variant_id: v.id,
            last_collected: new Date().toISOString(),
            price: v.price,
            inventoryQuantity: v.inventoryQuantity,
          }
        },
        shopify_sell_price: Number(v.price) || null,
      };

      const name = prod.title || rawSku;

      report.summary.productsProcessed = (report.summary.productsProcessed || 0) + 1; // rough

      if (isDry) {
        report.matched.push({
          targetSku,
          channelSku: rawSku,
          title: prod.title,
          images: prodImages.length,
          price: v.price,
          inventory: v.inventoryQuantity,
        });
        report.summary.matched += 1;
        report.summary.imagesAdded += prodImages.length;
        continue;
      }

      // WRITE path
      if (!pool) {
        report.unmatchedSample.push({ reason: 'no-pool', targetSku, channelSku: rawSku });
        continue;
      }

      try {
        // Read existing to merge meta
        const existingRes = await pool.query('SELECT meta FROM products WHERE sku = $1', [targetSku]);
        const existingMeta = existingRes.rows[0]?.meta || {};

        const mergedMeta = mergeMeta(existingMeta, addition);

        // Upsert core product + meta (name/desc from channel, meta enriched)
        await pool.query(
          `SELECT panelin_upsert_product($1, $2, NULL, 'unid', NULL, true, $3::jsonb)`,
          [targetSku, name, JSON.stringify(mergedMeta)]
        );
        report.summary.upserts = (report.summary.upserts || 0) + 1;

        // Stock signal (best effort — uses same pattern as FE webhooks)
        // Signature observed: panelin_record_stock_movement(sku, deposito, ?, qty_after?, reason, ref)
        try {
          const qty = Number(v.inventoryQuantity) || 0;
          await pool.query(
            `SELECT panelin_record_stock_movement($1, 'shopify', $2, $3, 'shopify-collect', $4)`,
            [targetSku, 0, qty, prod.id]
          );
          report.summary.stockSignals = (report.summary.stockSignals || 0) + 1;
        } catch (stockErr) {
          // Non-fatal — collector still valuable for meta/images
          if (!report.errors.some(e => e.stage === 'stock')) {
            report.errors.push({ stage: 'stock-movement', message: stockErr.message, sku: targetSku });
          }
        }

        report.matched.push({
          targetSku,
          channelSku: rawSku,
          title: prod.title,
          images: prodImages.length,
          price: v.price,
          inventory: v.inventoryQuantity,
        });
        report.summary.matched += 1;
        report.summary.imagesAdded += prodImages.length;
      } catch (err) {
        report.errors.push({ stage: 'upsert', sku: targetSku, message: err.message });
        report.unmatchedSample.push({ targetSku, channelSku: rawSku, error: err.message });
      }
    }
  }

  // Write report
  const outDir = path.join(ROOT, '.runtime');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = ts();
  const jsonPath = path.join(outDir, `collect-catalog-to-panelin-${stamp}.json`);
  const mdPath = path.join(outDir, `collect-catalog-to-panelin-${stamp}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify({ ...report, catalogSample: allProducts.slice(0, 2) }, null, 2), 'utf8');

  const md = [
    `# Catalog Collector Report — ${stamp}`,
    ``,
    `**Mode:** ${report.mode}   **Shop:** ${targetShop}`,
    `**Products:** ${catalog?.totalProducts || 0}   **Variants processed:** ${report.variantsProcessed}`,
    ``,
    `## Summary`,
    `- Matched / enriched: ${report.summary.matched}`,
    `- Images added (accumulated): ${report.summary.imagesAdded}`,
    `- Upserts: ${report.summary.upserts}`,
    `- Stock signals: ${report.summary.stockSignals}`,
    `- Errors: ${report.errors.length}`,
    ``,
    `## Sample matched (first 10)`,
  ];

  (report.matched || []).slice(0, 10).forEach(m => {
    md.push(`- ${m.targetSku} ← ${m.channelSku}  (imgs:${m.images} price:${m.price} inv:${m.inventory})`);
  });

  if (report.unmatchedSample.length) {
    md.push(``, `## Unmatched / issues (sample)`, '');
    report.unmatchedSample.slice(0, 5).forEach(u => md.push(`- ${u.targetSku || u.channelSku}: ${u.error || u.reason || ''}`));
  }

  md.push(``, `---`, `Full JSON: ${path.relative(ROOT, jsonPath)}`);
  md.push(`Dry-run? ${isDry} — re-run with --write (after review) to persist.`);
  md.push(`Next per plan: verify in Panelin dashboard, produce drift, then accurate propagation.`);

  fs.writeFileSync(mdPath, md.join('\n'), 'utf8');

  console.log(`\nReport written:`);
  console.log(`  ${path.relative(ROOT, jsonPath)}`);
  console.log(`  ${path.relative(ROOT, mdPath)}`);
  console.log(`\nMatched: ${report.summary.matched}  Images: ${report.summary.imagesAdded}  Upserts: ${report.summary.upserts}`);
  if (report.errors.length) console.log(`Errors: ${report.errors.length} (see report)`);
  console.log(isDry ? '\n(DRY — nothing written to DB. Use --write when ready.)' : '\n(WRITE completed — data in Panelin.)');

  if (!report.ok) process.exit(1);
}

main().catch(err => {
  console.error('Collector fatal:', err);
  process.exit(1);
});
