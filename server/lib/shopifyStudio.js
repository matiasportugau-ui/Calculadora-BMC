/**
 * Shopify Local Studio — local drafts + public storefront catalog snapshot.
 * Drafts live under .runtime/ (gitignored). Upload applies via Admin GraphQL.
 */
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_STOREFRONT = "https://bmcuruguay.com.uy";
const DRAFTS_REL = path.join(".runtime", "shopify-studio-drafts.json");

export function resolveStorefrontUrl(config = {}) {
  const raw =
    config.shopifyStorefrontUrl ||
    process.env.SHOPIFY_STOREFRONT_URL ||
    DEFAULT_STOREFRONT;
  return String(raw).replace(/\/+$/, "");
}

export function resolveShopDomain(config = {}) {
  const raw =
    config.shopifyShop ||
    process.env.SHOPIFY_SHOP ||
    "";
  const s = String(raw).trim().toLowerCase();
  if (s) return s.includes(".") ? s : `${s}.myshopify.com`;
  return "";
}

export function draftsPath(cwd = process.cwd()) {
  return path.resolve(cwd, DRAFTS_REL);
}

export async function readDrafts(cwd = process.cwd()) {
  const file = draftsPath(cwd);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return {
      updatedAt: parsed.updatedAt || null,
      drafts: parsed.drafts && typeof parsed.drafts === "object" ? parsed.drafts : {},
    };
  } catch (e) {
    if (e.code === "ENOENT") return { updatedAt: null, drafts: {} };
    throw e;
  }
}

export async function writeDrafts(drafts, cwd = process.cwd()) {
  const file = draftsPath(cwd);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const payload = {
    updatedAt: new Date().toISOString(),
    drafts: drafts && typeof drafts === "object" ? drafts : {},
  };
  await fs.writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

/**
 * Fetch one page of public Online Store products.json
 * @param {{ storefrontUrl: string, page?: number, limit?: number }} opts
 */
export async function fetchStorefrontCatalogPage({
  storefrontUrl,
  page = 1,
  limit = 50,
  fetchImpl = fetch,
}) {
  const base = String(storefrontUrl || DEFAULT_STOREFRONT).replace(/\/+$/, "");
  const p = Math.max(1, Number(page) || 1);
  const lim = Math.min(250, Math.max(1, Number(limit) || 50));
  const url = `${base}/products.json?limit=${lim}&page=${p}`;
  const res = await fetchImpl(url, {
    headers: { Accept: "application/json", "User-Agent": "BMC-Shopify-Local-Studio/1.0" },
  });
  if (!res.ok) {
    return {
      ok: false,
      status: res.status >= 500 ? 503 : 502,
      error: `Storefront products.json failed (${res.status})`,
    };
  }
  const json = await res.json();
  const products = Array.isArray(json.products) ? json.products : [];
  return {
    ok: true,
    source: "storefront-products-json",
    storefrontUrl: base,
    page: p,
    limit: lim,
    count: products.length,
    hasMore: products.length >= lim,
    products: products.map(normalizePublicProduct),
  };
}

function normalizePublicProduct(p) {
  const images = Array.isArray(p.images)
    ? p.images.map((img) => ({
        id: img.id,
        src: img.src,
        alt: img.alt || "",
      }))
    : [];
  const variants = Array.isArray(p.variants)
    ? p.variants.map((v) => ({
        id: v.id,
        title: v.title,
        sku: v.sku || "",
        price: String(v.price ?? ""),
        compare_at_price: v.compare_at_price != null ? String(v.compare_at_price) : null,
        available: Boolean(v.available),
      }))
    : [];
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    body_html: p.body_html || "",
    vendor: p.vendor || "",
    product_type: p.product_type || "",
    tags: typeof p.tags === "string" ? p.tags : Array.isArray(p.tags) ? p.tags.join(", ") : "",
    images,
    variants,
    onlineStoreUrl: p.handle ? undefined : undefined,
  };
}

/**
 * Merge live product with local draft overlay for UI preview.
 */
export function applyDraftOverlay(product, draft) {
  if (!draft || typeof draft !== "object") return { ...product, _draft: false };
  const next = { ...product, _draft: true };
  if (typeof draft.title === "string") next.title = draft.title;
  if (typeof draft.body_html === "string") next.body_html = draft.body_html;
  if (draft.variants && typeof draft.variants === "object" && Array.isArray(product.variants)) {
    next.variants = product.variants.map((v) => {
      const dv = draft.variants[String(v.id)];
      if (!dv) return v;
      return {
        ...v,
        price: dv.price != null ? String(dv.price) : v.price,
        compare_at_price:
          dv.compare_at_price !== undefined
            ? dv.compare_at_price == null
              ? null
              : String(dv.compare_at_price)
            : v.compare_at_price,
      };
    });
  }
  return next;
}

/**
 * Build Admin GraphQL productUpdate + variant price mutations from a draft.
 * Returns { query, variables } list (one productUpdate; optional variantsBulkUpdate).
 */
export function buildUploadMutations(productGid, draft) {
  const ops = [];
  if (!draft || !productGid) return ops;

  const input = { id: productGid };
  let hasProductFields = false;
  if (typeof draft.title === "string" && draft.title.trim()) {
    input.title = draft.title.trim();
    hasProductFields = true;
  }
  if (typeof draft.body_html === "string") {
    input.descriptionHtml = draft.body_html;
    hasProductFields = true;
  }
  if (hasProductFields) {
    ops.push({
      kind: "productUpdate",
      query: `mutation ProductUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product { id handle title }
          userErrors { field message }
        }
      }`,
      variables: { input },
    });
  }

  if (draft.variants && typeof draft.variants === "object") {
    const variants = Object.entries(draft.variants)
      .filter(([, v]) => v && v.price != null)
      .map(([id, v]) => ({
        id: String(id).startsWith("gid://")
          ? String(id)
          : `gid://shopify/ProductVariant/${id}`,
        price: String(v.price),
      }));
    if (variants.length) {
      ops.push({
        kind: "productVariantsBulkUpdate",
        query: `mutation VariantsBulk($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants { id price }
            userErrors { field message }
          }
        }`,
        variables: { productId: productGid, variants },
      });
    }
  }
  return ops;
}

export function toProductGid(numericOrGid) {
  const s = String(numericOrGid || "");
  if (s.startsWith("gid://")) return s;
  if (/^\d+$/.test(s)) return `gid://shopify/Product/${s}`;
  return "";
}
