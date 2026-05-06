#!/usr/bin/env node
/**
 * Price Monitor ETL — Shopify (BMC) ↔ MercadoLibre Uruguay
 * ─────────────────────────────────────────────────────────────────────────
 * Trae el catálogo público Shopify de bmcuruguay.com.uy, las publicaciones
 * propias en MLU vía la API local (/ml/listings), busca competencia en MLU
 * por keyword (vía /api/ml/search), y escribe todo en Supabase
 * (schema bmc_price_monitor) calculando diferencias de precio.
 *
 * Uso:
 *   npm run etl:price-monitor                  # corrida normal (cron / manual)
 *   npm run etl:price-monitor -- --dry         # imprime payloads, no escribe
 *   npm run etl:price-monitor -- --limit=5     # solo procesa 5 productos
 *   npm run etl:price-monitor -- --product=ID  # solo procesa un product_id
 *
 * Requiere (en .env):
 *   SUPABASE_URL=https://htnwozvopveibwppyjhg.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
 *   API_AUTH_TOKEN=<bearer del API local>          (para llamar /api/ml/search y /ml/listings)
 *   ML_CLIENT_ID, ML_CLIENT_SECRET, OAuth ML completo (para /ml/listings)
 *
 * Opcional:
 *   BMC_API_BASE=http://127.0.0.1:3001              (default; en Cloud Run usa la URL pública)
 *   PRICE_ALERT_THRESHOLD_PCT=5.0                   (% mínimo de diferencia para generar alerta)
 *   ETL_ML_SEARCH_LIMIT=20                          (resultados de competencia por keyword)
 *
 * Salidas:
 *   - Inserta una fila en bmc_price_monitor.etl_runs con status final.
 *   - Upserts a shopify_products / shopify_variants / ml_listings.
 *   - Inserta filas frescas en ml_competitors con etl_run_id.
 *   - Inserta alertas detectadas en price_alerts.
 *
 * Diseño:
 *   - Idempotente (UPSERT por id, INSERT con etl_run_id para snapshots).
 *   - Si una sub-tarea falla (ej. ML search timeout), el ETL queda 'partial'
 *     pero sigue con los demás productos.
 *   - Sin dependencias nuevas: usa fetch + Supabase REST API.
 */

import dotenv from "dotenv";

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const API_BASE = (process.env.BMC_API_BASE || "http://127.0.0.1:3001").replace(/\/$/, "");
const API_TOKEN = process.env.API_AUTH_TOKEN || process.env.API_KEY || "";
const SHOPIFY_BASE = process.env.BMC_SHOPIFY_BASE || "https://bmcuruguay.com.uy";
const ALERT_THRESHOLD_PCT = Number(process.env.PRICE_ALERT_THRESHOLD_PCT || 5.0);
const ML_SEARCH_LIMIT = Math.min(50, Number(process.env.ETL_ML_SEARCH_LIMIT || 20));

const args = parseArgs(process.argv);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(2);
}
if (!API_TOKEN && !args.dry) {
  console.error("FATAL: API_AUTH_TOKEN required to call internal /ml/* endpoints.");
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────────
// Tiny utilities
// ─────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { dry: false, limit: null, product: null };
  for (const a of argv.slice(2)) {
    if (a === "--dry" || a === "--dry-run") out.dry = true;
    else if (a.startsWith("--limit=")) out.limit = Number(a.slice(8));
    else if (a.startsWith("--product=")) out.product = a.slice(10);
    else if (a === "-h" || a === "--help") {
      console.log(
        "Usage: node scripts/price-monitor-etl.mjs [--dry] [--limit=N] [--product=ID]",
      );
      process.exit(0);
    }
  }
  return out;
}

