/**
 * Offline tests for Shopify Local Studio helpers.
 * Run: node tests/shopifyStudio.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  applyDraftOverlay,
  buildUploadMutations,
  fetchStorefrontCatalogPage,
  readDrafts,
  resolveShopDomain,
  resolveStorefrontUrl,
  toProductGid,
  writeDrafts,
} from "../server/lib/shopifyStudio.js";

async function withTempCwd(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bmc-shopify-studio-"));
  const prev = process.cwd();
  process.chdir(dir);
  try {
    await fn(dir);
  } finally {
    process.chdir(prev);
    await fs.rm(dir, { recursive: true, force: true });
  }
}

assert.equal(resolveStorefrontUrl({}), "https://bmcuruguay.com.uy");
assert.equal(resolveStorefrontUrl({ shopifyStorefrontUrl: "https://x.com/" }), "https://x.com");
assert.equal(resolveShopDomain({ shopifyShop: "foo" }), "foo.myshopify.com");
assert.equal(resolveShopDomain({ shopifyShop: "foo.myshopify.com" }), "foo.myshopify.com");
assert.equal(toProductGid("123"), "gid://shopify/Product/123");
assert.equal(toProductGid("gid://shopify/Product/9"), "gid://shopify/Product/9");

const baseProduct = {
  id: 1,
  handle: "isodec-pir",
  title: "ISODEC",
  body_html: "<p>old</p>",
  variants: [{ id: 10, title: "Default", price: "100.00", compare_at_price: null }],
};
const over = applyDraftOverlay(baseProduct, {
  title: "ISODEC PIR",
  variants: { "10": { price: "110.50" } },
});
assert.equal(over._draft, true);
assert.equal(over.title, "ISODEC PIR");
assert.equal(over.variants[0].price, "110.50");

const ops = buildUploadMutations("gid://shopify/Product/1", {
  title: "New",
  body_html: "<p>x</p>",
  variants: { "99": { price: "1.00" } },
});
assert.equal(ops.length, 2);
assert.equal(ops[0].kind, "productUpdate");
assert.equal(ops[1].kind, "productVariantsBulkUpdate");

await withTempCwd(async () => {
  const empty = await readDrafts();
  assert.deepEqual(empty.drafts, {});
  await writeDrafts({ "a-handle": { title: "A" } });
  const again = await readDrafts();
  assert.equal(again.drafts["a-handle"].title, "A");
  assert.ok(again.updatedAt);
});

const mockFetch = async () => ({
  ok: true,
  async json() {
    return {
      products: [
        {
          id: 42,
          handle: "panel",
          title: "Panel",
          body_html: "",
          vendor: "BMC",
          product_type: "",
          tags: "a,b",
          images: [{ id: 1, src: "https://cdn.example/x.jpg", alt: "" }],
          variants: [{ id: 7, title: "Default Title", sku: "P1", price: "10.00", available: true }],
        },
      ],
    };
  },
});
const cat = await fetchStorefrontCatalogPage({
  storefrontUrl: "https://bmcuruguay.com.uy",
  page: 1,
  limit: 10,
  fetchImpl: mockFetch,
});
assert.equal(cat.ok, true);
assert.equal(cat.products[0].handle, "panel");
assert.equal(cat.products[0].variants[0].price, "10.00");

console.log("shopifyStudio.test.js: OK");
