// Exact thickness matching for quote → Shopify cart.
// Run: node tests/storefrontCartVariant.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mmInTitle,
  pickVariant,
} from "../server/lib/voice/storefrontCartVariant.js";

assert.equal(mmInTitle("50mm / Blanco", "50"), true);
assert.equal(mmInTitle("50 mm / Blanco", "50"), true);
assert.equal(mmInTitle("150mm / Blanco", "50"), false, "50 must not match 150mm");
assert.equal(mmInTitle("180mm / Gris", "80"), false, "80 must not match 180mm");
assert.equal(mmInTitle("100mm / Rojo", "100"), true);
assert.equal(mmInTitle("Espesor 50", "50"), true, "bare number ok when no Nmm tokens");
assert.equal(mmInTitle("Espesor 150", "50"), false);

const both = {
  variants: [
    { id: 150, title: "150mm / Blanco", available: true },
    { id: 50, title: "50mm / Blanco", available: true },
  ],
};
assert.equal(
  pickVariant(both, { espesor: "50", color: "Blanco" })?.id,
  50,
  "prefer exact 50mm over 150mm listed first",
);
assert.equal(
  pickVariant(both, { espesor: "150", color: "Blanco" })?.id,
  150,
);

const onlyWrong = {
  variants: [{ id: 1, title: "100mm / Rojo", available: true }],
};
assert.equal(
  pickVariant(onlyWrong, { espesor: "50", color: "Blanco" }),
  null,
  "refuse wrong thickness instead of substituting",
);

const colorOnly = {
  variants: [
    { id: 9, title: "Default Title", option1: "Blanco", available: true },
  ],
};
assert.equal(
  pickVariant(colorOnly, { color: "Blanco" })?.id,
  9,
  "no espesor → color/availability still works",
);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const widget = fs.readFileSync(
  path.join(ROOT, "server/public/storefront-voice/widget.js"),
  "utf8",
);
assert.ok(
  widget.includes("(?:^|[^0-9])${n}mm(?:[^0-9]|$)"),
  "widget keeps digit-safe mm regex",
);
assert.ok(
  !/return t\.includes\(`\$\{n\}mm`\) \|\| t\.includes\(n\);/.test(widget),
  "widget must not use bare includes(n) mm match",
);
assert.ok(
  widget.includes("if (mm && best.score < 4) return null"),
  "widget refuses non-matching thickness",
);

console.log("storefrontCartVariant.test.js: ok");
