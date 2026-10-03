import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyMLSignature } from "../server/lib/mlSignature.js";
import {
  ML_NOTIFICATION_IPS,
  authorizeMlWebhook,
  cloudRunPeerIp,
  normalizePeerIp,
} from "../server/lib/mlWebhookAuth.js";

const SECRET = "test-client-secret-abc123";
const NOW = 1_700_000_000_000;
const DATA_ID = "98765";
const ML_IP = "18.206.34.84";
const OTHER_IP = "203.0.113.10";

function buildSignature({ secret, dataId, requestId, ts }) {
  const parts = [];
  if (dataId) parts.push(`id:${dataId}`);
  if (requestId) parts.push(`request-id:${requestId}`);
  parts.push(`ts:${ts}`);
  const hash = crypto.createHmac("sha256", secret).update(parts.join(";")).digest("hex");
  return `ts=${ts},v1=${hash}`;
}

function verified(overrides) {
  return verifyMLSignature({
    clientSecret: SECRET,
    dataId: DATA_ID,
    requestId: "req-1",
    nowMs: NOW,
    ...overrides,
  });
}

// A missing header stays an HMAC failure. The allowlist is a separate check.
{
  const hmac = verified({ signatureHeader: undefined });
  assert.equal(hmac.ok, false);
  assert.equal(hmac.reason, "missing_signature_header");
}

for (const ip of ML_NOTIFICATION_IPS) {
  const decision = authorizeMlWebhook({
    mlSigVerified: verified({ signatureHeader: undefined }),
    peerIp: ip,
  });
  assert.equal(decision.accept, true, ip);
  assert.equal(decision.via, "ip_allowlist");
  assert.equal(decision.peerIp, ip);
}

{
  const decision = authorizeMlWebhook({
    mlSigVerified: verified({ signatureHeader: undefined }),
    peerIp: OTHER_IP,
  });
  assert.equal(decision.accept, false);
  assert.equal(decision.reason, "missing_signature_header");
}

{
  const sig = buildSignature({ secret: SECRET, dataId: DATA_ID, requestId: "req-1", ts: String(NOW) });
  const decision = authorizeMlWebhook({
    mlSigVerified: verified({ signatureHeader: sig }),
    peerIp: OTHER_IP,
  });
  assert.equal(decision.accept, true);
  assert.equal(decision.via, "hmac");
}

{
  const sig = buildSignature({ secret: SECRET, dataId: DATA_ID, requestId: "req-1", ts: String(NOW) });
  const tampered = sig.replace(/v1=[0-9a-f]+/, "v1=" + "ab".repeat(32));
  const decision = authorizeMlWebhook({
    mlSigVerified: verified({ signatureHeader: tampered }),
    peerIp: ML_IP,
  });
  assert.equal(decision.accept, false);
  assert.equal(decision.via, "rejected");
}

{
  const decision = authorizeMlWebhook({
    mlSigVerified: verified({ signatureHeader: "not-a-signature" }),
    peerIp: ML_IP,
  });
  assert.equal(decision.accept, false);
  assert.equal(decision.reason, "malformed_signature_header");
}

{
  const oldTs = NOW - 6 * 60 * 1000;
  const sig = buildSignature({ secret: SECRET, dataId: DATA_ID, requestId: "req-1", ts: String(oldTs) });
  const decision = authorizeMlWebhook({
    mlSigVerified: verified({ signatureHeader: sig }),
    peerIp: ML_IP,
  });
  assert.equal(decision.accept, false);
  assert.equal(decision.reason, "replay_too_old");
}

{
  const prev = process.env.APP_ENV;
  process.env.APP_ENV = "production";
  const hmac = verifyMLSignature({
    clientSecret: "",
    signatureHeader: undefined,
    dataId: DATA_ID,
    nowMs: NOW,
  });
  const decision = authorizeMlWebhook({ mlSigVerified: hmac, peerIp: ML_IP });
  assert.equal(decision.accept, false);
  assert.equal(decision.reason, "secret_not_configured");
  process.env.APP_ENV = prev;
}

{
  assert.equal(normalizePeerIp("::ffff:18.215.140.160"), "18.215.140.160");
  assert.equal(normalizePeerIp("35.245.20.104:443"), "35.245.20.104");
  const req = {
    headers: { "x-forwarded-for": `1.1.1.1, ${ML_IP}` },
    socket: { remoteAddress: "10.0.0.1" },
  };
  assert.equal(cloudRunPeerIp(req), ML_IP);
  const decision = authorizeMlWebhook({
    mlSigVerified: verified({ signatureHeader: undefined }),
    peerIp: cloudRunPeerIp(req),
  });
  assert.equal(decision.accept, true);
  assert.equal(decision.via, "ip_allowlist");
}

{
  const req = {
    headers: { "x-forwarded-for": `${ML_IP}, ${OTHER_IP}` },
  };
  assert.equal(cloudRunPeerIp(req), OTHER_IP);
  const decision = authorizeMlWebhook({
    mlSigVerified: verified({ signatureHeader: undefined }),
    peerIp: cloudRunPeerIp(req),
  });
  assert.equal(decision.accept, false);
}

{
  const req = { headers: {}, socket: { remoteAddress: `::ffff:${ML_IP}` } };
  assert.equal(cloudRunPeerIp(req), ML_IP);
}

{
  const decision = authorizeMlWebhook({
    mlSigVerified: verified({ signatureHeader: undefined }),
    peerIp: ML_IP,
    webhookVerifyToken: "private-token",
    receivedToken: "",
  });
  assert.equal(decision.accept, true);
  assert.equal(decision.via, "ip_allowlist");
}

{
  const sig = buildSignature({ secret: SECRET, dataId: DATA_ID, requestId: "req-1", ts: String(NOW) });
  const denied = authorizeMlWebhook({
    mlSigVerified: verified({ signatureHeader: sig }),
    peerIp: OTHER_IP,
    webhookVerifyToken: "private-token",
    receivedToken: "wrong",
  });
  assert.equal(denied.accept, false);
  assert.equal(denied.reason, "invalid_webhook_token");

  const allowed = authorizeMlWebhook({
    mlSigVerified: verified({ signatureHeader: sig }),
    peerIp: OTHER_IP,
    webhookVerifyToken: "private-token",
    receivedToken: "private-token",
  });
  assert.equal(allowed.accept, true);
  assert.equal(allowed.via, "hmac");
}

console.log("mlWebhookAuth tests OK");
