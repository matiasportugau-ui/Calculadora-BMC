// Meta inbox Slack wiring leftover gates after #1239.
// Pins Cloud Run env (not --set-secrets), subscribe verify, persist/notify
// fail-soft, Slack HTTP/API errors, and no inbound /webhooks/slack.
// Complementary to slackNotify / metaNotify / omniMetaChannels — do not re-land those.
// Run: node tests/metaSlackWiringGates.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { sendSlackText } from "../server/lib/slack/notify.js";
import {
  handleMetaMessagingWebhook,
  verifyMetaWebhookSubscribe,
} from "../server/lib/omni/metaWebhookHandler.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/deploy-calc-api.yml"), "utf8");
for (const key of [
  "OMNI_IG_ENABLED",
  "OMNI_FB_ENABLED",
  "META_COMMENTS_ENABLED",
  "OWNER_WHATSAPP",
  "SLACK_NOTIFY_CHANNEL",
  "SLACK_BOT_TOKEN",
  "SLACK_WEBHOOK_URL",
]) {
  assert.ok(yml.includes(`${key}=`), `deploy env wires ${key}`);
}
const secretsFlag = yml.includes("--set-secrets=") ? yml.slice(yml.indexOf("--set-secrets=")) : "";
assert.equal(secretsFlag.includes("SLACK_BOT_TOKEN"), false, "Slack bot token stays off --set-secrets");
assert.equal(secretsFlag.includes("SLACK_WEBHOOK_URL"), false, "Slack webhook stays off --set-secrets");
assert.equal(secretsFlag.includes("OWNER_WHATSAPP"), false, "OWNER_WHATSAPP stays off --set-secrets");

const cfgSrc = fs.readFileSync(path.join(ROOT, "server/config.js"), "utf8");
assert.match(cfgSrc, /ownerWhatsapp:\s*process\.env\.OWNER_WHATSAPP/);
assert.match(cfgSrc, /slackBotToken:\s*process\.env\.SLACK_BOT_TOKEN/);
assert.match(cfgSrc, /slackWebhookUrl:\s*process\.env\.SLACK_WEBHOOK_URL/);
assert.match(cfgSrc, /slackNotifyChannel:\s*process\.env\.SLACK_NOTIFY_CHANNEL/);
assert.match(cfgSrc, /metaCommentsEnabled:\s*bool\(\s*process\.env\.META_COMMENTS_ENABLED,\s*false\s*\)/);

const example = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
assert.match(example, /^OWNER_WHATSAPP=/m);
assert.match(example, /^SLACK_BOT_TOKEN=/m);
assert.match(example, /^SLACK_WEBHOOK_URL=/m);
assert.match(example, /^SLACK_NOTIFY_CHANNEL=/m);
assert.match(example, /^META_COMMENTS_ENABLED=0$/m);

const indexSrc = fs.readFileSync(path.join(ROOT, "server/index.js"), "utf8");
assert.equal(indexSrc.includes("/webhooks/slack"), false, "no inbound Slack webhook this run");
assert.ok(indexSrc.includes("/webhooks/instagram"));
assert.ok(indexSrc.includes("/webhooks/messenger"));

assert.deepEqual(
  verifyMetaWebhookSubscribe(
    { query: { "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "123" } },
    "tok",
  ),
  { ok: true, status: 200, body: "123" },
);
assert.equal(
  verifyMetaWebhookSubscribe(
    { query: { "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "123" } },
    "tok",
  ).status,
  403,
);
assert.equal(
  verifyMetaWebhookSubscribe({ query: { "hub.mode": "unsubscribe", "hub.verify_token": "tok" } }, "tok")
    .status,
  403,
);

{
  const sample = {
    object: "page",
    entry: [
      {
        id: "page_1",
        messaging: [
          {
            sender: { id: "PSID_2", name: "Cliente" },
            recipient: { id: "page_1" },
            timestamp: 1_783_515_000,
            message: { mid: "mid_ok", text: "precio?" },
          },
        ],
      },
    ],
  };
  const raw = Buffer.from(JSON.stringify(sample));
  const sig = "sha256=" + crypto.createHmac("sha256", "secret").update(raw).digest("hex");

  const persistFailNotified = [];
  const persistFail = handleMetaMessagingWebhook({
    channel: "fb",
    enabled: true,
    appSecret: "secret",
    rawBodyBuffer: raw,
    signatureHeader: sig,
    config: { databaseUrl: "postgres://unused" },
    persist: async () => {
      throw new Error("db down");
    },
    notifyOwner: async (payload) => {
      persistFailNotified.push(payload);
    },
  });
  assert.equal(persistFail.status, 200);
  await persistFail.processing;
  assert.equal(persistFailNotified.length, 0);

  const notifyThrew = handleMetaMessagingWebhook({
    channel: "fb",
    enabled: true,
    appSecret: "secret",
    rawBodyBuffer: raw,
    signatureHeader: sig,
    config: { databaseUrl: "postgres://unused" },
    persist: async (event) => ({ duplicate: false, event }),
    notifyOwner: async () => {
      throw new Error("notify boom");
    },
  });
  await notifyThrew.processing;
}

{
  const prevNode = process.env.NODE_ENV;
  const prevApp = process.env.APP_ENV;
  process.env.NODE_ENV = "production";
  delete process.env.APP_ENV;
  try {
    const persisted = [];
    const notified = [];
    const r = handleMetaMessagingWebhook({
      channel: "fb",
      enabled: true,
      appSecret: "",
      rawBodyBuffer: Buffer.from("{}"),
      signatureHeader: "sha256=x",
      config: {},
      persist: async (event) => {
        persisted.push(event);
        return { ok: true };
      },
      notifyOwner: async (payload) => {
        notified.push(payload);
      },
    });
    // Current check order returns 401 before the 503 branch — pin fail-closed, not 200.
    assert.notEqual(r.status, 200);
    assert.ok(r.status === 401 || r.status === 503);
    await r.processing;
    assert.equal(persisted.length, 0);
    assert.equal(notified.length, 0);
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevApp === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prevApp;
  }
}

await assert.rejects(
  () =>
    sendSlackText({
      text: "hola",
      webhookUrl: "https://hooks.slack.com/services/T000/B000/XXX",
      fetchImpl: async () => ({ ok: false, status: 502, text: async () => "nope" }),
    }),
  /Slack webhook: HTTP 502/,
);

{
  const secretToken = "xoxb-secret-should-not-leak";
  await assert.rejects(
    () =>
      sendSlackText({
        text: "hola",
        botToken: secretToken,
        channel: "#meta-inbox",
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ ok: false, error: "channel_not_found" }),
        }),
      }),
    (err) => {
      assert.match(String(err.message), /Slack API: channel_not_found/);
      assert.equal(String(err.message).includes(secretToken), false);
      return true;
    },
  );
}

{
  const auths = [];
  const result = await sendSlackText({
    text: "hola",
    botToken: "xoxb-test",
    channel: "#meta-inbox",
    fetchImpl: async (_url, init) => {
      auths.push(init.headers.Authorization);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(auths[0].startsWith("Bearer "), true);
}

console.log("metaSlackWiringGates.test.js: ok");
