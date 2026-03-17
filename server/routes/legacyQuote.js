import { Router } from "express";
import { config } from "../config.js";
import { PANELS_PARED, PANELS_TECHO, p, setListaPrecios } from "../../src/data/constants.js";

const router = Router();

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .trim();
}

function parseCore(id) {
  if (id.includes("PIR")) return "PIR";
  if (id.includes("EPS")) return "EPS";
  return "";
}

function parseThickness(id) {
  const match = id.match(/-(\d+)mm$/i);
  return match ? Number(match[1]) : null;
}

function canonicalProductId(familyId, thicknessMm) {
  return `${familyId.replaceAll("_", "-")}-${thicknessMm}mm`;
}

function productCatalog(lista = "web") {
  setListaPrecios(lista === "venta" ? "venta" : "web");
  const products = [];
  const emit = (families, application) => {
    for (const [familyId, panel] of Object.entries(families)) {
      for (const [espesor, data] of Object.entries(panel.esp || {})) {
        const canonicalId = canonicalProductId(familyId, espesor);
        const core = parseCore(canonicalId);
        const aliasBase = panel.label.replace(/\s+/g, "-");
        const aliases = [
          canonicalId,
          canonicalId.replaceAll("-", "_"),
          `${familyId}-${espesor}mm`,
          `${familyId}_${espesor}mm`,
          `${aliasBase}-${espesor}mm`,
          panel.label,
          `${panel.label} ${espesor}mm`,
        ].map(normalizeText);
        products.push({
          id: canonicalId,
          display_name: `${panel.label} ${espesor}mm`,
          family: familyId,
          core,
          thickness_mm: Number(espesor),
          application,
          price_usd_m2: Number(p(data)),
          in_stock: true,
          max_span_m: data.ap ?? null,
          aliases: Array.from(new Set(aliases)),
        });
      }
    }
  };
  emit(PANELS_TECHO, "techo");
  emit(PANELS_PARED, "pared");
  return products;
}

function scoreCandidate(product, query) {
  const q = normalizeText(query);
  if (!q) return 0;
  let score = 0;
  if (product.aliases.includes(q)) score += 100;
  if (normalizeText(product.id) === q) score += 100;
  if (normalizeText(product.display_name).includes(q)) score += 35;
  const qTokens = q.split("-").filter(Boolean);
  for (const token of qTokens) {
    if (token.length < 2) continue;
    if (normalizeText(product.display_name).includes(token)) score += 5;
    if (normalizeText(product.id).includes(token)) score += 8;
    if (normalizeText(product.family).includes(token)) score += 10;
    if (normalizeText(product.application).includes(token)) score += 7;
    if (normalizeText(product.core).includes(token)) score += 7;
    if (String(product.thickness_mm).includes(token.replace("mm", ""))) score += 10;
  }
  return score;
}

