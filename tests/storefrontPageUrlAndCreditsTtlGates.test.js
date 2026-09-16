// Public pageUrl sanitizer + voice-credits TTL.
// javascript:/data: must never reach Admin notes or the voice pack.
// TTL < 1s must not restart a mint storm. Complementary to publicVoiceAdmin / storefrontVoiceCredits.
// Run: node tests/storefrontPageUrlAndCreditsTtlGates.test.js

import assert from "node:assert/strict";
import { sanitizePageUrl } from "../server/routes/publicVoice.js";
import { grokCreditsTtlMs } from "../server/lib/voice/storefrontVoiceCredits.js";

assert.equal(sanitizePageUrl(""), "");
assert.equal(sanitizePageUrl("   "), "");
assert.equal(sanitizePageUrl(null), "");
assert.equal(sanitizePageUrl("javascript:alert(1)"), "", "javascript: never kept");
assert.equal(sanitizePageUrl("JAVASCRIPT:alert(1)"), "", "scheme check is after URL parse");
assert.equal(sanitizePageUrl("data:text/html,<script>alert(1)</script>"), "");
assert.equal(sanitizePageUrl("ftp://files.example/p.pdf"), "");
assert.equal(sanitizePageUrl("/products/isodec"), "", "relative path is not a URL");
assert.equal(sanitizePageUrl("//evil.example/phish"), "");

{
  const https = sanitizePageUrl("  https://bmcuruguay.com.uy/products/isodec  ");
  assert.equal(https, "https://bmcuruguay.com.uy/products/isodec");
}

{
  const http = sanitizePageUrl("http://127.0.0.1:9292/storefront-voice/");
  assert.equal(
    http,
    "http://127.0.0.1:9292/storefront-voice/",
    "http stays allowed (local widget / Shopify preview) — pin, do not force https",
  );
}

{
  const long = `https://bmcuruguay.com.uy/${"x".repeat(400)}`;
  const clipped = sanitizePageUrl(long);
  assert.ok(clipped.startsWith("https://bmcuruguay.com.uy/"));
  assert.ok(clipped.length <= 300, "pageUrl cap 300");
}

{
  const prev = process.env.STOREFRONT_VOICE_CREDITS_TTL_MS;
  try {
    delete process.env.STOREFRONT_VOICE_CREDITS_TTL_MS;
    assert.equal(grokCreditsTtlMs(), 30 * 60 * 1000, "default 30 min");

    process.env.STOREFRONT_VOICE_CREDITS_TTL_MS = "500";
    assert.equal(grokCreditsTtlMs(), 30 * 60 * 1000, "sub-1s TTL ignored");

    process.env.STOREFRONT_VOICE_CREDITS_TTL_MS = "0";
    assert.equal(grokCreditsTtlMs(), 30 * 60 * 1000);

    process.env.STOREFRONT_VOICE_CREDITS_TTL_MS = "abc";
    assert.equal(grokCreditsTtlMs(), 30 * 60 * 1000);

    process.env.STOREFRONT_VOICE_CREDITS_TTL_MS = "120000";
    assert.equal(grokCreditsTtlMs(), 120000);
  } finally {
    if (prev === undefined) delete process.env.STOREFRONT_VOICE_CREDITS_TTL_MS;
    else process.env.STOREFRONT_VOICE_CREDITS_TTL_MS = prev;
  }
}

console.log("storefrontPageUrlAndCreditsTtlGates.test.js: ok");
