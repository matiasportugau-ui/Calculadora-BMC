// ML webhook token source. Offline. No network.
// node tests/mlWebhookTokenGates.test.js
import assert from "node:assert/strict";
import fs from "node:fs";
import { authorizeMlWebhook, mlWebhookReceivedToken } from "../server/lib/mlWebhookAuth.js";

const OTHER_IP = "203.0.113.10";
const HMAC_OK = { ok: true, skipped: false };

function decide(receivedToken, webhookVerifyToken = "secret") {
  return authorizeMlWebhook({
    mlSigVerified: HMAC_OK,
    peerIp: OTHER_IP,
    webhookVerifyToken,
    receivedToken,
  });
}

{
  assert.equal(mlWebhookReceivedToken(undefined), undefined);
  assert.equal(mlWebhookReceivedToken({}), undefined);
  assert.equal(mlWebhookReceivedToken({ query: {}, headers: {} }), undefined);
}

{
  const token = mlWebhookReceivedToken({
    query: { verify_token: "from-query" },
    headers: {
      "x-webhook-token": "from-header",
      authorization: "Bearer secret",
    },
  });
  assert.equal(token, "from-query");
  assert.equal(decide(token).accept, false);
  assert.equal(decide(token).reason, "invalid_webhook_token");
}

{
  const token = mlWebhookReceivedToken({
    query: { verify_token: "" },
    headers: { "x-webhook-token": "secret", authorization: "Bearer nope" },
  });
  assert.equal(token, "secret");
  assert.equal(decide(token).accept, true);
  assert.equal(decide(token).via, "hmac");
}

{
  const token = mlWebhookReceivedToken({
    query: { verify_token: " " },
    headers: { "x-webhook-token": "secret" },
  });
  assert.equal(token, " ");
  assert.equal(decide(token).accept, false);
  assert.equal(decide(token).reason, "invalid_webhook_token");
}

{
  const token = mlWebhookReceivedToken({
    query: {},
    headers: { authorization: "Bearer secret" },
  });
  assert.equal(token, "Bearer secret");
  assert.equal(decide(token, "secret").accept, false);
  assert.equal(decide(token, "Bearer secret").accept, true);
  assert.equal(decide(token, "Bearer secret").via, "hmac");
}

{
  const duplicated = ["secret", "other"];
  const token = mlWebhookReceivedToken({
    query: { verify_token: duplicated },
    headers: { "x-webhook-token": "secret" },
  });
  assert.deepEqual(token, duplicated);
  assert.equal(decide(token, "secret").accept, false);
  assert.equal(decide(token, "secret").reason, "invalid_webhook_token");
}

{
  const token = mlWebhookReceivedToken({
    headers: { "X-Webhook-Token": "WRONG", "x-webhook-token": "secret", authorization: "nope" },
  });
  assert.equal(token, "secret");
  assert.equal(decide(token).accept, true);
}

{
  const indexSrc = fs.readFileSync(new URL("../server/index.js", import.meta.url), "utf8");
  const routerSrc = fs.readFileSync(new URL("../server/routes/webhooks.js", import.meta.url), "utf8");
  assert.match(indexSrc, /receivedToken:\s*mlWebhookReceivedToken\(req\)/);
  assert.match(routerSrc, /receivedToken:\s*mlWebhookReceivedToken\(req\)/);
  assert.doesNotMatch(indexSrc, /req\.query\.verify_token\s*\|\|/);
  assert.doesNotMatch(routerSrc, /req\.query\.verify_token\s*\|\|/);
}

console.log("mlWebhookTokenGates tests OK");
