import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyMLSignature } from "../server/lib/mlSignature.js";

const SECRET = "test-client-secret-abc123";

// Helper: build a valid signature header for given params
function buildSignature({ secret, dataId, requestId, ts }) {
  const parts = [];
  if (dataId !== undefined && dataId !== null && dataId !== "") parts.push(`id:${dataId}`);
  if (requestId) parts.push(`request-id:${requestId}`);
  parts.push(`ts:${ts}`);
  const template = parts.join(";");
  const hash = crypto.createHmac("sha256", secret).update(template).digest("hex");
  return `ts=${ts},v1=${hash}`;
}

const NOW = Date.now();
const DATA_ID = "98765";
const REQUEST_ID = "req-abc-123";

// 1. Valid signature → ok:true
{
  const sig = buildSignature({ secret: SECRET, dataId: DATA_ID, requestId: REQUEST_ID, ts: String(NOW) });
  const result = verifyMLSignature({
    clientSecret: SECRET,
    signatureHeader: sig,
    dataId: DATA_ID,
    requestId: REQUEST_ID,
    nowMs: NOW,
  });
  assert.equal(result.ok, true, "valid signature should return ok:true");
  assert.equal(result.skipped, undefined, "valid result should have no skipped flag");
}

// 2. Invalid signature (wrong hash) → ok:false
{
  const sig = buildSignature({ secret: SECRET, dataId: DATA_ID, requestId: REQUEST_ID, ts: String(NOW) });
  const tampered = sig.replace(/v1=[0-9a-f]+/, "v1=000000000000000000000000000000000000000000000000000000000000dead");
  const result = verifyMLSignature({
    clientSecret: SECRET,
    signatureHeader: tampered,
    dataId: DATA_ID,
    requestId: REQUEST_ID,
    nowMs: NOW,
  });
  assert.equal(result.ok, false, "tampered hash should return ok:false");
}

// 3. No client secret → skipped:true
{
  const result = verifyMLSignature({
    clientSecret: "",
    signatureHeader: "ts=123,v1=abc",
    dataId: DATA_ID,
    requestId: REQUEST_ID,
    nowMs: NOW,
  });
  assert.equal(result.ok, true, "missing secret should not block (skipped)");
  assert.equal(result.skipped, true, "missing secret should set skipped:true");
}

// 4. dataId altered after signing → ok:false
{
  const sig = buildSignature({ secret: SECRET, dataId: DATA_ID, requestId: REQUEST_ID, ts: String(NOW) });
  const result = verifyMLSignature({
    clientSecret: SECRET,
    signatureHeader: sig,
    dataId: "999999", // different dataId
    requestId: REQUEST_ID,
    nowMs: NOW,
  });
  assert.equal(result.ok, false, "altered dataId should fail verification");
}

// 5. Replay: timestamp older than 5 minutes → ok:false, reason:replay_too_old
{
  const oldTs = NOW - 6 * 60 * 1000; // 6 minutes ago
  const sig = buildSignature({ secret: SECRET, dataId: DATA_ID, requestId: REQUEST_ID, ts: String(oldTs) });
  const result = verifyMLSignature({
    clientSecret: SECRET,
    signatureHeader: sig,
    dataId: DATA_ID,
    requestId: REQUEST_ID,
    nowMs: NOW,
  });
  assert.equal(result.ok, false, "old timestamp should be rejected");
  assert.equal(result.reason, "replay_too_old", "reason should be replay_too_old");
}

// 6. Missing signature header → ok:false
{
  const result = verifyMLSignature({
    clientSecret: SECRET,
    signatureHeader: undefined,
    dataId: DATA_ID,
    requestId: REQUEST_ID,
    nowMs: NOW,
  });
  assert.equal(result.ok, false, "missing header should return ok:false");
  assert.equal(result.reason, "missing_signature_header");
}

// 7. Malformed header (no ts or v1) → ok:false
{
  const result = verifyMLSignature({
    clientSecret: SECRET,
    signatureHeader: "garbage-header-value",
    dataId: DATA_ID,
    requestId: REQUEST_ID,
    nowMs: NOW,
  });
  assert.equal(result.ok, false, "malformed header should return ok:false");
  assert.equal(result.reason, "malformed_signature_header");
}

// 8. No clientSecret=undefined (not just empty string) → skipped:true
{
  const result = verifyMLSignature({
    clientSecret: undefined,
    signatureHeader: "ts=123,v1=abc",
    dataId: DATA_ID,
    requestId: REQUEST_ID,
    nowMs: NOW,
  });
  assert.equal(result.skipped, true, "undefined clientSecret should set skipped:true");
}

console.log("mlSignature tests OK (8/8)");