function findProductsByQuery(query, maxResults = 5, lista = "web") {
  const catalog = productCatalog(lista);
  const ranked = catalog
    .map((pItem) => ({ pItem, score: scoreCandidate(pItem, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.pItem.price_usd_m2 - b.pItem.price_usd_m2)
    .slice(0, maxResults)
    .map(({ pItem, score }) => ({
      id: pItem.id,
      sku: pItem.id,
      name: pItem.display_name,
      display_name: pItem.display_name,
      family: pItem.family,
      type: "Panel Aislante",
      core: pItem.core,
      thickness_mm: pItem.thickness_mm,
      application: pItem.application === "techo" ? "Techos y Cubiertas" : "Paredes y Fachadas",
      price_usd_m2: pItem.price_usd_m2,
      in_stock: pItem.in_stock,
      max_span_m: pItem.max_span_m,
      match_score: Number((score / 100).toFixed(2)),
    }));
  return ranked;
}

function resolveByProductId(productId, lista = "web") {
  const normalized = normalizeText(productId);
  const catalog = productCatalog(lista);
  return (
    catalog.find((pItem) => normalizeText(pItem.id) === normalized || pItem.aliases.includes(normalized)) ||
    null
  );
}

function requireApiKey(req, res, next) {
  const expected = config.apiAuthToken;
  if (!expected) {
    return res.status(503).json({ ok: false, error_code: "AUTH_NOT_CONFIGURED", error: "API auth token is not configured" });
  }
  const provided = req.header("X-API-Key");
  if (!provided || provided !== expected) {
    return res.status(401).json({ ok: false, error_code: "AUTH_REQUIRED", detail: "Invalid or missing X-API-Key" });
  }
  return next();
}

router.get("/ready", (_req, res) => {
  const missing = [];
  if (!config.apiAuthToken) missing.push("API_AUTH_TOKEN");
  res.json({ ok: true, ready: missing.length === 0, missingConfig: missing });
});

router.post("/find_products", requireApiKey, (req, res) => {
  const { query = "", max_results = 5, lista = "web" } = req.body || {};
  if (!query || String(query).trim().length < 2) {
    return res.status(400).json({ ok: false, error_code: "INVALID_QUERY", error: "query is required (min 2 chars)" });
  }
  const products = findProductsByQuery(query, Math.min(Math.max(Number(max_results) || 5, 1), 20), lista);
  return res.json({ count: products.length, products });
});

router.post("/resolve_product", requireApiKey, (req, res) => {
  const { query = "", constraints = {}, lista = "web" } = req.body || {};
  const application = normalizeText(constraints.application || "");
  const core = normalizeText(constraints.core || "");
  const thickness = constraints.thickness_mm ? Number(constraints.thickness_mm) : null;

  const candidates = findProductsByQuery(query, 10, lista).filter((c) => {
    if (application && !normalizeText(c.application).includes(application)) return false;
    if (core && normalizeText(c.core) !== core) return false;
    if (thickness && Number(c.thickness_mm) !== thickness) return false;
    return true;
  });

  if (candidates.length === 0) {
    return res.status(404).json({ ok: false, error_code: "PRODUCT_NOT_FOUND", error: "No product matches query and constraints" });
  }
  if (candidates.length === 1) {
    return res.json({
      resolved: true,
      product_id: candidates[0].id,
      confidence: Math.min(1, Math.max(0.5, candidates[0].match_score)),
      needs_confirmation: false,
    });
  }
  return res.json({
    resolved: false,
    needs_confirmation: true,
    options: candidates.slice(0, 3).map((c) => ({ product_id: c.id, display_name: c.display_name })),
    question: "Detecte varias opciones posibles. Cual producto preferis?",
  });
});

router.post("/product_price", requireApiKey, (req, res) => {
  const { product_id, lista = "web" } = req.body || {};
  const product = resolveByProductId(product_id, lista);
  if (!product) {
    return res.status(404).json({ ok: false, error_code: "PRODUCT_NOT_FOUND", detail: `Product not found: ${product_id}` });
  }
  return res.json({
    product_id: product.id,
    name: product.display_name,
    type: "Panel Aislante",
    core: product.core,
    thickness_mm: product.thickness_mm,
    application: product.application === "techo" ? "Techos y Cubiertas" : "Paredes y Fachadas",
    price_usd_m2: product.price_usd_m2,
    in_stock: product.in_stock,
    family: product.family.replaceAll("_", "-"),
  });
});

router.post("/check_availability", requireApiKey, (req, res) => {
  const { product_id, lista = "web" } = req.body || {};
  const product = resolveByProductId(product_id, lista);
  if (!product) {
    return res.status(404).json({ ok: false, error_code: "PRODUCT_NOT_FOUND", detail: `Product not found: ${product_id}` });
  }
  return res.json({ product_id: product.id, in_stock: product.in_stock, available_quantity: null });
});

function quoteMath({ unitPrice, area, quantity, discountPercent = 0, includeTax = true }) {
  const subtotal = unitPrice * area * quantity;
  const discount = subtotal * (Math.max(0, Math.min(30, discountPercent)) / 100);
  const totalPreTax = subtotal - discount;
  // Prices from constants are SIN IVA (pre-tax). IVA 22% applied once at final total.
  const total = includeTax ? totalPreTax * 1.22 : totalPreTax;
  return {
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

router.post("/calculate_quote", requireApiKey, (req, res) => {
  const {
    product_id,
    length_m,
    width_m,
    quantity = 1,
    discount_percent = 0,
    include_tax = true,
    lista = "web",
  } = req.body || {};
  const product = resolveByProductId(product_id, lista);
  if (!product) {
    return res.status(404).json({ ok: false, error_code: "PRODUCT_NOT_FOUND", detail: `Product not found: ${product_id}` });
  }
  const length = Number(length_m);
  const width = Number(width_m);
  const qty = Math.max(1, Number(quantity) || 1);
  if (!(length > 0) || !(width > 0)) {
    return res.status(422).json({ ok: false, error_code: "INVALID_DIMENSIONS", error: "length_m and width_m must be > 0" });
  }
  const area = Number((length * width).toFixed(2));
  const { subtotal, discount, total } = quoteMath({
    unitPrice: product.price_usd_m2,
    area,
    quantity: qty,
    discountPercent: Number(discount_percent) || 0,
    includeTax: Boolean(include_tax),
  });

  return res.json({
    product_id: product.id,
    unit_price: Number(product.price_usd_m2.toFixed(2)),
    area_m2: area,
    quantity: qty,
    subtotal,
    discount,
    total,
    tax_included: Boolean(include_tax),
  });
});

router.post("/calculate_quote_v2", requireApiKey, (req, res) => {
  const {
    product_id,
    length_m,
    width_m,
    quantity = 1,
    include_tax = true,
    lista = "web",
  } = req.body || {};

  const product = resolveByProductId(product_id, lista);
  if (!product) {
    return res.status(404).json({ ok: false, error_code: "PRODUCT_NOT_FOUND", error: `Product not found: ${product_id}` });
  }

  const length = Number(length_m);
  const width = Number(width_m);
  const qty = Math.max(1, Number(quantity) || 1);
  if (!(length > 0) || !(width > 0)) {
    return res.status(422).json({ ok: false, error_code: "INVALID_DIMENSIONS", error: "length_m and width_m must be > 0" });
  }

  const area = Number((length * width).toFixed(2));
  const { subtotal, discount, total } = quoteMath({
    unitPrice: product.price_usd_m2,
    area,
    quantity: qty,
    discountPercent: 0,
    includeTax: Boolean(include_tax),
  });

  if (total <= 0 || product.price_usd_m2 <= 0) {
    return res.status(422).json({
      ok: false,
      error_code: "PRICING_INCONSISTENT",
      error: "Quote produced non-positive pricing values",
    });
  }

  return res.json({
    ok: true,
    product_id: product.id,
    unit_price: Number(product.price_usd_m2.toFixed(2)),
    area_m2: area,
    quantity: qty,
    subtotal,
    discount,
    total,
    tax_included: Boolean(include_tax),
  });
});

export default router;
