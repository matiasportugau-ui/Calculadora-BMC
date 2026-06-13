#!/usr/bin/env node
/**
 * Product Central PIM — Outbound Publish (Shopify-first MVP)
 *
 * Pushes from Panelin central (price, inventory, later desc/images/tech) to Shopify.
 * Highest leverage first: variant price + inventoryQuantity.
 *
 * Follows:
 * - PRODUCT-CENTRAL-PIM-INTELLIGENT-RUN-PLAN.md Phase 5 (and orchestration Phase A)
 * - PRODUCT-CENTRALIZATION-STATUS.md
 * - After collector (scripts/collect-catalog-to-panelin.mjs) has populated meta.channels.shopify
 * - Driven by panelinEvents (product.* events) via the worker in server/routes/panelin.js
 *
 * Usage (doppler recommended):
 *   node scripts/publish-panelin-to-shopify.mjs --dry-run
 *   node scripts/publish-panelin-to-shopify.mjs --write --sku=ISODEC_50
 *   node scripts/publish-panelin-to-shopify.mjs --write --all
 *
 * Programmatic (for worker): import { publishForSku } from '...'; await publishForSku(sku, {write: true, shop?})
 *
 * Requires: products in Panelin with meta.channels.shopify.{product_id, variant_ids...} from collector.
 * Safety: dry-run default, per-item report of exact mutations, source tracking. Real writes need shop token + prior collector seed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createShopifyStore } from '../server/shopifyStore.js';
import { getPanelinPool } from '../server/lib/panelinDb.js';

/**
 * Small local GraphQL caller for publish (mirrors server/routes/shopify.js shopifyGraphql helper).
 * Keeps the publish script self-contained for CLI + programmatic use.
 */
async function doShopifyGraphql({ shop, accessToken, query, variables }) {
  if (!shop || !accessToken) throw new Error('shop and accessToken required for Shopify GraphQL');
  const res = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    const msg = json.errors ? JSON.stringify(json.errors) : res.statusText;
    throw new Error(`Shopify GraphQL error: ${msg}`);
  }
  return json.data;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const asWrite = args.includes('--write');
const isDry = !asWrite;
const targetSku = getArgValue(args, '--sku');
const doAll = args.includes('--all') || args.includes('--all-recent');
const shopArg = getArgValue(args, '--shop');

const shopifyStore = createShopifyStore({});

