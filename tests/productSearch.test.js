/**
 * Drawer / agent product search: aliases, tokens AND, ranking.
 * Run: node tests/productSearch.test.js
 */
import { buildProductCatalogIndex } from "../src/utils/productCatalogIndex.js";
import { filterAndRankProducts, foldSearchText, tokenizeQuery } from "../src/utils/productSearch.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const index = buildProductCatalogIndex();

assert(foldSearchText("Perfilería 100mm") === "perfileria 100", "fold accents + mm");
assert(tokenizeQuery("Tornillo  12×3/4\"").includes("12") || tokenizeQuery("tornillo 12").includes("tornillo"), "tokenize");

const hex = filterAndRankProducts(index, "hexagonal");
assert(hex.length > 0 && hex.some((r) => /exagonal|hexagonal/i.test(r.label)), "hexagonal → exagonal");

const sku = filterAndRankProducts(index, "6838");
assert(sku.length > 0 && sku[0].sku === "6838", "exact SKU ranks first");

const gotero = filterAndRankProducts(index, "gotero 100");
assert(gotero.length > 0 && gotero.some((r) => /gotero/i.test(r.label) && /100/.test(r.label + r.sku + r.id)), "token AND gotero 100");

const pu = filterAndRankProducts(index, "pu");
assert(pu.some((r) => /pu|espuma|poliuretano/i.test(r.label + r.key)), "pu alias");

const none = filterAndRankProducts(index, "xyzzy-no-existe-123");
assert(none.length === 0, "unknown query empty");

const ang = filterAndRankProducts(index, "angulo estructural");
assert(ang.some((r) => /5852|PLECHU|aluminio/i.test(r.label + r.sku)), "angulo estructural → 5852");
const sku5852 = filterAndRankProducts(index, "5852");
assert(sku5852.some((r) => /5852/i.test(r.label)), "5852 in index");

console.log(`\nproductSearch: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
