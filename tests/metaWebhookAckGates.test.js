// Meta webhook HTTP ack + persist/notify isolation — leftover from #1229 / #1239.
// #1244 pins subscribe 200/403, persist throw, empty-secret fail-closed.
// This file pins ack-on-bad-JSON, missing sig, mixed-batch persist, and
// `result && result.duplicate !== true` (undefined must NOT notify).
// Run: node tests/metaWebhookAckGates.test.js

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { handleMetaMessagingWebhook } from "../server/lib/omni/metaWebhookHandler.js";

function sample(senderId, mid, text) {
  return {
    object: "page",
    entry: [
      {
        id: "page_1",
        messaging: [
          {
            sender: { id: senderId, name: "Cliente Test" },
            recipient: { id: "page_1" },
            timestamp: 1_783_515_000,
            message: { mid, text },
          },
        ],
      },
    ],
  };
}

function signed(raw, secret = "secret") {
  return "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

function twoDms() {
  return {
    object: "page",
    entry: [
      {
        id: "page_1",
        messaging: [
          {
            sender: { id: "PSID_OK", name: "Ok" },
            recipient: { id: "page_1" },
            timestamp: 1_783_515_000,
            message: { mid: "mid_ok", text: "precio?" },
          },
          {
            sender: { id: "PSID_FAIL", name: "Fail" },
            recipient: { id: "page_1" },
            timestamp: 1_783_515_000,
            message: { mid: "mid_fail", text: "stock?" },
          },
        ],
      },
    ],
  };
}

// Invalid JSON after a valid HMAC still acks 200 and never persists/notifies
{
  const raw = Buffer.from("{not-json");
  const persistCalls = [];
  const notified = [];
  const res = handleMetaMessagingWebhook({
    channel: "fb",
    enabled: true,
    appSecret: "secret",
    rawBodyBuffer: raw,
    signatureHeader: signed(raw),
    config: {},
    persist: async (event) => {
      persistCalls.push(event);
      return { ok: true };
    },
    notifyOwner: async (payload) => {
      notified.push(payload);
    },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(res.body.events, undefined);
  await res.processing;
  assert.equal(persistCalls.length, 0);
  assert.equal(notified.length, 0);
}

// Empty body + valid HMAC → 200 events:0 (not 401). Missing header/body → 401.
{
  const empty = Buffer.alloc(0);
  const persistCalls = [];
  const okEmpty = handleMetaMessagingWebhook({
    channel: "ig",
    enabled: true,
    appSecret: "secret",
    rawBodyBuffer: empty,
    signatureHeader: signed(empty),
    config: {},
    persist: async (event) => {
      persistCalls.push(event);
      return { ok: true };
    },
    notifyOwner: async () => {
      throw new Error("must not notify");
    },
  });
  assert.equal(okEmpty.status, 200);
  assert.equal(okEmpty.body.ok, true);
  assert.equal(okEmpty.body.events, 0);
  await okEmpty.processing;
  assert.equal(persistCalls.length, 0);

  const missingSig = handleMetaMessagingWebhook({
    channel: "fb",
    enabled: true,
    appSecret: "secret",
    rawBodyBuffer: Buffer.from(JSON.stringify(sample("PSID_1", "m", "x"))),
    signatureHeader: undefined,
    config: {},
    persist: async () => {
      throw new Error("must not persist");
    },
    notifyOwner: async () => {
      throw new Error("must not notify");
    },
  });
  assert.equal(missingSig.status, 401);
  assert.equal(missingSig.body.error, "invalid webhook signature");

  const missingBody = handleMetaMessagingWebhook({
    channel: "fb",
    enabled: true,
    appSecret: "secret",
    rawBodyBuffer: undefined,
    signatureHeader: "sha256=dead",
    config: {},
    persist: async () => {
      throw new Error("must not persist");
    },
    notifyOwner: async () => {
      throw new Error("must not notify");
    },
  });
  assert.equal(missingBody.status, 401);
}

// Mixed batch: persist throw on one item must not block notify on the other
{
  const raw = Buffer.from(JSON.stringify(twoDms()));
  const persisted = [];
  const notified = [];
  const res = handleMetaMessagingWebhook({
    channel: "fb",
    enabled: true,
    appSecret: "secret",
    rawBodyBuffer: raw,
    signatureHeader: signed(raw),
    config: { databaseUrl: "postgres://unused" },
    persist: async (event) => {
      persisted.push(event.idempotency_key);
      if (event.idempotency_key === "fb:msg:mid_fail") throw new Error("db down");
      return { ok: true, duplicate: false };
    },
    notifyOwner: async (payload) => {
      notified.push(payload.event.idempotency_key);
      return { sent: "immediate" };
    },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.events, 2);
  const results = await res.processing;
  assert.equal(persisted.length, 2);
  assert.deepEqual(notified, ["fb:msg:mid_ok"]);
  assert.equal(results.filter((r) => r == null).length, 1);
}

// persist returning undefined/null must NOT notify (pin `result &&`, do not change to `result?.duplicate !== true`)
{
  const raw = Buffer.from(JSON.stringify(sample("PSID_U", "mid_undef", "hola")));
  const notified = [];
  const undef = handleMetaMessagingWebhook({
    channel: "fb",
    enabled: true,
    appSecret: "secret",
    rawBodyBuffer: raw,
    signatureHeader: signed(raw),
    config: {},
    persist: async () => undefined,
    notifyOwner: async (payload) => {
      notified.push(payload);
    },
  });
  await undef.processing;
  assert.equal(notified.length, 0);

  const nil = handleMetaMessagingWebhook({
    channel: "fb",
    enabled: true,
    appSecret: "secret",
    rawBodyBuffer: raw,
    signatureHeader: signed(raw),
    config: {},
    persist: async () => null,
    notifyOwner: async (payload) => {
      notified.push(payload);
    },
  });
  await nil.processing;
  assert.equal(notified.length, 0);
}

// persist `{ok:true}` without a duplicate flag still notifies
{
  const raw = Buffer.from(JSON.stringify(sample("PSID_D", "mid_ok2", "ok")));
  const notified = [];
  const res = handleMetaMessagingWebhook({
    channel: "ig",
    enabled: true,
    appSecret: "secret",
    rawBodyBuffer: raw,
    signatureHeader: signed(raw),
    config: {},
    persist: async () => ({ ok: true }),
    notifyOwner: async (payload) => {
      notified.push(payload.event.idempotency_key);
    },
  });
  await res.processing;
  assert.deepEqual(notified, ["ig:msg:mid_ok2"]);
}

console.log("metaWebhookAckGates.test.js: ok");