const log = (level, msg, ctx = {}) => {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...ctx });
  if (level === "error") console.error(line);
  else console.log(line);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const median = (nums) => {
  const sorted = nums.slice().filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

// ─────────────────────────────────────────────────────────────────────────
// Supabase REST helpers (no SDK — keeps deps minimal)
// ─────────────────────────────────────────────────────────────────────────
const SB_HEADERS_BASE = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function sbFetch(pathAndQuery, init = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${pathAndQuery.replace(/^\//, "")}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...SB_HEADERS_BASE, ...(init.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
  }
  if (!res.ok) {
    const err = new Error(`Supabase ${res.status} on ${pathAndQuery}: ${text.slice(0, 300)}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

const sbUpsert = (table, rows, onConflict = "id") =>
  sbFetch(`${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });

const sbInsert = (table, rows) =>
  sbFetch(table, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });

const sbSelectOne = (pathAndQuery) =>
  sbFetch(pathAndQuery, {
    method: "GET",
    headers: { Accept: "application/vnd.pgrst.object+json" },
  });

const sbSelect = (pathAndQuery) => sbFetch(pathAndQuery, { method: "GET" });

const sbInsertReturning = (table, row) =>
  sbFetch(table, {
    method: "POST",
    headers: { Prefer: "return=representation", Accept: "application/vnd.pgrst.object+json" },
    body: JSON.stringify(row),
  });

const sbPatch = (pathAndQuery, body) =>
  sbFetch(pathAndQuery, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });

// ─────────────────────────────────────────────────────────────────────────
// Internal API helpers (talk to our own /api/...)
// ─────────────────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${API_TOKEN}`,
    },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
  }
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  }
  return body;
}

