/**
 * Quote→cart qty must keep BOM counts when shop unit price >> lista pu.
 * Run: node tests/storefrontCartQty.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cartQtyFromLine } from "../server/lib/voice/storefrontCartQty.js";

console.log("storefrontCartQty");

// Live bmcuruguay.com.uy prices (2026-09-10): tuerca $2, varilla $19.90, IsoDec $46.07
assert.equal(
  cartQtyFromLine({ quantity: 92, pu_usd: 0.08, cant: 92 }, "2.00"),
  92,
  "tuerca keeps BOM qty (old value-match → 4)",
);
assert.equal(
  cartQtyFromLine({ quantity: 10, pu_usd: 3.68, cant: 10 }, "19.90"),
  10,
  "varilla keeps BOM qty (old value-match → 2)",
);
assert.equal(
  cartQtyFromLine({ quantity: 90, pu_usd: 41.15, cant: 89.6 }, "46.07"),
  90,
  "panel m² qty unchanged",
);
assert.equal(cartQtyFromLine({ quantity: 0 }, "1"), 1, "floor at 1");
assert.equal(cartQtyFromLine({ quantity: 999 }, "1"), 500, "cap at 500");
console.log("  ✓ cartQtyFromLine trusts BOM");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const widget = fs.readFileSync(path.join(ROOT, "server/public/storefront-voice/widget.js"), "utf8");
const fn = widget.match(/function cartQtyFromLine\([\s\S]*?\n  \}/);
assert.ok(fn, "widget defines cartQtyFromLine");
assert.ok(!/sp > pu \* 4/.test(fn[0]), "widget must not value-match shop vs lista");
assert.ok(/Math\.round\(Number\(line\.quantity\)/.test(fn[0]), "widget uses line.quantity");
console.log("  ✓ widget in sync with SoT");

console.log("storefrontCartQty.test.js: ok");
