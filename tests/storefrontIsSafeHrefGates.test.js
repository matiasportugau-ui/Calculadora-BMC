// Regression: Panelin Front isSafeHref must not treat host.endsWith("run.app")
// / "whatsapp.com" as trust — that rendered clickable phishing links when the
// model (or prompt injection) echoed https://evilrun.app / evilwhatsapp.com.
// Extracts the shipped widget gate and asserts exact-or-subdomain matching.
// Run: node tests/storefrontIsSafeHrefGates.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const widget = fs.readFileSync(path.join(ROOT, "server/public/storefront-voice/widget.js"), "utf8");

function extractConstArray(src, name) {
  const re = new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);`);
  const m = src.match(re);
  assert.ok(m, `widget declares ${name}`);
  return Function(`"use strict"; return ${m[1]}`)();
}

function extractFunction(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `widget has function ${name}`);
  const next = src.indexOf("\n  function ", start + 1);
  assert.ok(next > start, `${name} is followed by another function`);
  return src.slice(start, next);
}

assert.equal(widget.includes('host.endsWith("whatsapp.com")'), false, "bare endsWith whatsapp.com removed");
assert.equal(widget.includes('host.endsWith("run.app")'), false, "bare endsWith run.app removed");

const SHOP_HOSTS = extractConstArray(widget, "SHOP_HOSTS");
const isSafeHrefSrc = extractFunction(widget, "isSafeHref");
assert.match(isSafeHrefSrc, /host\.endsWith\("\." \+ base\)/);

const isSafeHref = new Function(
  "location",
  "SHOP_HOSTS",
  `"use strict";
  ${isSafeHrefSrc}
  return isSafeHref;`,
)({ origin: "https://bmcuruguay.com.uy", hostname: "bmcuruguay.com.uy" }, SHOP_HOSTS);

assert.equal(isSafeHref("/products/isodec"), true);
assert.equal(isSafeHref("javascript:alert(1)"), false);
assert.equal(isSafeHref("//evil.com/x"), false);
assert.equal(isSafeHref("https://evil.example/x"), false);
assert.equal(isSafeHref("https://bmcuruguay.com.uy/products/x"), true);
assert.equal(isSafeHref("https://wa.me/59892663245"), true);
assert.equal(isSafeHref("https://api.whatsapp.com/send"), true);
assert.equal(isSafeHref("https://www.whatsapp.com/"), true);
assert.equal(
  isSafeHref("https://panelin-calc-q74zutv7dq-uc.a.run.app/p.pdf"),
  true,
  "Cloud Run PDF hosts stay clickable",
);
assert.equal(isSafeHref("https://storage.googleapis.com/bucket/x"), true);
assert.equal(isSafeHref("https://lh3.googleusercontent.com/a"), true);

assert.equal(isSafeHref("https://evilwhatsapp.com/x"), false, "suffix spoof whatsapp denied");
assert.equal(isSafeHref("https://evilrun.app/x"), false, "suffix spoof run.app denied");
assert.equal(isSafeHref("https://evilgoogleapis.com/x"), false);
assert.equal(isSafeHref("https://notgoogleusercontent.com/x"), false);
assert.equal(isSafeHref("https://run.app.evil.com/x"), false);
assert.equal(isSafeHref("https://whatsapp.com.evil.com/x"), false);

console.log("storefrontIsSafeHrefGates.test.js: ok");
