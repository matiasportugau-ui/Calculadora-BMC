#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "src/data/product-media");
const CATALOG_PATH = path.join(OUT_DIR, "product-media-catalog.json");
const BASE = "https://bmcuruguay.com.uy/collections/all/products.json";
const SITE = "https://bmcuruguay.com.uy";
function stripHtml(html) {
  return String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
async function fetchAll() {
  const products = [];
  for (let page = 1; page <= 30; page++) {
    const res = await fetch(`${BASE}?page=${page}&limit=50`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const arr = j?.products;
    if (!Array.isArray(arr) || !arr.length) break;
    products.push(...arr);
    if (arr.length < 50) break;
  }
  return products;
}
function normalize(p) {
  const images = (p.images || []).map((img, i) => ({ src: img.src || "", alt: img.alt || p.title || "", position: img.position ?? i + 1 })).filter((x) => x.src);
  return {
    id: p.id != null ? String(p.id) : null,
    handle: p.handle || null,
    title: p.title || "",
    description: stripHtml(p.body_html).slice(0, 2000),
    productType: p.product_type || "",
    tags: typeof p.tags === "string" ? p.tags.split(",").map((t) => t.trim()).filter(Boolean) : Array.isArray(p.tags) ? p.tags : [],
    vendor: p.vendor || "",
    url: p.handle ? `${SITE}/products/${p.handle}` : SITE,
    primaryImage: images[0]?.src || p.image?.src || null,
    images,
    variants: (p.variants || []).map((v) => ({ id: v.id != null ? String(v.id) : null, sku: v.sku || null, title: v.title || null, price: v.price != null ? String(v.price) : null })),
  };
}
const raw = await fetchAll();
const products = raw.map(normalize).filter((p) => p.handle);
const byHandle = {}, bySku = {};
products.forEach((p, i) => {
  byHandle[p.handle] = i;
  for (const v of p.variants || []) if (v.sku) bySku[String(v.sku).trim()] = i;
});
fs.mkdirSync(OUT_DIR, { recursive: true });
const catalog = { version: 1, generatedAt: new Date().toISOString(), source: BASE, site: SITE, productCount: products.length, products, byHandle, bySku };
fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
console.log("catalog", products.length, CATALOG_PATH);
