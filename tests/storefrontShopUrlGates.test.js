// Shop widget navigate / chat-link allowlist leftover after #1198 / #1216.
// Tip storefrontVoicePack only source-matches navigate helpers exist.
// Open #1180 pins sanitizePageUrl http(s); this file pins shopUrl + isSafeHref
// extracted from the shipped widget (exact host, not suffix/prefix).
// Run: node tests/storefrontShopUrlGates.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STOREFRONT_AGENT_CONFIG } from "../server/lib/voice/storefrontAgentConfig.js";

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

const SHOP_HOSTS = extractConstArray(widget, "SHOP_HOSTS");
assert.deepEqual(
  [...SHOP_HOSTS],
  [...STOREFRONT_AGENT_CONFIG.shopHosts],
  "widget SHOP_HOSTS must stay in sync with STOREFRONT_AGENT_CONFIG.shopHosts",
);

const shopUrlSrc = extractFunction(widget, "shopUrl");
const isSafeHrefSrc = extractFunction(widget, "isSafeHref");
assert.match(shopUrlSrc, /SHOP_HOSTS\.some/);
assert.match(isSafeHrefSrc, /wa\.me/);
assert.match(widget, /function goTo\(pathOrUrl\)/);
assert.match(widget, /shopUrl\(pathOrUrl\)/);
assert.match(widget, /Link fuera de la tienda BMC/);
assert.match(widget, /if \(isSafeHref\(raw\)\)/);

function loadHrefGates(location) {
  return new Function(
    "location",
    `"use strict";
    const SHOP_HOSTS = ${JSON.stringify(SHOP_HOSTS)};
    ${shopUrlSrc}
    ${isSafeHrefSrc}
    return { shopUrl, isSafeHref };`,
  )(location);
}

const shop = { origin: "https://bmcuruguay.com.uy", hostname: "bmcuruguay.com.uy", pathname: "/" };
const { shopUrl, isSafeHref } = loadHrefGates(shop);

assert.equal(shopUrl(""), null);
assert.equal(shopUrl("   "), null);
assert.equal(shopUrl("/products/isodec"), "/products/isodec");
assert.equal(shopUrl("https://bmcuruguay.com.uy/products/isodec?v=1"), "/products/isodec?v=1");
assert.equal(shopUrl("https://www.bmcuruguay.com.uy/products/isodec"), "/products/isodec");
assert.equal(shopUrl("https://xj4rir-qz.myshopify.com/products/x"), "/products/x");

assert.equal(shopUrl("https://evil.example/products/isodec"), null);
assert.equal(shopUrl("https://bmcuruguay.com.uy.evil.com/x"), null, "hostname suffix is not implied");
assert.equal(shopUrl("https://evil-bmcuruguay.com.uy/x"), null, "hostname prefix is not implied");
assert.equal(shopUrl("https://notbmcuruguay.com.uy/x"), null);
assert.equal(shopUrl("javascript:alert(1)"), null);
assert.equal(shopUrl("data:text/html,x"), null);
assert.equal(shopUrl("//evil.com/phish"), null, "protocol-relative attacker stays off-store");

assert.equal(isSafeHref("/products/isodec"), true);
assert.equal(isSafeHref("javascript:alert(1)"), false);
assert.equal(isSafeHref("JAVASCRIPT:alert(1)"), false);
assert.equal(isSafeHref("data:text/html,x"), false);
assert.equal(isSafeHref("//evil.com/x"), false);
assert.equal(isSafeHref("https://evil.example/x"), false);
assert.equal(isSafeHref("https://bmcuruguay.com.uy.evil.com/x"), false);
assert.equal(isSafeHref("https://wa.me/59892663245"), true);
assert.equal(isSafeHref("https://api.whatsapp.com/send"), true);
assert.equal(
  isSafeHref("https://panelin-calc-q74zutv7dq-uc.a.run.app/p.pdf"),
  true,
  "Cloud Run PDF hosts stay clickable",
);
assert.equal(isSafeHref("https://run.app.evil.com/x"), false, "run.app suffix on another registrable domain stays denied");

// Current isSafeHref uses host.endsWith("whatsapp.com"|"run.app") — pin, do not silently widen.
assert.equal(isSafeHref("https://evilwhatsapp.com/x"), true);
assert.equal(isSafeHref("https://evilrun.app/x"), true);

console.log("storefrontShopUrlGates.test.js: ok");
