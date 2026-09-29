/**
 * Webhook HMAC edges the transportista suite does not pin.
 * Run: node tests/whatsappSignatureGates.test.js
 *
 * Pins: empty secret is a hard fail outside test mode; APP_ENV=test still skips;
 * whitespace-only header is a length mismatch (truthy before trim); a same-length
 * wrong digest fails closed without a reason; string bodies still verify.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyWhatsAppSignature } from "../server/lib/whatsappSignature.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const saved = {
  NODE_ENV: process.env.NODE_ENV,
  APP_ENV: process.env.APP_ENV,
};

function restoreEnv() {
  if (saved.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = saved.NODE_ENV;
  if (saved.APP_ENV === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = saved.APP_ENV;
}

console.log("whatsappSignatureGates");

const secret = "unit-test-secret";
const raw = Buffer.from('{"entry":[]}');
const good = `sha256=${crypto.createHmac("sha256", secret).update(raw).digest("hex")}`;

try {
  process.env.NODE_ENV = "production";
  delete process.env.APP_ENV;
  const prod = verifyWhatsAppSignature({
    appSecret: "",
    rawBodyBuffer: raw,
    signatureHeader: good,
  });
  assert.deepEqual(prod, { ok: false, reason: "secret_not_configured" });
  ok("production empty secret is secret_not_configured");

  process.env.NODE_ENV = "production";
  process.env.APP_ENV = "test";
  const skipped = verifyWhatsAppSignature({
    appSecret: "",
    rawBodyBuffer: raw,
    signatureHeader: "ignored",
  });
  assert.deepEqual(skipped, { ok: true, skipped: true });
  ok("APP_ENV=test skips even when NODE_ENV is production");

  delete process.env.APP_ENV;
  const missingHeader = verifyWhatsAppSignature({
    appSecret: secret,
    rawBodyBuffer: raw,
    signatureHeader: undefined,
  });
  assert.deepEqual(missingHeader, { ok: false, reason: "missing_header_or_body" });
  const missingBody = verifyWhatsAppSignature({
    appSecret: secret,
    rawBodyBuffer: null,
    signatureHeader: good,
  });
  assert.deepEqual(missingBody, { ok: false, reason: "missing_header_or_body" });
  ok("missing header or body");

  const blank = verifyWhatsAppSignature({
    appSecret: secret,
    rawBodyBuffer: raw,
    signatureHeader: "   ",
  });
  assert.deepEqual(blank, { ok: false, reason: "length" });
  ok("whitespace-only header is length, not missing");

  const trimmed = verifyWhatsAppSignature({
    appSecret: secret,
    rawBodyBuffer: raw,
    signatureHeader: `  ${good}  `,
  });
  assert.equal(trimmed.ok, true);
  ok("surrounding whitespace still verifies");

  const upper = verifyWhatsAppSignature({
    appSecret: secret,
    rawBodyBuffer: raw,
    signatureHeader: good.replace("sha256", "SHA256"),
  });
  assert.equal(upper.ok, false);
  assert.equal(upper.reason, undefined);
  ok("SHA256 prefix is case-sensitive and has no reason");

  const sameLen = verifyWhatsAppSignature({
    appSecret: secret,
    rawBodyBuffer: raw,
    signatureHeader: `sha256=${"0".repeat(64)}`,
  });
  assert.equal(sameLen.ok, false);
  assert.equal(sameLen.reason, undefined);
  ok("equal-length bad digest fails closed");

  const asString = verifyWhatsAppSignature({
    appSecret: secret,
    rawBodyBuffer: '{"entry":[]}',
    signatureHeader: good,
  });
  assert.equal(asString.ok, true);
  ok("string body verifies against the buffer digest");
} finally {
  restoreEnv();
}

console.log(`whatsappSignatureGates: ${passed} passed`);
