// Meta Graph outbound leftover gates after #1229 / #1239.
// omniMetaChannels (orphan on tip, wired on #1244) only pins the happy-path
// RESPONSE vs HUMAN_AGENT send. This file pins deny / 24h boundary / clip /
// Graph fail / token encoding those suites do not cover.
// Do not re-land #1244 / #1246 / #1247.
// Run: node tests/metaSendGates.test.js

import assert from "node:assert/strict";
import {
  buildMetaMessagePayload,
  isWithin24h,
  sendMetaMessage,
} from "../server/lib/omni/outbound/metaSend.js";

const NOW = new Date("2026-09-13T12:00:00.000Z");
const INSIDE = "2026-09-13T00:00:00.000Z";
const EXACT_24H = "2026-09-12T12:00:00.000Z";
const JUST_OUT = "2026-09-12T11:59:59.000Z";

assert.equal(isWithin24h(INSIDE, NOW), true);
assert.equal(isWithin24h(EXACT_24H, NOW), true, "n - t === 24h stays RESPONSE");
assert.equal(isWithin24h(JUST_OUT, NOW), false);
assert.equal(isWithin24h("", NOW), false);
assert.equal(isWithin24h(null, NOW), false);
assert.equal(isWithin24h("not-a-date", NOW), false);
assert.equal(isWithin24h(INSIDE, "also-bad"), false);

{
  const { payload, inWindow } = buildMetaMessagePayload({
    recipientId: 99,
    text: "x".repeat(2500),
    lastCustomerAt: INSIDE,
    now: NOW,
  });
  assert.equal(inWindow, true);
  assert.equal(payload.recipient.id, "99");
  assert.equal(payload.message.text.length, 2000);
  assert.equal(payload.messaging_type, "RESPONSE");
  assert.equal(Object.hasOwn(payload, "tag"), false);
}

{
  const { payload, inWindow } = buildMetaMessagePayload({
    recipientId: "PSID_1",
    text: "fuera",
    lastCustomerAt: JUST_OUT,
    tag: "ACCOUNT_UPDATE",
    now: NOW,
  });
  assert.equal(inWindow, false);
  assert.equal(payload.messaging_type, "MESSAGE_TAG");
  assert.equal(payload.tag, "ACCOUNT_UPDATE", "caller tag wins outside window");
}

{
  const { payload } = buildMetaMessagePayload({
    recipientId: "PSID_1",
    text: "fuera",
    lastCustomerAt: JUST_OUT,
    now: NOW,
  });
  assert.equal(payload.tag, "HUMAN_AGENT");
}

{
  const calls = [];
  const missingToken = await sendMetaMessage({
    pageToken: "",
    recipientId: "RID",
    text: "hola",
    fetchImpl: async (...args) => {
      calls.push(args);
      throw new Error("must not fetch");
    },
  });
  assert.deepEqual(missingToken, { ok: false, error: "meta_page_token_missing" });
  assert.equal(calls.length, 0);

  const missingRecipient = await sendMetaMessage({
    pageToken: "PAGE",
    recipientId: "",
    text: "hola",
    fetchImpl: async (...args) => {
      calls.push(args);
      throw new Error("must not fetch");
    },
  });
  assert.deepEqual(missingRecipient, { ok: false, error: "meta_recipient_missing" });
  assert.equal(calls.length, 0);
}

{
  const calls = [];
  const token = "page/token+plus";
  const sent = await sendMetaMessage({
    pageToken: token,
    recipientId: "RID",
    text: "Hola",
    lastCustomerAt: INSIDE,
    now: NOW,
    graphApiVersion: "v22.0",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ message_id: "mid.1" }) };
    },
  });
  assert.equal(sent.ok, true);
  assert.equal(sent.inWindow, true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    `https://graph.facebook.com/v22.0/me/messages?access_token=${encodeURIComponent(token)}`,
  );
  assert.equal(calls[0].url.includes("page/token+plus"), false, "token is URL-encoded");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(JSON.parse(calls[0].init.body).messaging_type, "RESPONSE");
}

{
  const fail = await sendMetaMessage({
    pageToken: "PAGE",
    recipientId: "RID",
    text: "hola",
    lastCustomerAt: JUST_OUT,
    now: NOW,
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Invalid OAuth access token" } }),
    }),
  });
  assert.equal(fail.ok, false);
  assert.equal(fail.status, 400);
  assert.equal(fail.error, "Invalid OAuth access token");
  assert.equal(fail.inWindow, false);
  assert.equal(fail.payload.tag, "HUMAN_AGENT");
  assert.equal(String(fail.error).includes("PAGE"), false, "page token stays out of error");
}

{
  const brokenJson = await sendMetaMessage({
    pageToken: "PAGE",
    recipientId: "RID",
    text: "hola",
    fetchImpl: async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    }),
  });
  assert.equal(brokenJson.ok, false);
  assert.equal(brokenJson.status, 502);
  assert.equal(brokenJson.error, "meta_send_failed");
}

console.log("metaSendGates.test.js: ok");
