import assert from "node:assert/strict";
import crypto from "node:crypto";
import { igWebhookToOmniEvents } from "../server/lib/omni/adapters/igWebhook.js";
import { messengerWebhookToOmniEvents } from "../server/lib/omni/adapters/messengerWebhook.js";
import { handleMetaMessagingWebhook, verifyMetaWebhookSubscribe } from "../server/lib/omni/metaWebhookHandler.js";
import { buildMetaMessagePayload, sendMetaMessage } from "../server/lib/omni/outbound/metaSend.js";

const sample = (senderId, mid, text) => ({
  object: "page",
  entry: [{
    id: "page_1",
    messaging: [{
      sender: { id: senderId, name: "Cliente Test" },
      recipient: { id: "page_1" },
      timestamp: 1_783_515_000,
      message: { mid, text },
    }],
  }],
});

const ig = igWebhookToOmniEvents(sample("IGSID_1", "ig_mid_1", "Hola IG"));
assert.equal(ig.length, 1);
assert.equal(ig[0].channel, "ig");
assert.equal(ig[0].source, "ig_webhook");
assert.equal(ig[0].idempotency_key, "ig:msg:ig_mid_1");
assert.equal(ig[0].contact_hint.igsid, "IGSID_1");
assert.equal(ig[0].contact_hint.name, "Cliente Test");
assert.equal(ig[0].conversation_hint.channel_conversation_id, "IGSID_1");
assert.equal(ig[0].message.body, "Hola IG");

const fb = messengerWebhookToOmniEvents(sample("PSID_1", "fb_mid_1", "Hola FB"));
assert.equal(fb.length, 1);
assert.equal(fb[0].channel, "fb");
assert.equal(fb[0].source, "fb_webhook");
assert.equal(fb[0].idempotency_key, "fb:msg:fb_mid_1");
assert.equal(fb[0].contact_hint.psid, "PSID_1");

let persistCalls = 0;
const off = handleMetaMessagingWebhook({
  channel: "ig",
  enabled: false,
  appSecret: "",
  rawBodyBuffer: Buffer.from(JSON.stringify(sample("IGSID_1", "m", "off"))),
  signatureHeader: "bad",
  config: {},
  persist: async () => { persistCalls += 1; },
});
assert.equal(off.status, 200);
assert.equal(off.body.skipped, "flag_off");
await off.processing;
assert.equal(persistCalls, 0);

const bad = handleMetaMessagingWebhook({
  channel: "fb",
  enabled: true,
  appSecret: "secret",
  rawBodyBuffer: Buffer.from(JSON.stringify(sample("PSID_1", "m", "bad"))),
  signatureHeader: "sha256=bad",
  config: {},
  persist: async () => { throw new Error("must not persist"); },
});
assert.equal(bad.status, 401);
assert.equal(bad.body.error, "invalid webhook signature");

const raw = Buffer.from(JSON.stringify(sample("PSID_2", "good_mid", "ok")));
const sig = "sha256=" + crypto.createHmac("sha256", "secret").update(raw).digest("hex");
const persisted = [];
const good = handleMetaMessagingWebhook({
  channel: "fb",
  enabled: true,
  appSecret: "secret",
  rawBodyBuffer: raw,
  signatureHeader: sig,
  config: { databaseUrl: "postgres://unused" },
  persist: async (event) => { persisted.push(event); return { ok: true }; },
});
assert.equal(good.status, 200);
assert.equal(good.body.events, 1);
await good.processing;
assert.equal(persisted[0].idempotency_key, "fb:msg:good_mid");

const subscribeReq = {
  query: {
    "hub.mode": "subscribe",
    "hub.verify_token": "VERIFY_TOKEN",
    "hub.challenge": "challenge-value",
  },
};
const verifiedSubscribe = verifyMetaWebhookSubscribe(subscribeReq, "VERIFY_TOKEN");
assert.equal(verifiedSubscribe.status, 200);
assert.equal(verifiedSubscribe.body, "challenge-value");

const missingVerifyToken = verifyMetaWebhookSubscribe(
  {
    query: {
      "hub.mode": "subscribe",
      "hub.verify_token": "",
      "hub.challenge": "challenge-value",
    },
  },
  "",
);
assert.equal(missingVerifyToken.status, 503);
assert.equal(missingVerifyToken.body, "Webhook verification not configured");

const inside = buildMetaMessagePayload({
  recipientId: "RID",
  text: "Dentro",
  lastCustomerAt: "2026-07-08T09:00:00.000Z",
  now: new Date("2026-07-08T10:00:00.000Z"),
});
assert.equal(inside.inWindow, true);
assert.deepEqual(inside.payload, {
  recipient: { id: "RID" },
  message: { text: "Dentro" },
  messaging_type: "RESPONSE",
});

const outside = buildMetaMessagePayload({
  recipientId: "RID",
  text: "Fuera",
  lastCustomerAt: "2026-07-06T09:00:00.000Z",
  now: new Date("2026-07-08T10:00:00.000Z"),
});
assert.equal(outside.inWindow, false);
assert.equal(outside.payload.messaging_type, "MESSAGE_TAG");
assert.equal(outside.payload.tag, "HUMAN_AGENT");

let captured;
const sent = await sendMetaMessage({
  pageToken: "PAGE_TOKEN",
  recipientId: "RID",
  text: "Hola",
  lastCustomerAt: "2026-07-06T09:00:00.000Z",
  now: new Date("2026-07-08T10:00:00.000Z"),
  fetchImpl: async (url, init) => {
    captured = { url, headers: init.headers, body: JSON.parse(init.body) };
    return { ok: true, status: 200, json: async () => ({ recipient_id: "RID", message_id: "mid" }) };
  },
});
assert.equal(sent.ok, true);
assert.equal(captured.url, "https://graph.facebook.com/v21.0/me/messages");
assert.equal(captured.headers.Authorization, "Bearer PAGE_TOKEN");
assert.equal(captured.url.includes("PAGE_TOKEN"), false);
assert.equal(captured.body.messaging_type, "MESSAGE_TAG");
assert.equal(captured.body.tag, "HUMAN_AGENT");

const indexSource = await import("node:fs/promises")
  .then((fs) => fs.readFile(new URL("../server/index.js", import.meta.url), "utf8"));
assert.match(
  indexSource,
  /app\.get\("\/webhooks\/instagram",\s*metaWebhookVerifyLimiter,/,
);
assert.match(
  indexSource,
  /app\.get\("\/webhooks\/messenger",\s*metaWebhookVerifyLimiter,/,
);

console.log("omniMetaChannels.test.js: ok");
