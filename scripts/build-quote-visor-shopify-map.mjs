#!/usr/bin/env node
/**
 * Pagina https://bmcuruguay.com.uy/collections/all/products.json y genera
 * candidatos para quoteVisorShopifyMap.json (sin secretos; salida local).
 *
 * Uso: node scripts/build-quote-visor-shopify-map.mjs [--pages=5] [--out=src/data/quoteVisorShopifyMap.json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const BASE = "https://bmcuruguay.com.uy/collections/all/products.json";

function argInt(name, def) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!a) return def;
  const n = parseInt(a.split("=")[1], 10);
  return Number.isFinite(n) ? n : def;
}

function argStr(name, def) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!a) return def;
  return a.split("=").slice(1).join("=");
}

const MAX_PAGES = argInt("pages", 5);
const OUT = path.resolve(ROOT, argStr("out", "src/data/quoteVisorShopifyMap.json"));

const BORDER_KEYWORDS = [
  { id: "gotero_frontal", keys: ["gotero frontal", "gotero superior", "gfs"] },
  { id: "gotero_frontal_greca", keys: ["greca", "gotero greca"] },
  { id: "gotero_lateral", keys: ["gotero lateral", "gl "] },
  { id: "gotero_lateral_camara", keys: ["gotero lateral de cámara", "gotero camara", "glcam"] },
  { id: "babeta_adosar", keys: ["babeta de adosar", "babeta adosar"] },
  { id: "babeta_empotrar", keys: ["babeta de empotrar", "babeta empotrar"] },
  { id: "cumbrera", keys: ["cumbrera"] },
  { id: "canalon", keys: ["canalón", "canalon"] },
];

async function fetchPage(page) {
  const url = `${BASE}?page=${page}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

function pickImage(product) {
  const img = product?.image || product?.images?.[0];
  return img?.src || "";
}

function scoreProduct(product, keys) {
  const t = `${product?.title || ""} ${product?.handle || ""}`.toLowerCase();
  return keys.some((k) => t.includes(k)) ? 1 : 0;
}

async function main() {
  const products = [];
  for (let p = 1; p <= MAX_PAGES; p += 1) {
    try {
      const j = await fetchPage(p);
      const arr = j?.products;
      if (!Array.isArray(arr) || arr.length === 0) break;
      products.push(...arr);
    } catch (e) {
      console.error(`page ${p}:`, e.message);
      break;
    }
  }

  const byBorderId = {};
  const report = [];

  for (const def of BORDER_KEYWORDS) {
    let best = null;
    let bestScore = 0;
    for (const pr of products) {
      const sc = scoreProduct(pr, def.keys);
      if (sc > bestScore) {
        bestScore = sc;
        best = pr;
      }
    }
    const imageSrc = best ? pickImage(best) : "";
    const productUrl = best ? `https://bmcuruguay.com.uy/products/${best.handle}` : "https://bmcuruguay.com.uy/collections/all";
    byBorderId[def.id] = {
      imageSrc,
      productUrl,
      shopifyHandle: best?.handle ?? null,
    };
    report.push({ id: def.id, confidence: bestScore, title: best?.title || null, handle: best?.handle || null });
  }

  byBorderId.none = {
    imageSrc: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/ISODEC_GRIS.png?v=1756747335",
    productUrl: "https://bmcuruguay.com.uy/collections/paneles-aislantes",
    shopifyHandle: null,
  };

  const payload = { version: 2, generatedAt: new Date().toISOString(), byBorderId };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUT} (${products.length} products scanned)`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
