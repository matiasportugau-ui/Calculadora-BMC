/**
 * Shopper pageUrl must be http(s) only — never javascript:/data: into live board.
 * Run: node tests/storefrontPageUrl.test.js
 */
import assert from "node:assert/strict";
import { sanitizePageUrl } from "../server/routes/publicVoice.js";

console.log("storefrontPageUrl");

assert.equal(
  sanitizePageUrl("https://bmcuruguay.com.uy/products/iroof80-pls"),
  "https://bmcuruguay.com.uy/products/iroof80-pls",
);
assert.equal(
  sanitizePageUrl("http://127.0.0.1:9292/collections/techos"),
  "http://127.0.0.1:9292/collections/techos",
);
assert.equal(sanitizePageUrl("javascript:alert(1)"), "", "javascript: must not reach live board");
assert.equal(sanitizePageUrl("data:text/html,<script>alert(1)</script>"), "");
assert.equal(sanitizePageUrl("ftp://evil.example/x"), "");
assert.equal(sanitizePageUrl("/products/isodec"), "", "relative URLs are not page context");
assert.equal(sanitizePageUrl(""), "");
assert.equal(sanitizePageUrl(null), "");

const long = `https://bmcuruguay.com.uy/${"p".repeat(400)}`;
assert.ok(sanitizePageUrl(long).length <= 300);

console.log("storefrontPageUrl OK");
