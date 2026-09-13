// IG vs Messenger outbound page-token isolation.
// Thin wrappers pick igPageToken / fbPageToken; a swap would send from the
// wrong Page (or fail Graph). Complementary to metaSendGates / omniMetaChannels.
// Do not re-land #1244 / #1246 / #1247.
// Run: node tests/metaPageTokenSendGates.test.js

import assert from "node:assert/strict";
import { sendIgReply } from "../server/lib/omni/outbound/igSend.js";
import { sendMessengerReply } from "../server/lib/omni/outbound/messengerSend.js";

const NOW = new Date("2026-09-13T12:00:00.000Z");

function captureFetch() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({ message_id: "mid.ok" }) };
  };
  return { calls, fetchImpl };
}

{
  const { calls, fetchImpl } = captureFetch();
  const sent = await sendIgReply({
    config: { igPageToken: "IG_PAGE", fbPageToken: "FB_MUST_NOT_USE" },
    recipientId: "IGSID_9",
    text: "precio IsoDec?",
    lastCustomerAt: "2026-09-13T10:00:00.000Z",
    now: NOW,
    fetchImpl,
  });
  assert.equal(sent.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /access_token=IG_PAGE/);
  assert.equal(calls[0].url.includes("FB_MUST_NOT_USE"), false);
  assert.equal(calls[0].body.recipient.id, "IGSID_9");
}

{
  const { calls, fetchImpl } = captureFetch();
  const sent = await sendMessengerReply({
    config: { igPageToken: "IG_MUST_NOT_USE", fbPageToken: "FB_PAGE" },
    recipientId: "PSID_9",
    text: "stock?",
    lastCustomerAt: "2026-09-13T10:00:00.000Z",
    now: NOW,
    fetchImpl,
  });
  assert.equal(sent.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /access_token=FB_PAGE/);
  assert.equal(calls[0].url.includes("IG_MUST_NOT_USE"), false);
  assert.equal(calls[0].body.recipient.id, "PSID_9");
}

{
  const calls = [];
  const ig = await sendIgReply({
    config: { fbPageToken: "FB_ONLY" },
    recipientId: "IGSID_1",
    text: "hola",
    fetchImpl: async (...args) => {
      calls.push(args);
      throw new Error("must not fetch");
    },
  });
  assert.deepEqual(ig, { ok: false, error: "meta_page_token_missing" });
  assert.equal(calls.length, 0);

  const fb = await sendMessengerReply({
    config: { igPageToken: "IG_ONLY" },
    recipientId: "PSID_1",
    text: "hola",
    fetchImpl: async (...args) => {
      calls.push(args);
      throw new Error("must not fetch");
    },
  });
  assert.deepEqual(fb, { ok: false, error: "meta_page_token_missing" });
  assert.equal(calls.length, 0);
}

{
  const { calls, fetchImpl } = captureFetch();
  await sendIgReply({
    config: { igPageToken: "IG_PAGE" },
    recipientId: "IGSID_2",
    text: "fuera de ventana",
    lastCustomerAt: "2026-09-10T12:00:00.000Z",
    now: NOW,
    fetchImpl,
  });
  assert.equal(calls[0].body.messaging_type, "MESSAGE_TAG");
  assert.equal(calls[0].body.tag, "HUMAN_AGENT");
}

console.log("metaPageTokenSendGates.test.js: ok");
