// Meta owner notify leftover gates after #1229 / #1239.
// Complementary to tests/metaNotify.test.js — pins Slack∥WhatsApp isolation,
// Slack-config edges, and enqueue fail-soft. Do not re-land metaNotify.test.js.
// Run: node tests/metaNotifyParallelGates.test.js

import assert from "node:assert/strict";
import {
  channelLabel,
  createNotifyQueue,
  enqueueNotifyOwner,
  formatOwnerNotification,
  isSlackConfigured,
  kindLabel,
  resetNotifyQueueForTests,
} from "../server/lib/meta/notify.js";

resetNotifyQueueForTests();

const igEvent = {
  channel: "ig",
  contact_hint: { igsid: "IGSID_1", name: "Ana" },
  message: { sender: "customer", sender_id: "IGSID_1", body: "Hola?", metadata: {} },
};

assert.equal(channelLabel("instagram"), "IG");
assert.equal(channelLabel("facebook"), "FB");
assert.equal(channelLabel("tiktok"), "TIKTOK");
assert.equal(channelLabel(), "?");
assert.equal(kindLabel({ kind: "comments" }), "comentario");

assert.equal(isSlackConfigured({ slackWebhookUrl: "   " }), false);
assert.equal(isSlackConfigured({ slackBotToken: "xoxb", slackNotifyChannel: "" }), false);
assert.equal(isSlackConfigured({ slackBotToken: "", slackNotifyChannel: "#meta" }), false);
assert.equal(isSlackConfigured({ slackBotToken: "xoxb", slackNotifyChannel: "   " }), false);

{
  const q = createNotifyQueue({
    config: { ownerWhatsapp: "59899111222" },
    now: () => 1_000,
    fetchImpl: async () => {
      throw new Error("must not fetch");
    },
  });
  const r = await q.notifyOwner({ event: igEvent, n: 1 });
  assert.equal(r.skipped, "whatsapp_not_configured");
}

{
  const long = "x".repeat(400);
  const line = formatOwnerNotification({
    event: { ...igEvent, message: { ...igEvent.message, body: long } },
    n: 1,
  });
  assert.equal(line.includes("x".repeat(281)), false);
  assert.match(line, /Ana: "x{280}"/);
}

{
  const noName = {
    channel: "ig",
    contact_hint: {},
    message: { sender_id: "IGSID_9", body: "hi", metadata: {} },
  };
  assert.match(formatOwnerNotification({ event: noName, n: 1 }), /IGSID_9/);
  const unknown = { channel: "ig", contact_hint: {}, message: { body: "hi", metadata: {} } };
  assert.match(formatOwnerNotification({ event: unknown, n: 1 }), /desconocido/);
  const dmWithTitle = formatOwnerNotification({
    event: { ...igEvent, post_title: "SALE" },
    n: 1,
  });
  assert.equal(dmWithTitle.includes("post:"), false);
}

{
  const waCalls = [];
  const slackCalls = [];
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    waCalls.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: "wamid.X" }] }),
    };
  };
  try {
    const q = createNotifyQueue({
      config: {
        ownerWhatsapp: "59899111222",
        whatsappAccessToken: "tok",
        whatsappPhoneNumberId: "PNID",
        slackWebhookUrl: "https://hooks.slack.com/services/T000/B000/XXX",
      },
      fetchImpl: async (url) => {
        slackCalls.push(String(url));
        return { ok: false, status: 500, text: async () => "boom" };
      },
      now: () => 1_000,
      setTimeoutFn: () => 0,
      clearTimeoutFn: () => {},
    });
    const r = await q.notifyOwner({ event: igEvent, n: 1 });
    assert.equal(r.sent, "immediate");
    assert.equal(waCalls.length, 1);
    assert.match(waCalls[0], /graph\.facebook\.com/);
    assert.equal(slackCalls.length, 1);
    assert.match(slackCalls[0], /hooks\.slack\.com/);
  } finally {
    globalThis.fetch = prevFetch;
  }
}

{
  resetNotifyQueueForTests();
  const r = await enqueueNotifyOwner({
    config: { ownerWhatsapp: "59899111222" },
    event: igEvent,
    n: 1,
    send: async () => {
      throw new Error("send boom");
    },
  });
  assert.equal(r.skipped, "error");
  assert.equal(r.error, "send boom");
}

resetNotifyQueueForTests();
console.log("metaNotifyParallelGates.test.js: ok");
