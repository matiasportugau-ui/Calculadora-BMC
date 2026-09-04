/**
 * Meta WhatsApp HMAC must fail-closed in production when the app secret
 * is missing. validation.js only pins the test-mode skip path.
 * Run: node tests/whatsappSignatureGate.test.js
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyWhatsAppSignature } from "../server/lib/whatsappSignature.js";

const SECRET = "unit-wa-hmac-secret";
const RAW = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');

function hmacHeader(secret, body) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function withEnv(patch, fn) {
  const keys = Object.keys(patch);
  const prev = {};
  for (const k of keys) {
    prev[k] = process.env[k];
    if (patch[k] === undefined) delete process.env[k];
    else process.env[k] = patch[k];
  }
  try {
    return fn();
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

console.log("whatsappSignatureGate");

{
  const ok = verifyWhatsAppSignature({
    appSecret: SECRET,
    rawBodyBuffer: RAW,
    signatureHeader: hmacHeader(SECRET, RAW),
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.skipped, undefined);
  console.log("  ✓ valid x-hub-signature-256 accepted");
}

{
  const bad = verifyWhatsAppSignature({
    appSecret: SECRET,
    rawBodyBuffer: RAW,
    signatureHeader: hmacHeader("other-secret", RAW),
  });
  assert.equal(bad.ok, false);
  console.log("  ✓ wrong secret rejected");
}

{
  const missing = verifyWhatsAppSignature({
    appSecret: SECRET,
    rawBodyBuffer: RAW,
    signatureHeader: undefined,
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "missing_header_or_body");
  const noBody = verifyWhatsAppSignature({
    appSecret: SECRET,
    rawBodyBuffer: null,
    signatureHeader: hmacHeader(SECRET, RAW),
  });
  assert.equal(noBody.ok, false);
  assert.equal(noBody.reason, "missing_header_or_body");
  console.log("  ✓ missing header or body fail-closed");
}

{
  const short = verifyWhatsAppSignature({
    appSecret: SECRET,
    rawBodyBuffer: RAW,
    signatureHeader: "sha256=deadbeef",
  });
  assert.equal(short.ok, false);
  assert.equal(short.reason, "length");
  console.log("  ✓ length-mismatched header fail-closed (no throw)");
}

{
  withEnv({ APP_ENV: "production", NODE_ENV: "production" }, () => {
    const denied = verifyWhatsAppSignature({
      appSecret: "",
      rawBodyBuffer: RAW,
      signatureHeader: hmacHeader(SECRET, RAW),
    });
    assert.equal(denied.ok, false, "empty secret in production must not skip");
    assert.equal(denied.reason, "secret_not_configured");
    assert.notEqual(denied.skipped, true);
  });
  console.log("  ✓ production without secret → secret_not_configured");
}

{
  withEnv({ APP_ENV: "test", NODE_ENV: "production" }, () => {
    const skipped = verifyWhatsAppSignature({
      appSecret: "",
      rawBodyBuffer: RAW,
      signatureHeader: "ignored",
    });
    assert.equal(skipped.ok, true);
    assert.equal(skipped.skipped, true);
  });
  console.log("  ✓ APP_ENV=test still allows skip (CI)");
}

console.log("whatsappSignatureGate OK");