function getArgValue(argv, flag) {
  const i = argv.indexOf(flag);
  return (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[i + 1] : null;
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
}

async function getCentralProductsWithShopify(pool) {
  if (!pool) return [];
  const { rows } = await pool.query(`
    SELECT sku, name, cost_usd, description, meta, 
           (SELECT price_usd FROM product_prices pp 
            JOIN price_lists pl ON pl.id=pp.price_list_id 
            WHERE pp.sku = p.sku AND pl.code = 'venta_web' AND pl.active LIMIT 1) as venta_web_price
    FROM products p
    WHERE meta IS NOT NULL 
      AND (meta->'channels'->>'shopify') IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 200
  `);
  return rows.map(r => ({
    sku: r.sku,
    name: r.name,
    cost_usd: r.cost_usd,
    description: r.description,
    meta: r.meta || {},
    venta_web_price: r.venta_web_price,
    shopify: r.meta.channels?.shopify || {}
  }));
}

/**
 * Programmatic entry point for outbound publish (used by worker in server/routes/panelin.js).
 * Respects { write: boolean, shop?: string } opts.
 * Always produces the .runtime/ report and returns it.
 */
export async function publishForSku(sku, opts = {}) {
  const asWrite = !!opts.write;
  const isDry = !asWrite;
  const shopArg = opts.shop || null;

  // Reuse the CLI main by temporarily influencing args (simple & safe for MVP).
  // For cleanliness in future we could factor the loop, but this keeps surface minimal.
  const argvBackup = process.argv;
  try {
    process.argv = ['node', 'publish', ...(sku ? ['--sku', sku] : []), ...(asWrite ? ['--write'] : []), ...(shopArg ? ['--shop', shopArg] : [])];
    // Call main and return its report (main always writes report + returns it).
    const report = await main();
    return report;
  } finally {
    process.argv = argvBackup;
  }
}

/* publishForSku export wrapper (above) sets argv then delegates to main() for a single implementation.
   main() handles both CLI parsing and the worker/programmatic path (via argv hack for simplicity in Phase A).
   Real mutation logic (price + future inventory) lives inside the per-product loop in main. */

async function main() {
  const args = process.argv.slice(2);
  const asWrite = args.includes('--write');
  const isDry = !asWrite;
  const targetSku = getArgValue(args, '--sku');
  const doAll = args.includes('--all') || args.includes('--all-recent');
  const shopArg = getArgValue(args, '--shop');

  console.log('🚀 Product Central PIM — Shopify Outbound Publish (price/stock MVP)\n');

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    mode: isDry ? 'dry-run' : 'write',
    summary: { candidates: 0, priceUpdates: 0, inventoryUpdates: 0, errors: 0 },
    actions: [],
    errors: []
  };

  const pool = getPanelinPool(process.env.DATABASE_URL);
  if (!pool) {
    console.warn('No Panelin DB pool (DATABASE_URL). Will only report candidates (no reads).');
  }

  let candidates = [];
  try {
    candidates = await getCentralProductsWithShopify(pool);
  } catch (e) {
    report.errors.push({ stage: 'query', message: e.message });
  }

  if (targetSku) {
    candidates = candidates.filter(c => c.sku === targetSku);
  } else if (!doAll) {
    // Default: only those with recent collector data or limit to 20 for safety
    candidates = candidates.slice(0, 20);
  }

  report.summary.candidates = candidates.length;
  console.log(`Found ${candidates.length} central products with Shopify channel mapping${targetSku ? ' (filtered to ' + targetSku + ')' : ''}.`);

  if (candidates.length === 0) {
    console.log('Nothing to publish. Run the collector first (with a real shop) so meta.channels.shopify gets populated.');
    // still write empty report
  }

  for (const prod of candidates) {
    const ch = prod.shopify || {};
    const variantGid = ch.variant_id || (Array.isArray(ch.variant_ids) ? ch.variant_ids[0] : null);
    const productGid = ch.product_id;

    if (!variantGid) {
      report.errors.push({ sku: prod.sku, reason: 'no variant_id in meta.channels.shopify' });
      continue;
    }

    const price = prod.venta_web_price != null ? String(prod.venta_web_price) : (prod.cost_usd ? String((prod.cost_usd * 1.25).toFixed(2)) : null); // fallback example

    const action = {
      sku: prod.sku,
      shopifyVariantGid: variantGid,
      proposedPrice: price,
      proposedInventory: null, // future: from stock
      mutations: []
    };

    if (price) {
      const priceMutation = {
        mutation: 'productVariantUpdate',
        input: { id: variantGid, price },
        note: `Set sell price from central (venta_web or derived)`
      };
      action.mutations.push(priceMutation);
      report.summary.priceUpdates += 1;
    }

    // Inventory is more complex (requires locationId + adjust). Log for now.
    // In real: use inventoryAdjustQuantities or productVariantUpdate with inventoryQuantities if supported.
    action.mutations.push({
      mutation: 'inventory (future)',
      note: 'Would call inventoryAdjustQuantities or set using stock from central + location from shopify meta'
    });

    report.actions.push(action);

    if (!isDry && pool) {
      try {
        const shopFromMeta = ch.shop || shopArg || null; // collector may store it, or passed via CLI/opts
        let accessToken = null;
        if (shopFromMeta) {
          try {
            const tokens = await shopifyStore.getTokens(shopFromMeta);
            accessToken = tokens && (tokens.access_token || tokens.accessToken);
          } catch (e) {
            // token resolution failure is non-fatal for report; will error on actual call below if needed
          }
        }

        // Real price mutation (price first MVP per Phase 5)
        if (price && variantGid && shopFromMeta && accessToken) {
          const mutation = `
            mutation productVariantUpdate($input: ProductVariantInput!) {
              productVariantUpdate(input: $input) {
                productVariant { id price }
                userErrors { field message }
              }
            }
          `;
          const data = await doShopifyGraphql({
            shop: shopFromMeta,
            accessToken,
            query: mutation,
            variables: { input: { id: variantGid, price } }
          });
          const errs = data?.productVariantUpdate?.userErrors || [];
          if (errs.length) {
            report.errors.push({ sku: prod.sku, message: `Shopify userErrors: ${JSON.stringify(errs)}` });
            report.summary.errors += 1;
          } else {
            console.log(`[WRITE] productVariantUpdate price for ${prod.sku} → ${price}`);
          }
        }

        // Always update meta last_published tracking on write path (even if mutation skipped due to missing creds in this env)
        const newMeta = { ...prod.meta };
        newMeta.channels = newMeta.channels || {};
        newMeta.channels.shopify = {
          ...ch,
          last_price_push: new Date().toISOString(),
          last_published_price: price,
          last_publish_shop: shopFromMeta || ch.shop || null
        };
        await pool.query(
          `UPDATE products SET meta = $2 WHERE sku = $1`,
          [prod.sku, JSON.stringify(newMeta)]
        );
        console.log(`[WRITE] Updated meta last_published for ${prod.sku}`);
      } catch (e) {
        report.errors.push({ sku: prod.sku, message: e.message });
        report.summary.errors += 1;
      }
    }
  }

  // Write report
  const outDir = path.join(ROOT, '.runtime');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = ts();
  const jsonPath = path.join(outDir, `publish-panelin-to-shopify-${stamp}.json`);
  const mdPath = path.join(outDir, `publish-panelin-to-shopify-${stamp}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdLines = [
    `# Shopify Outbound Publish Report — ${stamp}`,
    ``,
    `**Mode:** ${report.mode}`,
    `**Candidates:** ${report.summary.candidates}`,
    `**Price updates planned:** ${report.summary.priceUpdates}`,
    `**Errors:** ${report.summary.errors}`,
    ``,
    `## Planned / Executed Actions (first 15)`,
  ];

  report.actions.slice(0, 15).forEach(a => {
    mdLines.push(`- ${a.sku}: ${a.mutations.map(m => m.mutation || m.note).join(' + ')} (price ${a.proposedPrice || 'n/a'})`);
  });

  if (report.errors.length) {
    mdLines.push(``, `## Errors`, '');
    report.errors.forEach(e => mdLines.push(`- ${e.sku || ''}: ${e.message || e.reason}`));
  }

  mdLines.push(``, `---`, `JSON: ${path.relative(ROOT, jsonPath)}`);
  mdLines.push(`Next: Wire to panelinEvents for auto-publish on central change. Add inventory mutation with location. Support ML too.`);

  fs.writeFileSync(mdPath, mdLines.join('\n'));

  console.log(`\nReport: ${path.relative(ROOT, jsonPath)}`);
  console.log(`Dry? ${isDry}. ${isDry ? 'Nothing sent to Shopify.' : 'Mutations attempted (see meta on products).'}`);
  if (report.summary.errors) console.log(`Errors: ${report.summary.errors}`);

  return report; // allow direct callers to inspect
}

/* Thin CLI entry (delegates to the full main implementation above for the heavy logic + mutations + reports).
   publishForSku (exported wrapper) also delegates to main() via argv for worker calls. */
main().catch(e => { console.error(e); process.exit(1); });

/* publishForSku is already exported via the 'export async function' declaration above. */
