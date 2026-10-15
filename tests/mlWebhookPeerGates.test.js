// Peer-IP edges for Mercado Libre notifications. Offline.
// node tests/mlWebhookPeerGates.test.js
import assert from "node:assert/strict";
import { authorizeMlWebhook, cloudRunPeerIp, normalizePeerIp } from "../server/lib/mlWebhookAuth.js";

const ML_IP = "18.206.34.84";
const OTHER_IP = "203.0.113.10";

function missingSignature() {
  return { ok: false, reason: "missing_signature_header" };
}

function allowlisted(peerIp) {
  return authorizeMlWebhook({ mlSigVerified: missingSignature(), peerIp });
}

{
  const req = { headers: { "x-forwarded-for": [OTHER_IP, ML_IP] }, socket: { remoteAddress: "10.0.0.1" } };
  assert.equal(cloudRunPeerIp(req), ML_IP);
  const decision = allowlisted(cloudRunPeerIp(req));
  assert.equal(decision.accept, true);
  assert.equal(decision.via, "ip_allowlist");
}

{
  const req = { headers: { "x-forwarded-for": [ML_IP, OTHER_IP] } };
  assert.equal(cloudRunPeerIp(req), OTHER_IP);
  const decision = allowlisted(cloudRunPeerIp(req));
  assert.equal(decision.accept, false);
  assert.equal(decision.reason, "missing_signature_header");
}

{
  const req = { headers: { "x-forwarded-for": [`${ML_IP}, ${OTHER_IP}`] } };
  assert.equal(cloudRunPeerIp(req), OTHER_IP);
}

{
  assert.equal(normalizePeerIp("[::ffff:18.206.34.84]:443"), ML_IP);
  assert.equal(normalizePeerIp("::FFFF:18.206.34.84"), ML_IP);
  const req = { headers: { "x-forwarded-for": "[::ffff:18.206.34.84]:443" } };
  assert.equal(cloudRunPeerIp(req), ML_IP);
  assert.equal(allowlisted(cloudRunPeerIp(req)).accept, true);
}

{
  const blank = { headers: { "x-forwarded-for": "   " }, socket: { remoteAddress: `::ffff:${ML_IP}` } };
  assert.equal(cloudRunPeerIp(blank), ML_IP);
  const commas = { headers: { "x-forwarded-for": "  ,  " }, connection: { remoteAddress: "[::ffff:35.245.91.34]" } };
  assert.equal(cloudRunPeerIp(commas), "35.245.91.34");
  const attackerSocket = { headers: { "x-forwarded-for": "   " }, socket: { remoteAddress: OTHER_IP } };
  assert.equal(allowlisted(cloudRunPeerIp(attackerSocket)).accept, false);
}

for (const ip of ["18.206.34.841", "18.206.34.84.evil", "x18.206.34.84", "18.206.34.8", "18.206.34.84:abc"]) {
  const decision = allowlisted(ip);
  assert.equal(decision.accept, false, ip);
  assert.equal(decision.peerIp, ip);
}

{
  assert.equal(allowlisted("18.206.34.84 ").accept, true);
  assert.equal(allowlisted("18.206.34.84 ").peerIp, ML_IP);
}

{
  const denied = authorizeMlWebhook({
    mlSigVerified: { ok: true },
    peerIp: ML_IP,
    webhookVerifyToken: "private-token",
    receivedToken: "Bearer private-token",
  });
  assert.equal(denied.accept, false);
  assert.equal(denied.reason, "invalid_webhook_token");
  assert.equal(denied.via, "rejected");
}

{
  const decision = authorizeMlWebhook({
    mlSigVerified: missingSignature(),
    peerIp: ML_IP,
    webhookVerifyToken: "private-token",
    receivedToken: "Bearer leftover",
  });
  assert.equal(decision.accept, true);
  assert.equal(decision.via, "ip_allowlist");
}

{
  const denied = authorizeMlWebhook({
    mlSigVerified: { ok: true, skipped: true },
    peerIp: ML_IP,
    webhookVerifyToken: "private-token",
    receivedToken: "wrong",
  });
  assert.equal(denied.accept, false);
  assert.equal(denied.reason, "invalid_webhook_token");
  assert.equal(denied.via, "rejected");

  const allowed = authorizeMlWebhook({
    mlSigVerified: { ok: true, skipped: true },
    peerIp: OTHER_IP,
    webhookVerifyToken: "private-token",
    receivedToken: "private-token",
  });
  assert.equal(allowed.accept, true);
  assert.equal(allowed.via, "hmac_skipped");

  const noToken = authorizeMlWebhook({
    mlSigVerified: { ok: true, skipped: true },
    peerIp: OTHER_IP,
  });
  assert.equal(noToken.accept, true);
  assert.equal(noToken.via, "hmac_skipped");
}

console.log("mlWebhookPeerGates OK");
