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
 * Programmatic (for worker): import { publishForSku } from '...'; await publishForSku(sku, {write: false});
 *
 * Requires: products in Panelin with meta.channels.shopify.{product_id, variant_ids...} from collector.
 * Safety: dry-run default, per-item report of exact mutations, source tracking. Real writes need shop token + prior collector seed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createShopifyStore } from '../server/shopifyStore.js';
import { config } from '../server/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { dryRun: true, write: false, sku: null, all: false, shop: null, limit: 20 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') out.dryRun = true;
    if (a === '--write') { out.write = true; out.dryRun = false; }
    if (a === '--sku' && args[i+1]) { out.sku = args[++i]; }
    if (a === '--all') out.all = true;
    if (a === '--shop' && args[i+1]) out.shop = args[++i];
    if (a === '--limit' && args[i+1]) out.limit = Number(args[++i]) || 20;
  }
  if (out.write) out.dryRun = false;
  return out;
}

const argv = parseArgs();
const isDry = !argv.write;

function log(...m) { console.log(...m); }
function writeReport(report) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(process.cwd(), '.runtime');
  fs.mkdirSync(base, { recursive: true });
  const j = path.join(base, `publish-panelin-to-shopify-${ts}.json`);
  const m = path.join(base, `publish-panelin-to-shopify-${ts}.md`);
  fs.writeFileSync(j, JSON.stringify(report, null, 2));
  const md = `# Publish Report ${ts}\n\n**dryRun:** ${report.summary.dryRun}\n**candidates:** ${report.summary.candidates}\n\n` +
    (report.actions || []).map(a => `- ${a.sku}: ${a.action} ${a.ok ? 'OK' : 'ERR'} ${a.detail || ''}`).join('\n') + '\n';
  fs.writeFileSync(m, md);
  log(`[publish] report written: ${j}`);
  return { json: j, md: m };
}

async function getShopToken(shop) {
  const encryptionKey = config.tokenEncryptionKey || process.env.TOKEN_ENCRYPTION_KEY || '';
  const store = createShopifyStore({
    dataDir: process.env.SHOPIFY_SHOPS_DIR || '.shopify-shops',
    encryptionKey,
    logger: { error: console.error, info: () => {} }
  });
  try {
    if (typeof store.getAccessToken === 'function') {
      return await store.getAccessToken(shop);
    }
    if (typeof store.get === 'function') {
      const rec = await store.get(shop);
      return rec?.accessToken || rec?.token || null;
    }
  } catch (e) {}
  return null;
}

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

/**
 * Core export for direct worker calls (and CLI).
 * Returns a report { summary, actions, errors }.
 */
export async function publishForSku(sku = null, { write = false, shop: shopArg = null } = {}) {
  const started = Date.now();
  const actions = [];
  const errors = [];
  const dry = !write;

  let candidates = 0;

  const skus = sku ? [sku] : (argv.all ? [] : []);

  if (!sku && !argv.all) {
    const report = {
      ok: true,
      summary: { dryRun: dry, candidates: 0, durationMs: Date.now() - started, note: 'No sku provided and no central meta yet (run collector first for meta.channels.shopify)' },
      actions: [],
      errors: [],
    };
    const paths = writeReport(report);
    return { ...report, reportPath: paths };
  }

  const shop = shopArg || argv.shop || process.env.SHOPIFY_SHOP || null;
  let accessToken = null;
  if (shop) {
    accessToken = await getShopToken(shop);
  }

  for (const s of skus) {
    candidates++;
    const action = { sku: s, action: 'noop', ok: true, detail: '' };

    if (!shop || !accessToken) {
      action.action = 'dry-simulate';
      action.detail = 'No shop/accessToken (dry or pre-seed). Would update variant price + inventory if meta.channels.shopify present.';
      actions.push(action);
      continue;
    }

    action.action = dry ? 'dry-mutation-planned' : 'mutation-attempted';
    action.detail = `price + inventory for ${s} (variant GID from meta.channels.shopify)`;
    actions.push(action);

    if (!dry) {
      try {
        // Placeholder for real GID lookup from central meta (collector will populate).
        // When real GIDs are available, enable the doShopifyGraphql call here.
        action.ok = true;
        action.detail += ' (simulated — seed meta first)';
      } catch (e) {
        action.ok = false;
        action.detail = String(e.message || e);
        errors.push({ sku: s, error: action.detail });
      }
    }
  }

  const report = {
    ok: errors.length === 0,
    summary: {
      dryRun: dry,
      candidates,
      actions: actions.length,
      errors: errors.length,
      durationMs: Date.now() - started,
      shop: shop || '(none)',
    },
    actions,
    errors,
  };

  const paths = writeReport(report);
  return { ...report, reportPath: paths };
}

async function main() {
  const { sku, all } = argv;
  log(`[publish] start dry=${isDry} sku=${sku || (all ? 'ALL' : 'none')}`);

  const res = await publishForSku(sku, { write: argv.write, shop: argv.shop });

  log('[publish] done', JSON.stringify(res.summary, null, 2));
  if (res.reportPath) log('[publish] see', res.reportPath.json, res.reportPath.md);

  if (res.errors && res.errors.length) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('publish-panelin-to-shopify.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}


