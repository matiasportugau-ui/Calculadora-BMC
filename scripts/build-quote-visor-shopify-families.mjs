#!/usr/bin/env node
/**
 * Genera mapeo para el visor (familia/color) leyendo productos públicos de Shopify.
 *
 * Uso:
 *   node scripts/build-quote-visor-shopify-families.mjs --pages=10 --out=src/data/quoteVisorShopifyFamilies.json
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

const MAX_PAGES = argInt("pages", 10);
const OUT = path.resolve(ROOT, argStr("out", "src/data/quoteVisorShopifyFamilies.json"));

const FAMILY_RULES = {
  ISODEC_EPS: ["isodec eps", "isodec", " eps "],
  ISODEC_PIR: ["isodec pir", "isodec", " pir "],
  ISOROOF_3G: ["isoroof 3g", "isoroof", " 3g "],
  ISOROOF_PLUS: ["isoroof plus", "plus 3g", "isoroof plus"],
  ISOROOF_FOIL: ["isoroof foil", "foil 3g", "isoroof foil"],
  ISOROOF_COLONIAL: ["colonial", "isocol", "teja"],
};

const FAMILY_STRICT_FILTERS = {
  ISODEC_EPS: {
    mustContainAll: ["isodec", "eps"],
    excludeAny: ["pir", "isoroof", "hiansa", "becam"],
  },
  ISODEC_PIR: {
    mustContainAll: ["isodec", "pir"],
    excludeAny: ["eps", "isoroof", "hiansa", "becam"],
  },
  ISOROOF_3G: {
    mustContainAll: ["isoroof", "3g"],
    excludeAny: ["plus", "foil", "colonial", "teja", "hiansa", "becam"],
  },
  ISOROOF_PLUS: {
    mustContainAll: ["isoroof", "plus"],
    excludeAny: ["foil", "colonial", "teja", "hiansa", "becam"],
  },
  ISOROOF_FOIL: {
    mustContainAll: ["isoroof", "foil"],
    excludeAny: ["plus", "colonial", "teja", "hiansa", "becam"],
  },
  ISOROOF_COLONIAL: {
    mustContainAny: ["colonial", "isocol", "teja"],
    excludeAny: ["plus", "foil", "hiansa", "becam"],
  },
};

// Optional hard gate by Shopify handle token for each family.
// If no product matches, that family falls back to local static gallery in UI.
const FAMILY_HANDLE_ALLOWLIST = {
  ISODEC_EPS: ["isodec-eps", "isopanel-isodec-eps-cubiertas"],
  ISODEC_PIR: ["isodec", "pir"],
  ISOROOF_3G: ["isoroof-3g", "iroof"],
  ISOROOF_PLUS: ["iroof", "pls", "isoroof-plus"],
  ISOROOF_FOIL: ["iagro", "foil"],
  ISOROOF_COLONIAL: ["isocol", "colonial", "icr040", "iagro40col", "iagcol40"],
};

const COLOR_TOKENS = {
  Blanco: ["blanco", "white"],
  Gris: ["gris", "gray", "grey"],
  Rojo: ["rojo", "red"],
  "Simil teja / Blanco": ["teja", "colonial", "blanco", "white"],
};

function normalize(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function productSearchText(p) {
  const tags = Array.isArray(p?.tags) ? p.tags.join(" ") : p?.tags || "";
  const variants = Array.isArray(p?.variants)
    ? p.variants
        .map((v) => `${v?.title || ""} ${v?.option1 || ""} ${v?.option2 || ""} ${v?.option3 || ""}`)
        .join(" ")
    : "";
  return normalize(`${p?.title || ""} ${p?.handle || ""} ${tags} ${variants}`);
}

function productIsPanel(p) {
  const text = productSearchText(p);
  const handle = normalize(p?.handle || "");
  const panelSignals = [
    "panel",
    "isodec",
    "isoroof",
    "isopanel",
    "isowall",
    "cubierta",
    "fachada",
    "techo",
    "pared",
  ];
  const accessorySignals = [
    "cinta",
    "butilo",
    "accesorio",
    "perfil",
    "frontalin",
    "cumbreron",
    "tapaonda",
    "caballete",
    "fijacion",
    "fijaciones",
    "hiansa",
    "becam",
    "cumbrera",
    "gotero",
    "babeta",
    "canalon",
    "tornillo",
    "anclaje",
    "sellador",
    "remache",
    "arandela",
    "varilla",
    "tuerca",
  ];
  const hasPanelSignal = panelSignals.some((k) => text.includes(k));
  const hasAccessorySignal = accessorySignals.some((k) => text.includes(k) || handle.includes(k));
  const blockedHandleTokens = ["cinta", "butilo", "accesorio", "frontalin", "cumbreron", "tapaonda", "fijac"];
  const blockedByHandle = blockedHandleTokens.some((k) => handle.includes(k));
  return hasPanelSignal && !hasAccessorySignal && !blockedByHandle;
}

function productMatchesFamilyStrict(p, familyKey) {
  const rules = FAMILY_STRICT_FILTERS[familyKey];
  if (!rules) return true;
  const text = productSearchText(p);
  const allOk = (rules.mustContainAll || []).every((k) => text.includes(normalize(k)));
  const anyOk = !rules.mustContainAny || rules.mustContainAny.some((k) => text.includes(normalize(k)));
  const noneBlocked = !(rules.excludeAny || []).some((k) => text.includes(normalize(k)));
  return allOk && anyOk && noneBlocked;
}

function productMatchesFamilyHandleAllowlist(p, familyKey) {
  const tokens = FAMILY_HANDLE_ALLOWLIST[familyKey];
  if (!Array.isArray(tokens) || tokens.length === 0) return true;
  const handle = normalize(p?.handle || "");
  return tokens.some((t) => handle.includes(normalize(t)));
}

function scoreFamilyProduct(p, keywords) {
  const text = productSearchText(p);
  let score = 0;
  for (const k of keywords) {
    if (text.includes(normalize(k))) score += 1;
  }
  if (text.includes("panel")) score += 0.2;
  if (text.includes("techo")) score += 0.2;
  return score;
}

function hasColor(p, color) {
  const text = productSearchText(p);
  const variantValues = Array.isArray(p?.variants)
    ? p.variants
        .flatMap((v) => [v?.option1, v?.option2, v?.option3])
        .map((x) => normalize(x))
        .filter(Boolean)
    : [];

  if (color === "Simil teja / Blanco") {
    const hasTeja = text.includes("teja") || text.includes("colonial");
    const hasBlanco = text.includes("blanco") || text.includes("white");
    return hasTeja && hasBlanco;
  }

  const tokens = COLOR_TOKENS[color] || [];
  if (!tokens.length) return false;
  const tokenHits = tokens.some((t) => text.includes(normalize(t)));
  const variantHits = tokens.some((t) => variantValues.some((vv) => vv.includes(normalize(t))));
  return tokenHits || variantHits;
}

async function fetchPage(page) {
  const url = `${BASE}?page=${page}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

function productUrl(handle) {
  return handle ? `https://bmcuruguay.com.uy/products/${handle}` : "https://bmcuruguay.com.uy/collections/paneles-aislantes";
}

function collectSlidesFromProducts(products, maxSlides = 8) {
  const slides = [];
  const seen = new Set();
  for (const p of products) {
    const images = Array.isArray(p?.images) ? p.images : p?.image ? [p.image] : [];
    for (const img of images) {
      const src = img?.src || "";
      if (!src || seen.has(src)) continue;
      seen.add(src);
      slides.push({
        src,
        title: p?.title || "Producto",
        subtitle: p?.product_type || "Catálogo Shopify",
        href: productUrl(p?.handle),
        shopifyHandle: p?.handle || null,
      });
      if (slides.length >= maxSlides) return slides;
    }
  }
  return slides;
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
      console.error(`page ${p}: ${e.message}`);
      break;
    }
  }

  if (products.length === 0) {
    console.error("No Shopify products fetched; aborting write to avoid wiping existing mapping.");
    process.exit(1);
  }

  const byFamily = {};
  const report = [];

  for (const [familyKey, keywords] of Object.entries(FAMILY_RULES)) {
    const ranked = products
      .map((p) => ({ p, score: scoreFamilyProduct(p, keywords) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const looseFamilyProducts = ranked.map((x) => x.p).filter(productIsPanel);
    const strictFamilyProducts = looseFamilyProducts.filter((p) => productMatchesFamilyStrict(p, familyKey));
    const handleWhitelisted = strictFamilyProducts.filter((p) =>
      productMatchesFamilyHandleAllowlist(p, familyKey)
    );
    const familyProducts = handleWhitelisted;
    const gallery = collectSlidesFromProducts(familyProducts, 10);

    const byColor = {};
    for (const color of Object.keys(COLOR_TOKENS)) {
      const colorProducts = familyProducts.filter((p) => hasColor(p, color));
      const colorSlides = collectSlidesFromProducts(colorProducts, 6);
      if (colorSlides.length) byColor[color] = colorSlides;
    }

    byFamily[familyKey] = {
      gallery,
      byColor,
      productCount: familyProducts.length,
      matchedHandles: familyProducts.slice(0, 15).map((p) => p?.handle).filter(Boolean),
    };
    report.push({
      familyKey,
      productCount: familyProducts.length,
      galleryCount: gallery.length,
      colorsDetected: Object.keys(byColor),
    });
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: BASE,
    byFamily,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUT} (${products.length} products scanned)`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