// ─────────────────────────────────────────────────────────────────────────
// Step 1 — fetch Shopify catalog (public /products.json, no auth)
// ─────────────────────────────────────────────────────────────────────────
async function fetchShopifyCatalog() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${SHOPIFY_BASE}/products.json?limit=250&page=${page}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Shopify /products.json HTTP ${res.status}`);
    const j = await res.json();
    const products = j?.products || [];
    all.push(...products);
    if (products.length < 250) break;
  }
  return all;
}

function flattenShopifyProduct(p) {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const prices = variants
    .map((v) => parseFloat(v.price))
    .filter((n) => Number.isFinite(n));
  return {
    product: {
      id: p.id,
      handle: p.handle,
      title: p.title,
      product_type: p.product_type || null,
      vendor: (p.vendor || "").trim() || null,
      tags: Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(",").map((s) => s.trim()) : []),
      price_min_usd: prices.length ? Math.min(...prices) : null,
      price_max_usd: prices.length ? Math.max(...prices) : null,
      variants_count: variants.length,
      available: variants.some((v) => v.available),
      url: `${SHOPIFY_BASE}/products/${p.handle}`,
      raw: p,
      scraped_at: new Date().toISOString(),
    },
    variants: variants.map((v) => ({
      id: v.id,
      product_id: p.id,
      title: v.title || null,
      sku: v.sku || null,
      price_usd: Number.isFinite(parseFloat(v.price)) ? parseFloat(v.price) : null,
      compare_at_price_usd: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
      available: !!v.available,
      scraped_at: new Date().toISOString(),
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Step 2 — fetch own MLU listings (via internal /ml/listings paginated)
// ─────────────────────────────────────────────────────────────────────────
async function fetchMlListings() {
  const all = [];
  let offset = 0;
  const limit = 50;
  for (let i = 0; i < 100; i++) {
    const j = await apiFetch(
      `/ml/listings?status=active&limit=${limit}&offset=${offset}`,
    );
    const ids = j?.results || j?.body?.results || [];
    if (!Array.isArray(ids) || ids.length === 0) break;
    // /users/{id}/items/search returns just IDs; fetch each item detail.
    for (const id of ids) {
      try {
        const detail = await apiFetch(`/ml/items/${id}`);
        all.push(detail);
      } catch (e) {
        log("warn", "ml_item_fetch_failed", { id, err: String(e) });
      }
    }
    offset += limit;
    if (ids.length < limit) break;
  }
  return all;
}

function shapeMlListing(item) {
  return {
    id: item.id,
    title: item.title || "",
    price: typeof item.price === "number" ? item.price : 0,
    currency_id: item.currency_id || "UYU",
    condition: item.condition || null,
    permalink: item.permalink || null,
    thumbnail: item.thumbnail || null,
    status: item.status || null,
    available_quantity: item.available_quantity ?? null,
    sold_quantity: item.sold_quantity ?? null,
    raw: item,
    fetched_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Step 3 — get/seed search keyword for a product
// ─────────────────────────────────────────────────────────────────────────
function defaultKeywordFor(product) {
  // Toma las 4 primeras palabras alfanuméricas del título.
  const words = (product.title || "")
    .toLowerCase()
    .replace(/[^a-záéíóúñü0-9 ]/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  return words.join(" ");
}

async function ensureKeyword(product) {
  const existing = await sbSelect(
    `bmc_price_monitor.search_keywords?shopify_product_id=eq.${product.id}&select=keyword,enabled`,
  );
  if (Array.isArray(existing) && existing.length > 0) {
    return { keyword: existing[0].keyword, enabled: existing[0].enabled };
  }
  const keyword = defaultKeywordFor(product);
  if (!keyword) return { keyword: null, enabled: false };
  await sbUpsert(
    "bmc_price_monitor.search_keywords",
    [{ shopify_product_id: product.id, keyword, enabled: true }],
    "shopify_product_id",
  );
  return { keyword, enabled: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Step 4 — search competitors via /api/ml/search
// ─────────────────────────────────────────────────────────────────────────
async function searchCompetitors(keyword) {
  const u = `/api/ml/search?q=${encodeURIComponent(keyword)}&limit=${ML_SEARCH_LIMIT}&offset=0`;
  const j = await apiFetch(u);
  return Array.isArray(j?.results) ? j.results : [];
}

// ─────────────────────────────────────────────────────────────────────────
// Step 5 — compute alert for one product
// ─────────────────────────────────────────────────────────────────────────
function computeAlert({ product, competitors, fxRate, runId, threshold }) {
  if (!Number.isFinite(product.price_min_usd)) return null;
  const shopifyUyu = product.price_min_usd * fxRate;
  const compPrices = competitors
    .map((c) => c.price)
    .filter((n) => Number.isFinite(n));

  if (compPrices.length === 0) {
    return {
      shopify_product_id: product.id,
      alert_type: "no_competitors",
      shopify_price_usd: product.price_min_usd,
      shopify_price_uyu: shopifyUyu,
      ml_competitor_count: 0,
      threshold_pct: threshold,
      fx_used: fxRate,
      etl_run_id: runId,
    };
  }

  const med = median(compPrices);
  const min = Math.min(...compPrices);
  const max = Math.max(...compPrices);
  const diffPct = ((shopifyUyu - med) / med) * 100;

  const isOver = diffPct > threshold;
  const isUnder = diffPct < -threshold;
  if (!isOver && !isUnder) return null;

  return {
    shopify_product_id: product.id,
    alert_type: isOver ? "over_market" : "under_market",
    shopify_price_usd: product.price_min_usd,
    shopify_price_uyu: shopifyUyu,
    ml_median_uyu: med,
    ml_min_uyu: min,
    ml_max_uyu: max,
    ml_competitor_count: compPrices.length,
    diff_pct: diffPct,
    threshold_pct: threshold,
    fx_used: fxRate,
    etl_run_id: runId,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  log("info", "etl_start", { dry: args.dry, limit: args.limit, product: args.product });

  // 1) FX — read singleton; if manual_override=true, respect it.
  const fxRow = await sbSelectOne(
    `bmc_price_monitor.fx_settings?id=eq.1&select=source,uyu_per_usd,manual_override`,
  );
  const fxRate = parseFloat(fxRow.uyu_per_usd);
  log("info", "fx_loaded", { source: fxRow.source, rate: fxRate, manual: fxRow.manual_override });

  // 2) Open ETL run
  let runId = null;
  if (!args.dry) {
    const run = await sbInsertReturning("bmc_price_monitor.etl_runs", {
      status: "running",
      fx_uyu_per_usd: fxRate,
    });
    runId = run.id;
    log("info", "etl_run_open", { runId });
  }

  let stats = {
    shopify_products_synced: 0,
    ml_listings_synced: 0,
    ml_searches_run: 0,
    ml_competitors_synced: 0,
    alerts_generated: 0,
    errors: [],
  };

  try {
    // 3) Shopify catalog
    const products = await fetchShopifyCatalog();
    log("info", "shopify_fetched", { count: products.length });

    let toProcess = products;
    if (args.product) {
      toProcess = toProcess.filter((p) => String(p.id) === String(args.product));
    }
    if (args.limit) toProcess = toProcess.slice(0, args.limit);

    const productRows = [];
    const variantRows = [];
    for (const p of toProcess) {
      const flat = flattenShopifyProduct(p);
      productRows.push(flat.product);
      variantRows.push(...flat.variants);
    }

    if (!args.dry && productRows.length) {
      await sbUpsert("bmc_price_monitor.shopify_products", productRows, "id");
      stats.shopify_products_synced = productRows.length;
      // upsert variants in chunks of 200
      for (let i = 0; i < variantRows.length; i += 200) {
        await sbUpsert("bmc_price_monitor.shopify_variants", variantRows.slice(i, i + 200), "id");
      }
    }

    // 4) Own MLU listings
    let mlListings = [];
    try {
      mlListings = await fetchMlListings();
      log("info", "ml_listings_fetched", { count: mlListings.length });
    } catch (e) {
      log("error", "ml_listings_failed", { err: String(e) });
      stats.errors.push({ step: "ml_listings", err: String(e) });
    }
    if (!args.dry && mlListings.length) {
      const rows = mlListings.map(shapeMlListing);
      for (let i = 0; i < rows.length; i += 200) {
        await sbUpsert("bmc_price_monitor.ml_listings", rows.slice(i, i + 200), "id");
      }
      stats.ml_listings_synced = rows.length;
    }

    // 5) Per-product: keyword → search → competitors → alert
    for (const p of productRows) {
      try {
        const { keyword, enabled } = await ensureKeyword(p);
        if (!keyword || !enabled) {
          log("info", "skip_no_keyword", { product_id: p.id });
          continue;
        }

        const competitors = await searchCompetitors(keyword);
        stats.ml_searches_run += 1;

        const compRows = competitors.map((c, idx) => ({
          shopify_product_id: p.id,
          ml_item_id: c.id,
          ml_title: c.title,
          ml_price: c.price,
          ml_currency_id: c.currency_id || "UYU",
          ml_condition: c.condition,
          ml_permalink: c.permalink,
          ml_thumbnail: c.thumbnail,
          ml_seller_id: c.seller_id ?? null,
          ml_seller_nickname: c.seller_nickname ?? null,
          ml_position: idx + 1,
          ml_sold_quantity: c.sold_quantity ?? null,
          ml_available_qty: c.available_quantity ?? null,
          shipping_free: !!c.shipping_free,
          raw: c,
          etl_run_id: runId,
        }));

        if (!args.dry && compRows.length) {
          await sbInsert("bmc_price_monitor.ml_competitors", compRows);
          stats.ml_competitors_synced += compRows.length;
        }

        const alert = computeAlert({
          product: p,
          competitors,
          fxRate,
          runId,
          threshold: ALERT_THRESHOLD_PCT,
        });
        if (alert && !args.dry) {
          await sbInsert("bmc_price_monitor.price_alerts", [alert]);
          stats.alerts_generated += 1;
        }

        // gentle pacing — avoids saturating ML even though we cache server-side.
        await sleep(200);
      } catch (e) {
        log("error", "product_etl_failed", { product_id: p.id, err: String(e) });
        stats.errors.push({ step: "product", product_id: p.id, err: String(e) });
      }
    }

    // 6) Close ETL run
    const finalStatus = stats.errors.length === 0 ? "success" : "partial";
    if (!args.dry && runId) {
      await sbPatch(
        `bmc_price_monitor.etl_runs?id=eq.${runId}`,
        {
          status: finalStatus,
          finished_at: new Date().toISOString(),
          shopify_products_synced: stats.shopify_products_synced,
          ml_listings_synced: stats.ml_listings_synced,
          ml_searches_run: stats.ml_searches_run,
          ml_competitors_synced: stats.ml_competitors_synced,
          alerts_generated: stats.alerts_generated,
          duration_ms: Date.now() - t0,
          error_summary: stats.errors.length
            ? stats.errors.slice(0, 5).map((e) => e.err).join(" | ").slice(0, 800)
            : null,
          details: stats.errors.length ? { errors: stats.errors.slice(0, 50) } : null,
        },
      );
    }

    log("info", "etl_done", {
      runId,
      status: finalStatus,
      ...stats,
      duration_ms: Date.now() - t0,
      errors_count: stats.errors.length,
    });
    process.exit(stats.errors.length ? 1 : 0);
  } catch (e) {
    log("error", "etl_fatal", { err: String(e) });
    if (!args.dry && runId) {
      await sbPatch(
        `bmc_price_monitor.etl_runs?id=eq.${runId}`,
        {
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - t0,
          error_summary: String(e).slice(0, 800),
          details: { fatal: String(e) },
        },
      ).catch(() => {});
    }
    process.exit(2);
  }
}

main();
